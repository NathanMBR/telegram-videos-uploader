# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CLI tool that uploads local `.mp4` videos to a Telegram channel via the Telegram Bot API, using a bot already added to the target channel. It is interactive: it loads presets, prompts the user to pick a preset and an action (currently only "Upload videos"), then processes each video in the preset's directory.

External CLI binaries **`ffmpeg` and `ffprobe` must be on `PATH`** — they are shelled out to (via `node:child_process` `execFile`) for probing, segmenting, cover extraction, and thumbnail generation. There is no JS fallback.

## Commands

```bash
pnpm dev          # run from source with tsx (loads .env)
pnpm build        # compile src -> build/ with swc (commonjs output)
pnpm start        # run compiled build/ with node (loads .env)
pnpm check        # biome check --write (lint + format + organize imports) — run this before committing
pnpm lint         # biome lint --write
pnpm format       # biome format --write
pnpm migrate      # drizzle-kit migrate — apply DB migrations to DB_FILE
```

There is **no test suite and no `tsc` typecheck script** (tsconfig is `noEmit`, type-checking happens in-editor). Biome is the only enforced gate.

After editing `src/db/schemas/`, regenerate migrations with `pnpm drizzle-kit generate` and apply with `pnpm migrate`.

To run the self-hosted Telegram Bot API server (needed for large-file uploads beyond the public API's 50 MB limit): `docker compose up` (reads `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` from `.env`, exposes port 8081). Point a preset's `telegram.apiBaseUrl` at `http://localhost:8081`.

### Environment & config files

- `.env` — `DB_FILE` (e.g. `file:database.db`), `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`. See `.env.example`.
- `presets.json` (gitignored; see `presets.example.json`) — the main runtime config. Override its path with `-p/--presetsPath`.

## Architecture

Layered, dependency flows downward. Path alias `@/*` → `src/*` (configured in both `tsconfig.json` for dev/tsx and `.swcrc` for the build). Each directory has an `index.ts` barrel; import from the barrel (`@/services`) not the file.

- **`src/index.ts`** — entrypoint. Loads presets, drives the `@inquirer/prompts` menu, dispatches to a usecase. Returns an exit code; all errors bubble here and are logged via `logger.fatal`.
- **`src/usecases/`** — orchestration. `uploadVideos.ts` is the core flow (see below). Instantiates services/repository at module scope and sequences them.
- **`src/services/`** — stateless I/O and external-process logic.
  - `VideosService` — filesystem + ffmpeg/ffprobe: list `.mp4`s, read `videos.json` metadata, probe dimensions/duration, **segment** large files, manage the `segments/` dir, find/convert cover images.
  - `TelegramService` — builds the post caption, maps DB enums → preset display strings, extracts covers/thumbnails from segments, and uploads via `undici` `fetch` + `FormData` to `POST /bot<token>/sendVideo` (15-min timeout via a custom `Agent`).
- **`src/repositories/`** — `VideosRepository`, the only place that touches the DB. Maps yt-dlp metadata values → DB enums.
- **`src/db/`** — Drizzle ORM over libSQL/SQLite. `schemas/videosTable.ts` is the single table; `drizzle.ts` is the client; `migrations/` is generated.
- **`src/domain/`** — Zod schemas + inferred types. `Preset.ts` (preset file shape, with extensive defaults), `VideoMetadata.ts` (the `videos.json` shape). Validation is centralized here; both `loadPresets` and `loadVideosMetadata` return a Go-style `[data, null] | [null, Error]` tuple.
- **`src/utils/`** — `execFile` (promisified child_process), `checkPathAccessibility` (returns `'OK' | 'INEXISTENT' | 'UNACCESSIBLE'`), `getMarkdownEscapedText` (escapes Telegram MarkdownV2).

### Upload flow (`uploadVideos.ts`)

For each `.mp4` in `preset.videosDirectory`:
1. Look up the video by filename in the DB; if absent, insert it (enriched from a matching `videos.json` entry when present, matched by filename-without-extension). Skip immediately if its status is already `UPLOADED`.
2. Probe metadata, locate or extract a cover image, generate a thumbnail.
3. **Segment** the file so each part is ≤ 1.75 GB (`generateVideoSegments` uses `ffmpeg -c copy -f segment`, splitting by computed duration). Segments go to `<videosDirectory>/segments/<name>/`, wiped and regenerated each run.
4. For each segment: build the caption from `postDescription.baseText` (placeholders like `#VIDEO_TITLE`, `#PART_CURRENT`, `#AVAILABILITY` are substituted; all values MarkdownV2-escaped), then upload to the channel. Covers are extracted per-segment only when the source had no cover file.
5. Mark the video `UPLOADED` after all its segments succeed.

The unit of resumability is the whole video (DB status), not the segment — a failure mid-segment re-segments and re-uploads the entire video on the next run.

### `videos.json` metadata

Optional per-directory file describing each video (title, url, availability, upload_date). Generate it from a yt-dlp `--dump-single-json` dump with `pnpm tsx scripts/convertYtdlpJsonToVideosJson.ts <ytdlp.json>` (writes `videos.json` next to the input). The flow runs without it but warns and falls back to using the filename as the title.

## Conventions

- ESM throughout (`"module": "nodenext"`), Node `node:` import prefix, `.ts` files run directly via tsx in dev.
- Biome formatting: single quotes, no semicolons, 2-space indent, 100-col width, no trailing commas. `noFloatingPromises` is an error and `noConsole`/`useAwait` are warnings — use the `logger`/`stepsLogger` (pino), not `console`.
- TS strict mode plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — array/record access is `T | undefined`, so destructured `[first]` must be null-checked (this pattern is everywhere).
- Enums are `as const` string-tuple arrays with an inferred union type and a `default*` constant; DB enums (`UPLOADED`, `MEMBERS_ONLY`, …) are uppercase, yt-dlp/external values lowercase, mapped in the repository/service transform methods.

## Documentation

There are two README files kept in sync: `README.md` (English) and `README_pt-BR.md` (Brazilian Portuguese). Each opens with a note linking to the other version. When updating user-facing docs, change both files so they stay equivalent.
