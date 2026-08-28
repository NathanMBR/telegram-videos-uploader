# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CLI tool that uploads local videos to a Telegram channel via the Telegram Bot API, using a bot already added to the target channel. Uploads are always `.mp4`; other container formats are offered for conversion first. It is interactive: it loads presets, prompts the user to pick a preset and an action, then runs the corresponding usecase.

External CLI binaries **`ffmpeg` and `ffprobe` must be on `PATH`** — they are shelled out to (via `node:child_process` `execFile`) for probing, segmenting, cover extraction, and thumbnail generation. There is no JS fallback.

## Commands

```bash
pnpm dev          # run from source with tsx (loads .env)
pnpm build        # compile src -> build/ with swc (commonjs output)
pnpm start        # run compiled build/ with node (loads .env)
pnpm lint:type    # tsc — type-check only (tsconfig is `noEmit`)
pnpm lint:check   # biome check --write (lint + format + organize imports) — run this before committing
pnpm lint:check:ci # biome check — same checks without writing
pnpm migrate      # drizzle-kit migrate — reads the DB url from the DB_FILE env (drizzle-kit only)
```

There is **no test suite**. The enforced gates are `pnpm lint:type` and `pnpm lint:check` — there are no separate `lint`/`format` scripts, `lint:check` covers both.

After editing `src/db/schemas/`, regenerate migrations with `pnpm drizzle-kit generate`. Applying them by hand is usually unnecessary — the app calls `DrizzleConnection.runMigrations()` automatically right after a preset is chosen. Note that `drizzle.config.ts` (and only it) still resolves the database from the `DB_FILE` env var; the app itself no longer reads that variable.

To run the self-hosted Telegram Bot API server (needed for large-file uploads beyond the public API's 50 MB limit): `docker compose up` (reads `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` from `.env`, exposes port 8081). Point a preset's `telegram.apiBaseUrl` at `http://localhost:8081`.

### Environment & config files

- `.env` — `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` (both only used by `compose.yml`). See `.env.example`. `DB_FILE` is no longer read by the app; it survives only in `drizzle.config.ts` for the `drizzle-kit` CLI.
- `presets.json` (gitignored; see `presets.example.json`) — the main runtime config, including each preset's `databaseUrl`. Override its path with `-p/--presetsPath`.
- CLI flags — parsed once in `src/config/args.ts` (`node:util` `parseArgs`) and read through the `args` object exported by the `@/config` barrel: `-p/--presetsPath` (string, defaults to `presets.json` in the cwd) and `-d/--dryRun` (boolean, default `false`).

## Architecture

Layered, dependency flows downward. Path alias `@/*` → `src/*` (configured in both `tsconfig.json` for dev/tsx and `.swcrc` for the build). Each directory has an `index.ts` barrel; import from the barrel (`@/services`) not the file.

- **`src/index.ts`** — entrypoint. Thin: it only `await boot()`s and returns an exit code. All errors bubble here and are logged via `logger.fatal`; the `.catch` also forces `process.exitCode = 1`.
- **`src/main/`** — `boot()`, the session flow. Loads the presets (throwing on a load error or an empty list), asks for one with `InquirerCLIService.select`, sets `DrizzleConnection.databaseUrl` from it and awaits `DrizzleConnection.runMigrations()` — this is the only place the DB url is assigned. It then builds the `MenuUsecase` with the available usecases and executes it; when the menu returns `'PRESET'` it calls itself recursively, so choosing `Change preset` re-reads `presets.json`, re-prompts and reconnects/re-migrates against the new preset's database.
- **`src/usecases/`** — orchestration. Every usecase is a class extending the `Usecase` abstract class (abstract `preset` field + `async execute()`, plus the inherited `printDryRunMessage()`), takes the chosen preset in the constructor and is dispatched as `await new Usecase(chosenPreset).execute()`. `execute()` resolves to a `Usecase.ExecuteReturn` — `'OK'` (done, end the program), `'MENU'` (go back to the action menu) or `'PRESET'` (go back to the preset selection). `MenuUsecase.ts` owns the action menu: it maps the usecases it was constructed with to thunks, `unshift`s a `Change preset` option (returns `'PRESET'`) and pushes an `Exit` option (returns `'OK'`), then loops by recursing on itself while the chosen action returns `'MENU'` and bubbles anything else up to `boot()`. `UploadVideosUsecase.ts` is the core flow (see below): it instantiates the services/repositories inside `execute()` and sequences them. `PrintPresetInfoUsecase.ts` prints the preset's own fields, then calls `TelegramService.getChatData`/`getSelfData` to print the live channel and bot data, and finishes with a `Return to menu?` `cli.confirm` (defaulting to yes) — yes returns `'MENU'`, no returns `'OK'`. `DeleteVideoUsecase.ts` picks a video with `cli.search` (each keystroke re-queries `VideosRepository.getAll(input)`; options are labelled by title), then asks a `cli.confirm` — answering no logs `Deletion cancelled.` and returns `'MENU'` without deleting. `EditVideoUsecase.ts` picks a video the same way but through `cliService.autocomplete` (re-queries `VideosRepository.getAll(input, preset.origin)`), then a `cli.select` of the editable property — title, description, availability, publication date — whose option values are thunks that prompt for the new value (`cli.input`, prefilled with the current one; the date is validated as `YYYY-MM-DD`) and call `VideosRepository.update`; the `Cancel edit` option has a `null` value and returns `'MENU'`. Under `args.dryRun` it prints the dry-run message and returns `'OK'` right after the property selection, so the value prompt never runs and nothing is written. Otherwise it rebuilds the caption for every `VideoUploadsRepository.getAll(videoId)` row (part numbers come from the stored uploads) and pushes it with `TelegramService.updateMessage`, then returns `'OK'`.
- **`src/services/`** — stateless I/O and external-process logic.
  - `VideosService` — filesystem + ffmpeg/ffprobe: list the directory's `.mp4`s and, separately, its convertible non-mp4 files (`listVideosFileNames` returns both lists), convert those to mp4 (`convertVideoToMp4`, `ffmpeg -y -c:v libx264 -c:a aac`, output written next to the source with the same base name), read `videos.json` metadata, probe dimensions/duration, **segment** large files, manage the `segments/` dir, find/convert cover images.
  - `TelegramService` — builds the post caption, maps DB enums → preset display strings, extracts covers/thumbnails from segments, and uploads via `undici` `fetch` + `FormData` to `POST /bot<token>/sendVideo` (15-min timeout via a custom `Agent`). Also reads from the Bot API: `runHealthCheck()` (boolean over `/getMe`), `getSelfData()` (`/getMe` → bot first/last name + username) and `getChatData({ chatId })` (`/getChat` → channel title, type, description); both getters throw when the response is not `ok`. `updateMessage({ chatId, messageId, message })` rewrites an existing post's caption via `POST /editMessageCaption` (JSON body, `parse_mode: 'MarkdownV2'`), throwing a `UsageError` on a non-`ok` response.
- **`src/repositories/`** — `VideosRepository`, the only place that touches the DB. Holds the client as `private readonly drizzle = DrizzleConnection.instance`, so it must not be instantiated before `DrizzleConnection.databaseUrl` is set (the getter throws when it is empty). Maps yt-dlp metadata values → DB enums. `getAll(search)` returns every row ordered by title, filtered by a `LIKE %search%` over filename/title/description when `search` is non-empty; `deleteFromId(id)` removes a single row; `update(id, videoDto)` sets title/description/availability/publishedAt on one row and returns it, throwing a `UsageError` when the id doesn't exist.
- **`src/db/`** — Drizzle ORM over libSQL/SQLite. `schemas/videosTable.ts` is the single table; `migrations/` is generated; `DrizzleConnection.ts` is a static-only singleton (never instantiate it) exposing `databaseUrl` (assigned from the preset in `boot()`; the getter throws if unset, and the setter closes the open libSQL client before reassigning, so switching presets is safe), `instance` (lazily built, rebuilt if the client was closed; its setter is private and always throws), the `migrationsFolder`/`schemasFile` paths shared with `drizzle.config.ts`, and `runMigrations()`.
- **`src/domain/`** — Zod schemas + inferred types. `Preset.ts` (preset file shape, with extensive defaults; `name`, `databaseUrl`, `telegram.*` and `videosDirectory` are the required fields), `VideoMetadata.ts` (the `videos.json` shape). Also holds `Usecase.ts`, the plain (non-Zod) abstract class every usecase extends — it declares the abstract `preset`/`execute()` members and provides `printDryRunMessage()`, which logs `Dry run enabled; skipping...` via the `logger`. Its merged `namespace Usecase` exports `ExecuteReturn` (`'OK' | 'MENU' | 'PRESET'`), the return type of every `execute()`. Validation is centralized here; both `loadPresets` and `loadVideosMetadata` return a Go-style `[data, null] | [null, Error]` tuple.
- **`src/utils/`** — `execFile` (promisified child_process), `checkPathAccessibility` (returns `'OK' | 'INEXISTENT' | 'UNACCESSIBLE'`), `getMarkdownEscapedText` (escapes Telegram MarkdownV2), `getSeparator` (builds `---- TEXT ----` log headers; `'TOTAL CHARS'` mode pads to a total width, `'EACH SIDE'` mode puts a fixed number of dashes on each side).

### Upload flow (`UploadVideosUsecase.ts`)

Before the loop, the usecase bails out if the directory has neither `.mp4`s nor convertible videos (`.mkv`, `.avi`, `.wmv`, `.webm`, `.mov`, `.mpg`, `.mpeg`, `.flv`, `.ogv`, `.3gp`, `.vob`, `.mxf`). When convertible files are present it asks a single `Convert them?` confirmation (defaulting to yes) and, if accepted, converts each one with `VideosService.convertVideoToMp4` and appends it to the upload list; declining leaves them out of the run entirely. It then runs its `videos.json` sanity checks (unreadable file, missing/empty file, count mismatch against the upload list, counted after conversion). Each failed check only logs a warning and flips a `shouldAskProceed` flag; a single `Proceed?` confirmation (defaulting to no) is asked afterwards, so the user is never prompted more than once. Declining it returns `'MENU'` (back to the action menu); the empty-directory bail-out returns `'OK'`.

For each video in `preset.videosDirectory`:
1. Look up the video by filename in the DB; if absent, insert it (enriched from a matching `videos.json` entry when present, matched by filename-without-extension). Skip immediately if its status is already `UPLOADED`. Under `args.dryRun` the iteration stops right after the lookup (logging whether the video was found), so nothing is inserted, segmented or uploaded — the `videos.json` checks and both confirmations still run, and each conversion logs the dry-run message instead of running ffmpeg.
2. Probe metadata, locate or extract a cover image, generate a thumbnail.
3. **Segment** the file so each part is ≤ 1.75 GB (`generateVideoSegments` uses `ffmpeg -c copy -f segment`, splitting by computed duration). Segments go to `<videosDirectory>/segments/<name>/`, wiped and regenerated each run.
4. For each segment: build the caption from `postDescription.baseText` (placeholders like `#VIDEO_TITLE`, `#PART_CURRENT`, `#AVAILABILITY` are substituted; all values MarkdownV2-escaped), then upload to the channel. Covers are extracted per-segment only when the source had no cover file.
5. Mark the video `UPLOADED` after all its segments succeed.

The unit of resumability is the whole video (DB status), not the segment — a failure mid-segment re-segments and re-uploads the entire video on the next run.

### `videos.json` metadata

Optional per-directory file describing each video (title, url, availability, upload_date). Generate it from a yt-dlp `--dump-single-json` dump with `./scripts/convertYtdlpJsonToVideosJson.sh [-r] <ytdlp.json>` — a bash + **`jq`** script (no Node involved) that writes `videos_<timestamp>.json` next to the input, so the result must be renamed to `videos.json` by hand; the `-r` flag (short form only, off by default) writes `videos.json` directly instead, skipping the rename but overwriting any existing file. Anything else starting with `-`, or a second input path, is rejected with an error. It detects three dump shapes: an entire channel (`.entries[]` themselves have `entries` → flattened with `.entries | map(.entries[])`), a single tab (`.entries` are already videos) and a single video (the root object itself, wrapped as `[.]`). The flow runs without the file but warns and falls back to using the filename as the title.

## Conventions

- ESM throughout (`"module": "nodenext"`), Node `node:` import prefix, `.ts` files run directly via tsx in dev.
- Biome formatting: single quotes, no semicolons, 2-space indent, 100-col width, no trailing commas. `noFloatingPromises` is an error, `noConsole`/`useAwait` are warnings — use the `logger`/`stepsLogger` (pino), not `console` — and `noConfusingVoidType` is off, so `Return = void` type aliases are allowed.
- TS strict mode plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — array/record access is `T | undefined`, so destructured `[first]` must be null-checked (this pattern is everywhere).
- Enums are `as const` string-tuple arrays with an inferred union type and a `default*` constant; DB enums (`UPLOADED`, `MEMBERS_ONLY`, …) are uppercase, yt-dlp/external values lowercase, mapped in the repository/service transform methods.
- Method parameter/return types belong to the class they serve. `TelegramService` declares them in an `export namespace TelegramService` merged with the class, with one nested namespace per method holding its `DTO`/`Return` — so they are referenced as `TelegramService.UploadVideoToChannel.DTO`, `TelegramService.GetChatData.Return`, `TelegramService.Constructor.Settings`. Every method takes a single DTO object, even the one-field ones (`convertVideoCoverToThumbnail({ videoCoverPath })`). `VideosService` still uses the older top-level `*DTO` exports — prefer the nested namespace form in new code.

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

**Where to explain what:** `CLAUDE.md` is the only one of these files that may discuss implementation, internal technical decisions, tooling and CI. The files meant for the user to read — `README.md`, `README_pt-BR.md`, `presets.example.json` and `.env.example` — must cover **only the user's experience**: the commands they run, the flags and config they write, the prompts they answer and the behavior they observe. Never mention internals, refactors, script/tooling renames or workflow files in them.
