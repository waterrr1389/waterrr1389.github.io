# Mining page: data pipeline and update flow

Full path: mpv + mpvacious → Anki (Lapis deck) → sync script via AnkiConnect →
`src/data/mining-stats.json` → commit + push → GitHub Pages rebuild → `/mining/`.

Only aggregate counts ever leave Anki; no card content is published.

## 1. Collection — mpv + mpvacious

mpvacious (subs2srs), config at `~/.config/mpv/script-opts/subs2srs.conf`:

- Target deck `JP::JP-N2_3::Lapis`, note model `Lapis`.
- Fields written: `Sentence` (sentence with the target word bolded),
  `SentenceAudio` (ffmpeg slice, mp3 64k), `Picture` (snapshot, 800px jpg).
- Meaningful-card criterion: `miscinfo_enable=yes`, `miscinfo_field=MiscInfo`,
  `miscinfo_format=%n EP%d (%t)` — writes "filename + episode + timestamp"
  (e.g. `Show_Name EP6 (12:34)`) into `MiscInfo`, shown at the bottom of the
  card back.
- Other: `use_ffmpeg=yes`, `autoclip` pipes subtitle lines to Goldendict,
  `allow_duplicates=no`, secondary subtitles auto-load Chinese
  (`secondary_sub_auto_load=yes`, `secondary_sub_lang=chi,zh-CN,sc,chs`).

Yomitan: browser-side mining also uses the Lapis model, but its `MiscInfo`
gets `{document-title}`, which does not match the mpvacious format — those
cards are automatically excluded from the stats.

## 2. Reading Anki — AnkiConnect and the `~/aaa` scripts

AnkiConnect exposes an HTTP JSON API at `http://127.0.0.1:8765` (API v6).

- `~/aaa/anki_connect_cli.py` (+ shared `anki_cli_shared.py`, stdlib only):
  wraps ping / find-notes / notes-info / update-note / sync. Used for Anki
  maintenance (e.g. clearing meaningless `MiscInfo` values), not part of the
  blog pipeline. AnkiWeb sync (`sync`) is also separate from the blog chain.
- `~/aaa/sync_mining_to_blog.py` (standalone, calls the API via urllib):
  - Query: `deck:"JP::JP-N2_3::Lapis" "MiscInfo:_*"`.
  - `MISC_RE = ^(?P<show>.+?)\s+EP(?P<ep>\d+)\s+\(` selects mpvacious cards.
    This regex is coupled to `miscinfo_format` — change both together.
  - Aggregates: total; per show (count, episode set); per day (note id is the
    creation time in epoch ms) with a per-day show breakdown; latest mining day.
  - Compares ignoring `generatedAt`; exits quietly when unchanged.
  - Refuses to push when the blog repo has unrelated pending changes.
    Whitelist: the stats file itself and `AGENTS.md`. The commit is scoped
    with `git commit -- <path>` so staged whitelisted edits are not swept in.
  - Suggested crontab entry (NOT installed — `crontab -l` is empty):
    `17 */6 * * * cd /home/frisk/aaa && /usr/bin/python3 sync_mining_to_blog.py >> /home/frisk/aaa/logs/mining-sync.log 2>&1`

## 3. Display — `src/pages/mining.astro`

- Data is embedded at build time (JSON import, plus a `data-stats` attribute
  for the client script). The heatmap is server-rendered, so the page works
  without JS; the range-picker results are client-only.
- Sections: header summary (total + last active day), "By show" list,
  "By day" heatmap.
- Heatmap: GitHub-style, one column per week (Sunday-aligned), rows Sun–Sat;
  window is 52 weeks clamped to the week containing the first recorded day;
  month labels only where the month changes (≥ 2 empty columns between
  labels); Mon/Wed/Fri row labels; 5-level color scale via `--accent`
  opacity; each cell has a `title` tooltip.
- Range picker: From/To date inputs + Reset. On change the client rebuilds
  the whole heatmap (rescaled to the range, color levels recomputed from the
  range max, month labels rebuilt) and lists the range total, per-show
  breakdown, and per-day bars. Swapped inputs are auto-corrected; empty
  inputs fall back to the full range.
- Styles use `<style is:global>` because Astro-scoped styles cannot reach
  JS-created elements; all page selectors are prefixed with `#mining-app`
  (`.show-list` is shared with the SSR section).

`mining-stats.json` shape: `{ generatedAt, total, latestMinedAt, byShow:
[{show, count, episodes}], byDay: [{date, count, shows: {show: count}}] }`.

## 4. Update and deploy flow

1. Mine cards locally while watching.
2. Run `sync_mining_to_blog.py` manually (cron is only suggested, not
   installed — see Known issues).
3. If the stats changed, the script commits `src/data/mining-stats.json`
   ("Update mining stats") and pushes.
4. `.github/workflows/deploy.yml` rebuilds the site on push; `/mining/`
   updates with the deploy.

## Known issues

- **Cron not installed**: stats only update when the script is run manually.
- **`MISC_RE` ↔ `miscinfo_format` coupling**: changing one requires
  changing the other.
