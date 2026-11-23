# Maintaining this fork

This repository is a personal fork of
[`aa2246740/dsh-better-display`](https://github.com/aa2246740/dsh-better-display).
It carries upstream's releases **plus** a set of reading-view features upstream does not
have. The goal is to keep syncing upstream in, so the fork keeps gaining upstream's fixes
without losing its own work.

No pull requests are sent upstream. Each feature was tried there separately and the
outcome is recorded below, so the same work is not attempted twice.

## Remotes and branch

```
origin   https://github.com/aa2246740/dsh-better-display.git   upstream
fork     https://github.com/hansomgar/dsh-better-display.git   this fork
```

The working branch is **`sync/v…`**, named for the upstream release it last absorbed
(currently `sync/v0.4.1`). It tracks `fork/sync/v0.4.1`.

## Syncing a new upstream release

```powershell
git fetch origin
git log --oneline HEAD..origin/main        # what is coming
git switch -c sync/v0.4.2                  # a branch per sync keeps a fallback
git merge origin/main
```

Resolve conflicts with the rules in *Conflict rules* below, then:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Install into the Host profile and restart:

```powershell
$t = "$env:DSH_PROFILE_DIR\node_modules\dsh-better-display"
Copy-Item -Recurse -Force lib\*  "$t\lib"
Copy-Item -Recurse -Force src\*  "$t\src"
Copy-Item -Force package.json,README.md,README.en.md,CHANGELOG.md "$t\"
```

Finally push the branch so the merge is not only on this machine:

```powershell
git push fork sync/v0.4.2
```

## Files only this fork has

These never conflict, because upstream has no counterpart. Do not let a merge drop them.

| Area | Files |
|---|---|
| Turn clock | `TurnClock.tsx`, `turn-clock.ts`, `turn-clock-lane.ts` |
| Picture viewer | `ImageLightbox.tsx`, `ImageThumb.tsx`, `image-group.tsx`, `image-group-order.ts` |
| Picture in a file link | `markdown/local-path.ts`, `markdown/path-box.tsx`, `markdown/picture-placement.tsx`, `markdown/picture-sources.ts`, `markdown/file-glyph.tsx` |
| Tool-argument paths | `tool-path.ts` |
| Their tests | `tests/turn-clock*.test.ts`, `tests/image-band.test.ts`, `tests/image-group*.test.ts`, `tests/tool-path.test.ts` |

`ImageLightbox.tsx` also exists upstream, but with a different shape — see below.

## Conflict rules

Every file that has conflicted before, and which side wins.

### Keep ours in full

| File | Why |
|---|---|
| `src/client/Blocks.tsx` | Our `ImageBlock` renders `SoloImage` from `ImageThumb`; upstream renders a `<dialog>` of its own. Take ours, then re-apply upstream's `imageBlob` change if it is missing (see *Port by hand*). |
| `src/client/markdown/render.tsx` | Our `renderLink` gives a file link its chip **and** the picture underneath, and `pictureSourcesIn` drives the heading shot. Upstream has no equivalent. Take ours, and keep upstream's `freshImageUrl` / `nextImageLoad` if it landed. |
| `src/client/ImageLightbox.tsx` | Ours takes a `SharedViewer` and pages `‹ 1/N ›`; upstream's takes `open`/`src`/`alt`/`caption`/`onClose` and has no pager. Take ours, then re-apply upstream's interaction fixes from *Port by hand*. |
| `src/client/Reader.module.css` | Ours carries the minimap, pager, stage and clock rules. Take ours, and add upstream's `.imageDialog[open]` if it is absent. |
| `CHANGELOG.md`, `README.md`, `README.en.md` | The fork's own text and version; upstream's release notes stay below ours. |
| `package.json`, `package-lock.json` | Keep `version` = the fork's own (see *Versioning*), not upstream's. Everything else follows upstream. |

### Take upstream in full

| File | Why |
|---|---|
| `src/client/platform-media.ts` | Upstream resolves through the Host's `resolveWorkspacePath` / `fileMediaUrl` and refuses UNC and device paths. The exported surface matches, so ours is a strict subset. |
| `src/client/image-source.ts` | Upstream built on this fork's dual-contract `readAttachment`. Their version keeps it and adds the closed-session fix and the single byte copy. |
| `src/client/index.tsx` | The two-contract `fileMentions` adapter and the `chatNodeOwner` extraction are upstream's. Re-add only the `clockLane` getter (below). |
| `src/client/chat-node-owner.ts`, `OfficialContent.tsx` | Upstream's shared owner builder. |
| `src/client/word-motion.tsx` | Formatting only. Re-add the `openFile` prop (below). |
| `package-lock.json` dependency sections | Never hand-merge; take upstream's, then restore the root `version`. |

### Always re-add after a merge

A merge that takes upstream for these files silently drops the wiring the fork needs.
Check each one every time:

1. **`src/client/index.tsx`** — the `clockLane` getter inside `inject`, and `'sidebarRight'`
   in the exported `inject` list. Without the getter the running clock never appears;
   without the inject entry the file chip cannot open the preview panel.

   ```ts
   get clockLane() {
     const lanes = ctx.get('betterDisplayClockLanes') as ClockLanes | undefined
     return lanes?.get(sessionId)
   }
   ```

2. **`src/client/word-motion.tsx`** — `MotionMarkdown` must accept `openFile` and pass it
   to `MarkdownText`, or a file chip's click has nowhere to go.

3. **`src/client/Reader.tsx`** — the clock publish effect and its cleanup, and
   `isAwaitingModel ? 'running' : turnPhase(...)` for the phase.

4. **`src/client/Reader.module.css`** — `.imageDialog[open]`, `.imageStage`,
   `.imageStageInner`, `.lightboxPager`, `.lightboxNav`, `.lightboxCounter`,
   `.lightboxMinimap`, `.lightboxViewBox`.

## Port by hand

Upstream improves the picture viewer between releases. Take these because they are
behaviour fixes, not design choices:

- ignore a horizontal wheel (`deltaY === 0`), or a sideways trackpad swipe zooms;
- clear the "已复制" timer on unmount;
- leave `Ctrl`/`Cmd`/`Alt` chords to the browser.

Do **not** take upstream's `fitSize`. It redefines 100% as "fit the viewport"; this fork
keeps 100% = the picture's real pixels, so a dense screenshot can be read at native size.

## Behaviour this fork keeps on purpose

- 100% zoom means the picture's real pixels, not fit-to-viewport.
- A closed turn shows success only when the Host reports `completed`. `aborted` and
  `interrupted` show 本轮求索已停止; `error`, `blocked` and `max-tokens` show
  本轮求索未完成, both with an amber dot.
- The clock stops ticking while the browser tab is hidden and catches up the moment it is
  shown again.
- Each session has its own clock lane, so two open sessions cannot overwrite each other.
- The dock row registers at `order: 15` — below `ui-goal` (10) and above the queue dock
  (20), sharing a rank with neither.

## Versioning

The fork's version is derived from the upstream release it last absorbed, so the number
says which upstream a build is based on.

    mine.minor = upstream.minor + 10
    mine.major = upstream.major
    mine.patch = upstream.patch

| Upstream | This fork |
|---|---|
| `0.4.1` | `0.14.1` |
| `0.5.0` | `0.15.0` |
| `0.6.1` | `0.16.1` |

The `+10` keeps every fork release **greater** than the upstream it is built on, so npm
and the Host's plugin manager treat it as an upgrade. It also cannot collide with a later
upstream release in the same minor line.

Set it in three places, and nowhere else:

- `package.json` → `version`
- `package-lock.json` → the root `version`, and `packages[""].version`

Do **not** rewrite other `"version"` lines in `package-lock.json`: those belong to
dependencies. In 0.14.1 the entries at `@deepseek-ai/cordis` and `mdast-util-phrasing` both
read `4.1.0`, which is a coincidence with the fork's previous number, not the fork.

Two rejected alternatives, for the record:

- **`0.4.1.1`** — not valid semver. `semver.valid('0.4.1.1')` is `null`, and both npm and
  the Host installer reject it.
- **`0.4.1-1`** — valid, but semver sorts a prerelease *below* its release, so
  `0.4.1-1 < 0.4.1`. Installing it after upstream's `0.4.1` would read as a downgrade.

## Verification after a sync

```powershell
npm run typecheck        # tsc
npm run lint             # eslint --max-warnings 0
npm test                 # expect 418 passed, 0 failed at 0.14.1
npm run build
```

`src/client/markdown/render.tsx` sits at the 955-line `max-lines` cap. New code there
usually means compressing a comment or moving a helper out; the lint failure states the
line count. Free savings: merge a wrapped comment, or drop a blank line between blocks.

`tests/skill-status.test.ts` used to fail on Windows over a drive-letter assertion.
Upstream fixed it in `20bb768` (v0.4.1), so the suite is green from that release on.

## Line endings

`.gitattributes` pins `lib/**` and all sources to `eol=lf`. The object store was always
LF; the CRLF came from a Windows checkout with `core.autocrlf=true`. With the attribute in
place a rebuild cannot commit CRLF, whatever platform produced it.

## History: what upstream did with this fork's work

| Attempt | Outcome |
|---|---|
| PR #95 — 14 commits (image loading, paths, turn clock, viewer) | Closed. Upstream cherry-picked only the `readAttachment`/image-loading commit via #98, and the Windows `skill-status` fix via #107. |
| PR #106 — the picture viewer alone | **Merged** as #108, after upstream added review fixes (`e06cbfd`, `63eea0e`) on top. |
| PR #105 — the turn clock alone | Closed. Upstream's reason: the reading view already shows turn status and timing in three places (`WaitingStatus` + `WaitClock`, the sticky `GroupStatus`, and `TurnMetrics` + `MessageClock`), and `DESIGN.md` says completed history stays static. They listed six implementation problems; all six are fixed in this fork. |

The lesson from that history: upstream accepts small, self-contained PRs. The fork keeps
the features regardless, and only syncs.
