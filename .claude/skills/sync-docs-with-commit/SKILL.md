---
name: sync-docs-with-commit
description: Bring a repository's documentation files in line with its most recent commit — read HEAD's diff, work out what actually changed for a reader, and revise only the doc sections that the change makes wrong or incomplete. Use this whenever the user asks to update/sync docs after committing, says something like "I just committed X, update the docs", asks which documentation a commit affects, mentions that the README or examples are out of date relative to the code, or asks to document a feature they just finished — even if they never use the word "documentation". Discovers which files count as documentation by reading CLAUDE.md, and when CLAUDE.md doesn't say, proposes candidates, asks the user to confirm, and records the answer in CLAUDE.md so later runs skip the question
---

# Sync docs with the last commit

Docs rot one commit at a time. A flag gets added, a default changes, a script gets
renamed — and the README keeps confidently describing the old behavior, which is worse
than saying nothing. This skill closes that gap for a single commit: HEAD.

Two rules shape everything below:

- **Propose before writing.** Doc edits are judgement calls about wording and scope, so
  the user gets a look before anything is written to disk.
- **Touch only what the commit made wrong.** A doc-sync pass that also "improves" unrelated
  prose produces a diff the user can't review at a glance, and hides the real change.

## Workflow

### 1. Read the commit

Strictly HEAD — not "the user's last commit", not staged work. If the user clearly means
something else (a range, a PR, uncommitted work), follow what they asked and say which
revision you used.

```bash
git log -1 --stat
git show HEAD --patch
```

If HEAD is a merge commit, `git show` prints little or nothing; use
`git show HEAD -m --first-parent --patch` and say that you analyzed a merge.

A diff shows changed lines, not meaning. For every non-trivial hunk, read the current
version of the file around it — you need the surrounding function, the type it belongs to,
the default value it falls back to. Documenting a flag as a boolean when the diff hunk
merely hid its `.default(false)` is the classic failure here.

### 2. Find out which files are documentation

**First, look in CLAUDE.md** — root `CLAUDE.md`, `.claude/CLAUDE.md`, and any nested ones
that apply to the changed paths. You're looking for a section that names the repo's
documentation/example files; it's typically a table or list under a heading mentioning
documentation, but don't insist on an exact heading — the user may have worded it their own
way. Read whatever prose surrounds it too, because that's where cross-file rules live
("the two READMEs must stay in sync", "this example must remain valid JSON").

If such a section exists, use it as the authoritative list and skip to step 3. If a listed
file no longer exists, mention it rather than silently dropping it.

**If nothing in CLAUDE.md declares the docs**, build a candidate list from the repo and ask.
Candidates worth proposing:

- `README*` in any language variant (`README_pt-BR.md`, `README.es.md`, …)
- everything under a docs directory (`docs/`, `doc/`, `documentation/`, `website/`, `wiki/`)
- top-level guides: `CONTRIBUTING`, `ARCHITECTURE`, `CHANGELOG`, `MIGRATION`, `SECURITY`, `FAQ`
- agent/assistant instruction files: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`
- example and template config the user is expected to copy: `*.example.*`, `.env.example`,
  `*.sample`, `presets.example.json`
- interface contracts read by humans: OpenAPI/Swagger specs, `man/` pages, JSON schemas
- site config that carries prose (`mkdocs.yml`, `docusaurus.config.js`) — usually only
  relevant when nav structure changes

Use `git ls-files` so ignored and vendored paths never appear. Leave out `LICENSE`,
lockfiles, generated migrations, and anything a tool rewrites (release-managed changelogs,
generated API reference) — offering those invites edits that the next build will overwrite.

Ask with the AskUserQuestion tool, multi-select, one option per candidate, ordered
most-likely-first with a short note on what each file appears to document. If the list is
long, group the obvious ones ("all 12 files under `docs/`") into a single option rather than
flooding the prompt. Let the user add paths you missed.

**Then record the answer in CLAUDE.md** so this question is asked once per repo, not once
per commit. Append (or extend) a section in the style the file already uses:

```markdown
## Documentation / example files

These are the **documentation / example files** of this repo. When asked to "update the
docs" (with no files specified), review and update all of them:

| File | What it documents |
|---|---|
| `README.md` | User-facing docs, English |
| `.env.example` | Template for the gitignored `.env` |

<any cross-file consistency rules the user mentioned>
```

Match the surrounding file's tone and formatting; if CLAUDE.md doesn't exist, create it with
just this section. Say that you saved it, so the user knows why they won't be asked again.

### 3. Turn the diff into reader-facing facts

Go through the change and write down what a reader of the docs would need to know
differently. The useful categories:

- new/changed/removed CLI flags, subcommands, env vars, config keys — and their defaults
- new required setup: a binary on PATH, a service, a migration, a new file to create
- behavior changes at the boundary: what gets skipped, retried, logged, or written where
- renames and moves of anything a doc points at (scripts, paths, commands, exported names)
- architecture facts an agent-instruction file states, when the commit invalidates them

Refactors with no reader-visible effect belong in this list too — as "nothing to document".
Recognizing that is a real outcome, not a failure to find work.

### 4. Locate the affected sections

For each fact, grep the confirmed doc files for the terms involved: the flag string, the
config key, the old path, the function name, the old default value. That's how you find the
sentence that is now wrong, instead of appending a new paragraph next to it and leaving the
contradiction in place.

Also check for places the fact *should* appear but doesn't — a new flag missing from a flags
table, a new env var absent from `.env.example`. Both are in scope: contradiction and gap.

Respect what each doc is. Translated READMEs get edits written in their own language, at the
same position, so the two stay equivalent. Example config files must keep validating against
whatever schema governs them, and stay parseable (no comments in `.json`). A commented
example embedded in a README has to keep matching its real counterpart.

### 5. Propose, then apply

Present the plan as a compact table — file, section/anchor, and the substance of the change
— followed by the docs you're deliberately leaving alone and why. For anything longer than
a sentence, show the actual proposed wording; "update the flags section" is not reviewable.

If the commit's intent is genuinely ambiguous (a value changed with no hint whether it's now
the documented recommendation, or a feature landed half-finished), ask rather than guess.
Inventing plausible documentation for behavior that doesn't exist is the worst outcome this
skill can produce.

After approval, apply the edits with Edit, keeping each one minimal and in the file's
existing voice. Then report per file what changed. Don't stage or commit unless the user
asks — they may want to fold the docs into an amend, or keep them separate.

## Example

Commit `feat: add dry run flag` touches `src/config/args.ts` (adds `-d/--dryRun`, boolean,
default `false`) and `src/usecases/UploadVideos.ts` (when set, the per-video loop stops after
the DB lookup — nothing is inserted, segmented, or uploaded, but the pre-flight checks and
the confirmation prompt still run).

Proposal:

| File | Section | Change |
|---|---|---|
| `README.md` | CLI flags table | Add `-d, --dryRun` row: boolean, default `false` |
| `README.md` | Upload flow, step 1 | Note that under `--dryRun` the loop stops after the lookup; checks and the confirm prompt still run |
| `README_pt-BR.md` | same two places | Equivalent edits, in Portuguese |
| `CLAUDE.md` | CLI flags + Upload flow | Same two facts, phrased for an agent |

Unchanged: `presets.example.json` and `.env.example` — the flag is CLI-only and adds no
preset field or environment variable.

Note what this gets right: the flag's default is stated (it came from reading `args.ts`, not
the hunk), the behavior note is specific about what still runs, the translated README is
updated in its own language, and two files are explicitly ruled out with a reason.
