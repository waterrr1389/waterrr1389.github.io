---
title: 'Designing Dark Mode for Astigmatic Eyes'
description: 'Dark mode is not just painting the background black. For eyes with astigmatism like mine, pure white on pure black is a disaster — notes on picking a gentler dark palette.'
pubDate: 2026-08-08
tags: ['Design', 'Notes']
---

Many people think dark mode means "black background, white text". But for astigmatic eyes like mine, pure black (#000000) with pure white (#ffffff) is the harshest combination possible: text edges bloom with halos, and reading for long stretches leaves my eyes sore.

## Contrast is the culprit

Astigmatism smears high-contrast edges. Pure white text on pure black makes every glyph bleed light like a tiny lamp. The fix is simple: **step back on both sides**.

- Use dark gray instead of pure black for the background, e.g. `#1c1c1e`
- Use off-white instead of pure white for text, e.g. `#e3e3e0`
- Swap the accent blue for something softer, like `#0a84ff`

Contrast drops from 21:1 to roughly 13:1 — still well within WCAG AAA readability, but the halos mostly disappear.

## Images need care too

In a dark theme, bright images are harsher than text. One line of CSS helps:

```css
[data-theme='dark'] img {
  filter: brightness(0.9);
}
```

## Don't flash white on load

One last engineering detail: theme detection must happen before the page renders, otherwise dark-mode users see a white flash on every load. Inline the detection script in `<head>`, set `<html data-theme>` before the body renders, and the flash is gone.

This site's dark mode follows exactly that recipe. If you're reading this post in the dark, I hope your eyes are comfortable.
