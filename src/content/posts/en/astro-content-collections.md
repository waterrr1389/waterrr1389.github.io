---
title: 'Building a Blog with Astro Content Collections'
description: 'Notes from rebuilding this site with Astro Content Collections: directory conventions, frontmatter validation, and static route generation — each step simpler than expected.'
pubDate: 2026-08-15
tags: ['Astro', 'Frontend']
cover: '/images/cover-dawn.svg'
---

I recently migrated this blog from a set of hand-written HTML templates to Astro, and the whole process went surprisingly smoothly. This post records the core part: how Content Collections organize the writing.

## Directory and schema

All posts live under `src/content/posts/`, one Markdown file each. The frontmatter is validated with zod — a missing field or wrong type fails the build, which is far friendlier than blowing up at runtime:

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

With that layer in place, a typo like forgetting `pubDate` gets caught at `npm run build` time.

## Generating routes

The dynamic route `src/pages/posts/[...slug].astro` iterates the collection in `getStaticPaths`, producing one static page per post. The output is plain HTML that can be deployed to any static host — no server required.

## Takeaway

The real value of Content Collections is that content, validation, and routing each have a clearly defined place and stay out of each other's way. For a small blog, that clarity matters more than feature count.
