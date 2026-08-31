# SLA pages: data pipeline and update flow

Full path: mpv + mpvacious / Yomitan → Anki (mining decks) → sync script via
AnkiConnect → `src/data/mining-stats.json` → commit + push → GitHub Pages
rebuild → `/sla/`.

Only aggregate counts ever leave Anki; no card content is published.

## 1. Collection — mpv + mpvacious + Yomitan

Cards are created through two pipelines, both via AnkiConnect. Japanese uses
the `Lapis` note model; English cards were migrated to a `Lapis copy` model
(cloned from Lapis) so that note-type-scoped tooling never sweeps the
English deck into Japanese stats:

- **Video mining**: mpv + mpvacious (subs2srs, config at
  `~/.config/mpv/script-opts/subs2srs.conf`) feeds subtitle text to the
  clipboard for Yomitan lookup and contributes media to the card:
  `SentenceAudio` (ffmpeg slice, mp3 64k) and `Picture` (snapshot, 800px jpg).
  Crucially it also writes `MiscInfo` in the format
  `%n EP%d (%t)` — "filename + episode + timestamp" (e.g.
  `Show_Name EP6 (12:34)`). This is the only structured source marker.
- **Browser mining**: Yomitan reads page text directly. Its `MiscInfo` gets
  `{document-title}` (JA) or nothing at all (EN deck, older cards mined
  before MiscInfo was configured). These are indistinguishable from video
  cards that lack proper `MiscInfo`.

Deck layout: Japanese mines into `JP::JP-N2_3::Lapis`, English into
`EN::EN-Mining`.

## 2. Reading Anki — AnkiConnect and the `~/anki` scripts

AnkiConnect exposes an HTTP JSON API at `http://127.0.0.1:8765` (API v6).

- `~/anki/anki_connect_cli.py` (+ shared `anki_cli_shared.py`, stdlib only):
  wraps ping / find-notes / notes-info / update-note / sync. Used for Anki
  maintenance, not part of the blog pipeline.
- `~/anki/sync_mining_to_blog.py` (standalone, calls the API via urllib):
  - Starts with an AnkiWeb `sync` so phone-side reviews reach the local
    collection before stats are read.
  - Per language (`LANGUAGES`): every note in the mining deck counts toward
    total/learned/byDay. Notes whose `MiscInfo` matches
    `MISC_RE = ^(?P<show>.+?)\s+EP(?P<ep>\d+)\s+\(` additionally group into
    byShow; all others fall into the catch-all `"*"` show. This regex is
    coupled to `miscinfo_format` — change both together.
  - Learned counts: a note is learned once any of its cards has `reps > 0`
    (via `cardsInfo`), aggregated globally and per show.
  - Study minutes: total `revlog.time` across the Japanese decks
    (`STUDY_DECK_ROOTS = ("JP", "おにぎり文法")`). AnkiConnect does not expose
    review durations, so the script reads a copy of `collection.anki2`
    (plus WAL sidecars when present) with sqlite; a compatible `unicase`
    collation is registered because the `decks` table declares Anki's custom
    one. On failure the previous JSON's `studyMinutes` is kept.
  - JLPT coverage (Japanese only): runs the `anki_coverage` engine
    in-process with `~/anki/configs/jlpt.json`, scoped to the same three
    note types as the `jlpt_coverage` addon (Lapis, Kaishi 1.5k zh-CH,
    eggrolls-JLPT10k-v3.5); reduces entries to per-level
    `{level, total, learned}` counts. The word list is derived from the
    eggrolls deck itself, so "covered" is always 100% — only learned counts
    are meaningful. On failure the previous JSON's coverage is kept.
  - Aggregates per language: total; learned; per show (count, learned,
    episode set); per day (note id is the creation time in epoch ms) with a
    per-day show breakdown; latest mining day.
  - Compares ignoring `generatedAt`; exits quietly when unchanged.
  - Refuses to push when the blog repo has unrelated pending changes.
    Whitelist: the stats file itself and `AGENTS.md`. The commit is scoped
    with `git commit -- <path>` so staged whitelisted edits are not swept in.
  - Suggested crontab entry (NOT installed — `crontab -l` is empty):
    `17 */6 * * * cd /home/frisk/anki && /usr/bin/python3 sync_mining_to_blog.py >> /home/frisk/anki/logs/mining-sync.log 2>&1`

## 3. Display — `src/pages/sla/`

Routes (the old `/mining/` URLs redirect here, see `astro.config.mjs`):

- `/sla/` (`index.astro`) — hub: overall learned/total plus one
  progress row per language linking to its dashboard.
- `/sla/ja/` and `/sla/en/` (`ja.astro`, `en.astro`) — per-language
  dashboards, both rendered by `src/components/MiningDashboard.astro`.
- `/sla/ja/jlpt/` (`ja/jlpt.astro`) — JLPT vocabulary coverage, linked from
  the hub and the Japanese dashboard. Server-rendered only, no client JS.

`MiningDashboard.astro` contains the stat row, by-show list, heatmap, and
range picker:

- Data is embedded at build time (JSON import, plus a `data-stats` attribute
  for the client script). The heatmap is server-rendered, so the page works
  without JS; the range-picker results are client-only.
- By-show list: learned/total progress gradient per show. The catch-all
  `"*"` show (cards without source info) renders as "No source info",
  without an episode list.
- Heatmap: GitHub-style, one column per week (Sunday-aligned), rows Sun–Sat;
  window is 52 weeks clamped to the week containing the first recorded day;
  month labels only where the month changes (≥ 2 empty columns between
  labels); Mon/Wed/Fri row labels; 5-level color scale via `--accent`
  opacity; each cell has a `title` tooltip.
- Range picker: From/To date inputs + Reset. On change the client rebuilds
  the whole heatmap (rescaled to the range, color levels recomputed from the
  range max, month labels rebuilt) and lists the range total, per-show
  breakdown, and per-day bars inside a collapsed-by-default
  "Range results" `<details>` (it duplicates the by-show list at full
  range, so it stays folded until needed). Swapped inputs are
  auto-corrected; empty inputs fall back to the full range.
- Styles: shared stat styles (`.stat-row`, `.stat-note`, `.show-list`,
  `.show-meta`, `.show-progress`) live in `global.css`; heatmap/range-picker
  styles use `<style is:global>` in the component because Astro-scoped
  styles cannot reach JS-created elements, and are prefixed with
  `#mining-app`.

`mining-stats.json` shape: `{ generatedAt, studyMinutes, ja: {...},
en: {...} }` where each language block is `{ total, learned, latestMinedAt,
byShow: [{show, count, learned, episodes}], byDay: [{date, count,
shows: {show: count}}] }` and `ja` additionally carries
`jlptCoverage: [{level, total, learned}]`. `studyMinutes` is Japanese-only
and top-level. `studyMinutes`/`jlptCoverage` are optional and the pages guard
for them; a whole language block missing from a sync run (e.g. deck renamed)
is carried over from the previous JSON by the script rather than dropped.

## 4. Update and deploy flow

1. Mine cards locally while watching or reading.
2. Run `sync_mining_to_blog.py` manually (cron is only suggested, not
   installed — see Known issues).
3. If the stats changed, the script commits `src/data/mining-stats.json`
   ("Update mining stats") and pushes.
4. `.github/workflows/deploy.yml` rebuilds the site on push; `/sla/`
   updates with the deploy.

## Known issues

- **Cron not installed**: stats only update when the script is run manually.
- **`MISC_RE` ↔ `miscinfo_format` coupling**: changing one requires
  changing the other.
- **`*` dominates**: most existing cards predate MiscInfo configuration, so
  the `"*"` catch-all dwarfs the named shows (JA 394/446, EN 462/462). This
  improves only as new properly-tagged cards are mined; old cards are not
  backfilled.
