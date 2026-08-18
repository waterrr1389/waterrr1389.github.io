---
title: '用 Astro 内容集合搭建博客'
description: '记录这次用 Astro Content Collections 重写博客的过程：从目录约定、frontmatter 校验到静态路由生成，每一步都比想象中简单。'
pubDate: 2026-08-15
tags: ['Astro', '前端']
cover: '/images/cover-dawn.svg'
---

最近把博客从一套手写的 HTML 模板迁移到了 Astro，整个过程意外地顺利。这篇文章记录一下核心部分：内容集合（Content Collections）是怎么组织文章的。

## 目录与 schema

所有文章放在 `src/content/posts/` 下，每篇是一个 Markdown 文件。frontmatter 用 zod 校验，字段缺失或类型不对会在构建期直接报错，比运行时在页面上炸掉友好得多：

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { posts };
```

有了这层校验，写文章时少写 `pubDate` 这种低级错误，在 `npm run build` 阶段就会被拦住。

## 生成路由

动态路由文件 `src/pages/posts/[...slug].astro` 里用 `getStaticPaths` 遍历集合即可，每篇文章一个静态页面。构建产物是纯 HTML，部署到任何静态托管上都能跑，不需要服务端。

## 小结

内容集合的价值在于：内容、校验、路由三件事各自有明确的位置，互不纠缠。对一个小博客来说，这种清晰度比"功能多"重要得多。
