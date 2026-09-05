---
title: 在RV64上实现RV32兼容，A Software Approach？
description: ""
pubDate: 2026-09-05
tags: ["riscv", "emulation", "ysyx"]
---

最近弄到了一块RV64的开发板，还没想好怎么好好物尽其用，想起来我在ysyx项目里使用过的NEMU——一个支持RV32IM的指令集模拟器。但NEMU是一个interpreter，运行时开销极大。为NEMU增加JIT后端能大幅提升性能，但工作量巨大。（一个常见的错误想法是：使用JIT实现的emulator不能REF。JIT只是一种代码生成技术，但正确模拟CPU ISA的DBT必须能在指令边界重建精确的架构状态，否则无法处理guest异常）除了JIT还有一条更轻的路：让host CPU直接执行guest二进制。前提是guest和host的ISA足够接近——恰好有这样的先例。
Yuzu——一个Nintendo Switch模拟器。众所周知，Switch上搭载的Tegra X1是Armv8架构，恰好绝大多数安卓手机的SoC上集成的CPU也是Armv8/9架构，二者的ISA极度接近甚至完全相同。这就带来了一个想法：我们能否在安卓手机上直接执行为Horizon OS产出的二进制？这个想法的成果就是NCE（native code execution）。总的来说，NCE大致由以下几个部分组成：游戏加载阶段的二进制改写，通过patch语义分歧的指令（非常少）；当然NS游戏也需要执行Horizon自己的系统调用，通过替换SVC指令为跳转指令，跳转到模拟器代码，在模拟器内实现Horizon系统调用；还使用了Linux的信号机制用来处理内存映射、访存对齐之类的问题，这里不做展开。

---

## 想法

RV32I+M的编码在RV64里几乎都是合法指令，位模式相同。将NCE的思路移植过来：

1. 把RV32可执行文件加载到内存
2. 加载时原地patch语义分歧的指令（等长替换）
3. CPU直接执行
4. 信号处理器覆盖残余语义：SIGTRAP处理停机、SIGSEGV处理MMIO、SIGILL兜底模拟

目标：RV32二进制在RV64 Linux上接近原生速度运行。

## 可行的部分：算术分歧

分歧集中在位宽：`add`在RV64上是64位回绕，RV32要求32位回绕。这类指令需要patch，好在RV64自带答案——W形指令（`addw`/`sllw`/...）的硬件行为就是"取低32位运算、符号扩展写回"，恰好等于RV32语义。

```
add  -> addw     sub  -> subw
sll  -> sllw     srl  -> srlw     sra -> sraw
addi -> addiw    slli -> slliw    ...
mul  -> mulw     div  -> divw     ...
```

但W形替换能成立有一个前提：**寄存器里的guest值始终保持符号扩展形态**（比如guest的-1在64位寄存器里是0xFFFFFFFF_FFFFFFFF）。W形指令的结果恰好自带符号扩展，所以这个约定一旦建立，就会被每条patch后的指令自动维持，不需要额外工作。

这个约定还带来一个红利：比较指令一条都不用改，因为符号扩展对两种比较都保序。

- 有符号：补码保值，trivial
- 无符号：bit31=0的值（0x00000000–0x7FFFFFFF）映到64位无符号空间底部；bit31=1的值（0x80000000–0xFFFFFFFF）映到顶部（0xFFFFFFFF_80000000起，共同全1前缀）；块内块间顺序均保持。例如guest里无符号比较0x80000000 > 0x7FFFFFFF，扩展后变成0xFFFFFFFF_80000000 > 0x00000000_7FFFFFFF，64位无符号比较下结论不变

推论：`slt`/`sltu`/`beq`等比较和分支指令原样执行即正确。

无W形的指令在运行时处理：

- `mulh`类：patch成保留寄存器字段的非法编码，在handler中处理
- `ecall`/`csr`/`mret`等特权级指令：加载时改写，运行时维护影子CSR

## 问题：地址空间

RISC-V生态通常约定0x80000000为代码基址，有效的程序计数器值的第31位始终为1。后果：同一guest指针以两种64位形态进入寄存器，路径不同：

- pc来源（`auipc`/`jal`，包括所有`la`）：宿主真实pc加偏移，零扩展 `0x00000000_8xxxxxxx`
- 内存来源（`lw`读回时进行符号扩展）：`0xFFFFFFFF_8xxxxxxx`

要让两者统一为符号扩展形态，代码必须映射在0xFFFFFFFF8...执行。但bits 63:32全1的地址在sv39/sv48/sv57任何模式下都属于内核半部（参考内核文档：Documentation/arch/riscv/vm-layout.rst），用户态mmap必然失败。

| 模式 | 用户空间 | 内核空间 |
|---|---|---|
| sv39 | 0x0 – 0x3F_FFFFFFFF | 0xFFFFFFC0_00000000 起 |
| sv48 | 0x0 – 0x7FFF_FFFFFFFF | 0xFFFF8000_00000000 起 |
| sv57 | 0x0 – 0xFF_FFFFFFFFFFFF | 0xFF000000_00000000 起 |

### 后果一：ret fault（可解）

```asm
sw   ra, 12(sp)          # 只存 0x00000000_80000123 的低32位
lw   ra, 12(sp)          # 读回 0x80000123，符号扩展：
                         # ra = 0xFFFFFFFF_80000123
ret                      # jalr x0, 0(ra)：在 0xFFFFFFFF_80000123 取指
                         # -> 缺页 -> SIGSEGV
```

手段：

- `lw ra` -> `lwu ra`，等长替换；ABI保证ra只装返回地址，安全
- SIGSEGV处理器截断地址、改写ucontext中的pc、sigreturn恢复

结果正确但实现不优雅。

### 后果二：跨形态比较（无解）

```c
// guest语义：cb == &my_handler 为真
if (cb == &my_handler) { ... }
```

```asm
lw   a5, ...          # cb，经内存：0xFFFFFFFF_80000abc
auipc a4, ...         # &my_handler，pc来源（高位）
addi a4, a4, ...      #                  （低位）-> 0x00000000_80000abc
beq  a5, a4, ...      # 64位比较：不等 -> 走错分支，无任何报错
```

不访存、不fault、无拦截点。三条出路均不通：

1. 消灭零扩展形态：代码需映射在0xFFFFFFFF8...，内核半部，不可能
2. 消灭符号扩展形态：需把读指针的`lw`改为`lwu`，但一条`lw`编码无法静态区分指针与数据
3. 拦截比较：`beq`不会trap

结果静默出错，结构性无解

## 其他尝试

通过把所有`lw`替换为`lwu`来统一指针形式，但做有符号比较会出错，例如：

```asm
# guest：t0 = -1，t1 = 1
slt a0, t0, t1         # 应为 1
# 零扩展后 t0 = 0x00000000_FFFFFFFF（很大的正数）
# slt按有符号64位比较得到 0，错误且无报错
```

而有符号比较指令没法等长patch成别的指令。数据要符号扩展、指针要零扩展，同一条`lw`编码分不出自己读的是哪个。

## 硬件侧的答案

RV32在RV64上透明执行存在官方路径：特权架构中可写的sstatus.UXL，使U-mode以XLEN=32执行，即硬件兼容模式。如果仔细思考，就会意识到在硬件侧修改datapath实现兼容更加容易，而软件方案则需要处理大量的情况。

## 需求层面

即使方案可行也无实际需求。Abstract Machine项目优秀的抽象层让应用能在各种little-endian的体系结构上运行。RV32二进制唯一不可替代的用途是作为NEMU/NPC的测试输入，但该场合更需要可信和可观测，不是速度。