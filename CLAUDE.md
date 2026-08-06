# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CLI tool that uploads local `.mp4` videos to a Telegram channel via the Telegram Bot API, using a bot already added to the target channel. It is interactive: it loads presets, prompts the user to pick a preset and an action, then runs the corresponding usecase.

External CLI binaries **`ffmpeg` and `ffprobe` must be on `PATH`** — they are shelled out to (via `node:child_process` `execFile`) for probing, segmenting, cover extraction, and thumbnail generation. There is no JS fallback.

## Commands

```bash
pnpm dev          # run from source with tsx (loads .env)
pnpm build        # compile src -> build/ with swc (commonjs output)
pnpm start        # run compiled build/ with node (loads .env)
pnpm check        # biome check --write (lint + format + organize imports) — run this before committing
pnpm lint         # biome lint --write
pnpm format       # biome format --write
pnpm migrate      # drizzle-kit migrate — reads the DB url from the DB_FILE env (drizzle-kit only)
```

There is **no test suite and no `tsc` typecheck script** (tsconfig is `noEmit`, type-checking happens in-editor). Biome is the only enforced gate.

After editing `src/db/schemas/`, regenerate migrations with `pnpm drizzle-kit generate`. Applying them by hand is usually unnecessary — the app calls `DrizzleConnection.runMigrations()` automatically right after a preset is chosen. Note that `drizzle.config.ts` (and only it) still resolves the database from the `DB_FILE` env var; the app itself no longer reads that variable.

To run the self-hosted Telegram Bot API server (needed for large-file uploads beyond the public API's 50 MB limit): `docker compose up` (reads `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` from `.env`, exposes port 8081). Point a preset's `telegram.apiBaseUrl` at `http://localhost:8081`.

### Environment & config files

- `.env` — `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` (both only used by `compose.yml`). See `.env.example`. `DB_FILE` is no longer read by the app; it survives only in `drizzle.config.ts` for the `drizzle-kit` CLI.
- `presets.json` (gitignored; see `presets.example.json`) — the main runtime config, including each preset's `databaseUrl`. Override its path with `-p/--presetsPath`.

## Architecture

Layered, dependency flows downward. Path alias `@/*` → `src/*` (configured in both `tsconfig.json` for dev/tsx and `.swcrc` for the build). Each directory has an `index.ts` barrel; import from the barrel (`@/services`) not the file.

- **`src/index.ts`** — entrypoint. Loads presets, drives the `@inquirer/prompts` menu, dispatches to a usecase. After the preset is chosen (and before the action menu) it sets `DrizzleConnection.databaseUrl` from the preset and awaits `DrizzleConnection.runMigrations()` — this is the only place the DB url is assigned. Returns an exit code; all errors bubble here and are logged via `logger.fatal`.
- **`src/usecases/`** — orchestration. `uploadVideos.ts` is the core flow (see below), a plain function that instantiates services/repository at module scope and sequences them. `PrintPresetInfo.ts` is a class implementing the `Usecase` interface (`preset` field + `async execute()`); it takes the chosen preset in the constructor, prints the preset's own fields, then calls `TelegramService.getChatData`/`getSelfData` to print the live channel and bot data. New usecases should follow the class + `Usecase` shape.
- **`src/services/`** — stateless I/O and external-process logic.
  - `VideosService` — filesystem + ffmpeg/ffprobe: list `.mp4`s, read `videos.json` metadata, probe dimensions/duration, **segment** large files, manage the `segments/` dir, find/convert cover images.
  - `TelegramService` — builds the post caption, maps DB enums → preset display strings, extracts covers/thumbnails from segments, and uploads via `undici` `fetch` + `FormData` to `POST /bot<token>/sendVideo` (15-min timeout via a custom `Agent`). Also reads from the Bot API: `runHealthCheck()` (boolean over `/getMe`), `getSelfData()` (`/getMe` → bot first/last name + username) and `getChatData(chatId)` (`/getChat` → channel title, type, description); both getters throw when the response is not `ok`.
- **`src/repositories/`** — `VideosRepository`, the only place that touches the DB. Holds the client as `private readonly drizzle = DrizzleConnection.instance`, so it must not be instantiated before `DrizzleConnection.databaseUrl` is set (the getter throws when it is empty). Maps yt-dlp metadata values → DB enums.
- **`src/db/`** — Drizzle ORM over libSQL/SQLite. `schemas/videosTable.ts` is the single table; `migrations/` is generated; `DrizzleConnection.ts` is a static-only singleton (never instantiate it) exposing `databaseUrl` (write-once from the preset; the getter throws if unset), `instance` (lazily built, rebuilt if the client was closed; the setter always throws), the `migrationsFolder`/`schemasFile` paths shared with `drizzle.config.ts`, and `runMigrations()`.
- **`src/domain/`** — Zod schemas + inferred types. `Preset.ts` (preset file shape, with extensive defaults; `name`, `databaseUrl`, `telegram.*` and `videosDirectory` are the required fields), `VideoMetadata.ts` (the `videos.json` shape). Also holds `Usecase.ts`, the plain (non-Zod) interface every usecase class implements. Validation is centralized here; both `loadPresets` and `loadVideosMetadata` return a Go-style `[data, null] | [null, Error]` tuple.
- **`src/utils/`** — `execFile` (promisified child_process), `checkPathAccessibility` (returns `'OK' | 'INEXISTENT' | 'UNACCESSIBLE'`), `getMarkdownEscapedText` (escapes Telegram MarkdownV2), `getSeparator` (builds `---- TEXT ----` log headers; `'TOTAL CHARS'` mode pads to a total width, `'EACH SIDE'` mode puts a fixed number of dashes on each side).

### Upload flow (`uploadVideos.ts`)

Before the loop, the usecase bails out if the directory has no `.mp4`s, then runs its `videos.json` sanity checks (unreadable file, missing/empty file, count mismatch against the `.mp4`s). Each failed check only logs a warning and flips a `shouldAskProceed` flag; a single `Proceed?` confirmation (defaulting to no) is asked afterwards, so the user is never prompted more than once.

For each `.mp4` in `preset.videosDirectory`:
1. Look up the video by filename in the DB; if absent, insert it (enriched from a matching `videos.json` entry when present, matched by filename-without-extension). Skip immediately if its status is already `UPLOADED`.
2. Probe metadata, locate or extract a cover image, generate a thumbnail.
3. **Segment** the file so each part is ≤ 1.75 GB (`generateVideoSegments` uses `ffmpeg -c copy -f segment`, splitting by computed duration). Segments go to `<videosDirectory>/segments/<name>/`, wiped and regenerated each run.
4. For each segment: build the caption from `postDescription.baseText` (placeholders like `#VIDEO_TITLE`, `#PART_CURRENT`, `#AVAILABILITY` are substituted; all values MarkdownV2-escaped), then upload to the channel. Covers are extracted per-segment only when the source had no cover file.
5. Mark the video `UPLOADED` after all its segments succeed.

The unit of resumability is the whole video (DB status), not the segment — a failure mid-segment re-segments and re-uploads the entire video on the next run.

### `videos.json` metadata

Optional per-directory file describing each video (title, url, availability, upload_date). Generate it from a yt-dlp `--dump-single-json` dump with `./scripts/convertYtdlpJsonToVideosJson.sh <ytdlp.json>` — a bash + **`jq`** script (no Node involved) that writes `videos_<timestamp>.json` next to the input, so the result must be renamed to `videos.json` by hand. It flattens `.entries[].entries[]` when the dump groups videos into sections and reads `.entries` directly otherwise. The flow runs without the file but warns and falls back to using the filename as the title.

## Conventions

- ESM throughout (`"module": "nodenext"`), Node `node:` import prefix, `.ts` files run directly via tsx in dev.
- Biome formatting: single quotes, no semicolons, 2-space indent, 100-col width, no trailing commas. `noFloatingPromises` is an error and `noConsole`/`useAwait` are warnings — use the `logger`/`stepsLogger` (pino), not `console`.
- TS strict mode plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — array/record access is `T | undefined`, so destructured `[first]` must be null-checked (this pattern is everywhere).
- Enums are `as const` string-tuple arrays with an inferred union type and a `default*` constant; DB enums (`UPLOADED`, `MEMBERS_ONLY`, …) are uppercase, yt-dlp/external values lowercase, mapped in the repository/service transform methods.
- Method parameter/return types belong to the class they serve. `TelegramService` declares them in an `export namespace TelegramService` merged with the class, so they are referenced as `TelegramService.Constructor`, `TelegramService.UploadVideoToChannelDTO`, `TelegramService.GetChatDataReturn` (the `*Return` types are the whole `Promise<…>`, unwrapped with `Awaited<…>` when annotating the value). `VideosService` still uses the older top-level `*DTO` exports — prefer the namespace form in new code.

## Documentation / example files

These are the **documentation / example files** of this repo. When asked to "update the docs/examples" (with no files specified), review and update all of them:

| File | What it documents |
|---|---|
| `README.md` | User-facing docs, English |
| `README_pt-BR.md` | User-facing docs, Brazilian Portuguese |
| `CLAUDE.md` | This file — guidance for Claude Code |
| `presets.example.json` | Template for the gitignored `presets.json` |
| `.env.example` | Template for the gitignored `.env` |

The two READMEs are kept in sync: each opens with a note linking to the other version, and they must stay equivalent — change both or neither. `presets.example.json` must remain valid JSON (no comments) and validate against `presetSchema` in `src/domain/Preset.ts`; the commented `jsonc` example inside both READMEs must be kept consistent with it.
