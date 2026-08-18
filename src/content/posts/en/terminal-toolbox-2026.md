---
title: 'My Terminal Toolbox, 2026 Edition'
description: 'The annual command-line tool review: what stayed, what got removed, and why the small tools in your shell deserve periodic scrutiny.'
pubDate: 2026-07-12
tags: ['Tools', 'Notes']
---

Every summer I clean up my terminal environment. Not a scorched-earth OS reinstall — just an honest answer to one question: which command-line tools did I actually use over the past year?

## What stayed

- **ripgrep**: my default for searching code. Fast, and it respects `.gitignore`. I can't remember the last time I typed `grep -r`.
- **fd**: a modern `find` replacement with half the syntax and several times the speed.
- **zoxide**: directory jumping. Once you use it, there's no going back.
- **jq**: irreplaceable when dealing with JSON from APIs.

## What got removed

This year I removed a terminal file manager I had used for three years. Not because it was bad — I just realized that 90% of the time I only need `ls`, `cd`, and my editor. A tool's value is in reducing friction, not adding another interface to memorize.

## A small lesson

A toolbox is like a backpack: the fuller it is, the slower you walk. Review it once a year, delete the "might use it someday" entries, and keep only what you use daily. The line count of your shell config is, in a way, a measure of your mental load.
