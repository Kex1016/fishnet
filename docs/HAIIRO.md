# The haiiro look: the frozen contract

Fishnet wears the haiiro design system (haiiro.moe/~cakes): Rosé Pine on one dark theme, a bitmap face,
square corners, terminal windows, dither instead of blur and fades. The One Soul section is the same system
in Gruvbox dark. This file is the contract every unit of the redesign builds on (H0, 23 Nov 2026): token
names, class names, component props and where each lives. A unit that needs one of them changed asks the
coordinator; it does not edit the file it does not own.

Sources: the haiiro design system artifact (its Fishnet group) and the mockup canvas. The old Fishnet design
system artifact is an archive and no longer a source.

## Decisions (David, 23 Nov 2026)

- Rosé Pine everywhere; One Soul is Gruvbox dark through the realm scope.
- One dark theme. No light theme, no toggle, no `theme` cookie. Screenshots are dark only.
- Every font is served by the site (`src/lib/design/fonts/README.md`). No request to Google Fonts.
- The realm transition is a dithered circle at 12 fps, about one second. Reduced motion and browsers without
  View Transitions swap the realm in one frame.
- The map keeps the real squaremap tiles, never dithered. Only what sits on top changes.

## Files

| File | What |
| --- | --- |
| `src/lib/design/fonts.css` | `@font-face`: IBM VGA 8x16 (400, and its 2x face as 700), Jacquard 24, Unifont and its UI slice |
| `src/lib/design/tokens.css` | every token, and the realm scope |
| `src/lib/design/base.css` | reset, element defaults, haiiro's own parts (window, ink, stat panel, progress, chip, list rows, segmented, ink buttons, keycap, dither) |
| `src/lib/design/components.css` | the Fishnet parts, `fx-` |
| `src/lib/design/types.ts` | the data shapes the components take |
| `src/lib/design/*.svelte` | the components below, exported from `index.ts` |
| `src/lib/design/dither.ts` | `BAYER4`, `bayer(x, y)`, `inCircle(t, d, x, y)`, `REALM_TRANSITION`, `hexTone` |
| `src/lib/design/blobs.ts` | the blob backdrop (`startBlobs(canvas)`); `Blobs.svelte` renders it |
| `src/lib/design/shell.ts` | `promptPath`, `sectionPath`, `titleEm`, `pagerSteps` |
| `src/routes/+layout.svelte` | the shell; every page renders inside `.fx-main` |
| `src/routes/design/` | the preview of every part (dev and mock only) |

The CSS is imported once, by the root layout. A page or component never imports it again.

## Tokens (`tokens.css`)

Components read tokens, never a colour. The realm scope redefines the colour tokens, so a component written
for the regular site is right in One Soul without a line of its own.

- Colour: `--color-base` (the night sky), `--color-surface` (window fill), `--color-overlay` (raised layers,
  selected rows), `--color-muted` (labels only, 3.4:1), `--color-subtle` (secondary text, 5.5:1),
  `--color-text` (body text and hairlines), `--color-love` (failed, critical, the dead), `--color-gold`
  (commands, the one action, needs you, rank 1, the living soul), `--color-rose` (narration, the » arrow),
  `--color-pine` (frames, the wordmark, the current thing; 24px and up or borders), `--color-foam` (paths,
  window headings, values, chart marks), `--color-iris` (files and arguments, a second measure, rank 2),
  `--color-highlight-low|med|high`.
- Ink at a share of text: `--ink-muted` (55%: kv labels, captions, as-of), `--ink-hairline` (25%: dividers),
  `--ink-track` (14%: the empty part of a bar). `--veil-heavy` (under the dither veil), `--clearing-fill`
  (text over the blobs without a window).
- `--realm-*`: the Gruvbox values. Never used by a component directly.
- Type: `--font-mono` (IBM VGA 8x16, then Unifont: everything), `--font-display` (Jacquard 24: the page
  title and the lede's drop cap only).
- Space: `--space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-6` 24, `-8` 32, `-12` 50, `-20` 80 (px).
- Shape: `--radius-none` (every corner is square), `--border-hairline` 1px, `--border-divider` 3px,
  `--border-window` 5px (always double), `--shadow-title` and `--shadow-art` (hard 8px offset, no blur).
- Sizes: `--bar-height` 48px (52px under 720px), `--side-width` 240px, `--dither-tile` 4px, `--touch` 44px,
  `--chart-column` 24px (a column is at most this wide).
- `--realm-transition-fps|duration|cell|band`: 12, 1s, 8px, 0.22 (the same numbers as `REALM_TRANSITION`).
- `--mc-*`: Minecraft chat colours on a dark ground, for the segments renderer.

### The realm scope

`<html data-realm="onesoul">` (set by `hooks.server.ts` for `/one-soul` and below, switched by
`src/lib/onesoul/transition.ts` on navigation) or the class `.realm` on any element maps every colour token
to Gruvbox. `.realm` also paints its own ground, so a preview card of One Soul on a regular page works.

### Not there any more

`data-theme`, the `theme` cookie, `Locals.theme`, `ThemeToggle`, `Mark`, Lucide icons (the package is gone),
`src/lib/onesoul/realm.css` (the realm is tokens now), `src/app.css` and the four old font packages. Since H11
also `legacy.css`, `Card.svelte`, the old `fp-` and `t-` classes and the old token names (`--bg`, `--surface`,
`--acc`, `--font-head`, …): nothing defines them, so a page that uses one renders unstyled.

## Type

Everything is IBM VGA 8x16 at 16px, line height 1.15; 12px and 14px for small text. `<b>` and
`font-weight: 700` switch to the 2x face (twice as wide); the browser never fakes a bold or an italic, and
nothing is smoothed. Jacquard 24 is for the page title (`.fx-head .title`) and the lede's drop cap, nothing
else (David, 23 Nov 2026). Window headings are IBM VGA in upper case, foam (`.fx-wh h2` 16px, `h3` 14px); the
wordmark, big readouts and tile values (`.fx-read .big`, `.fx-tiles .kv_value`, `.fx-pos-big`) are IBM VGA at
32px, the living soul's name at 64px, the side nav's group labels at 12px. Characters outside CP437 (★ – … ‹ › ő, kanji) come from Unifont on the same
grid; the interface's own characters are in a small slice, the whole font loads only when a page shows
something outside it.

Copy rules stay: English, sentence case, no exclamation marks. Page titles and section words in the page
head and the side nav are lower case ("players", "one soul"); a name keeps its own spelling.

## The shell (`src/routes/+layout.svelte`)

```html
<div class="fx">                      <!-- .fx-open while the menu drawer is open -->
  <div class="fx-blobs"><canvas/></div>     <!-- Blobs.svelte, fixed behind everything -->
  <header class="fx-bar">               <!-- sticky -->
    <a class="fx-brand">fishnet</a>
    <nav class="fx-where">@ fishplex » cd ~/players/…</nav>   <!-- every part a link -->
    <span class="grp"><span class="fx-live">7 online</span><time class="clock">22:31 CET</time><button class="ink c5 fx-menu">menu</button></span>
  </header>
  <nav class="fx-strip">…</nav>         <!-- under 960px: the pages as a scrolling strip -->
  <div class="fx-body">
    <button class="fx-scrim"></button>  <!-- the drawer's veil: inside .fx-body, so the drawer stacks above it -->
    <aside class="fx-side" id="site-nav"><nav class="window">…</nav></aside>   <!-- the rail (sticky); the drawer under 960px -->
    <main class="fx-main" id="main">{page}</main>
  </div>
  <div class="fx-peek"><img/></div>    <!-- Peek.svelte, only while a picture is peeked -->
</div>
```

- `.fx-main` is a column with a 48px gap (36px on a phone). A page renders its parts straight into it: a
  `PageHead`, then `Window`s and `.fx-grid`s. No page wrapper, no max width.
- Nav entries come from `src/lib/nav.ts` (`NAV`, groups now labelled Network, Stats, Games, Site). The
  quiet count beside Servers and Players is from `/v2/network` and `/v2/players`, nothing else.
- The bar's online count is `/v2/network` `total_online` (hidden servers already taken out); it is left out
  while cakeutils is down. The clock is the visitor's zone and names it.
- Breakpoints: 960px (the rail becomes the strip and the menu drawer), 720px (phone: one column, smaller
  display sizes, the prompt and the clock leave the bar).
- **Stage mode.** A page whose content is a stage puts `.fx-stage` (or the map's `.mc-stage`) as a direct
  child of `.fx-main`. The shell then becomes the bar plus the stage: no blobs, no strip, no rail (the menu
  button opens the nav as a drawer), the stage fills the window under the bar and the page does not scroll.
  Until H9 rebuilds it, the One Soul round map in its frame (`.fx-main > .os-frame > .rm-stage`) counts too.
- What stays in view while the page scrolls (David, 24 Nov 2026): the bar always; the rail above 960px
  (sticky under the bar, scrolling on its own when the window is short); the strip under 960px (sticky
  under the bar; an open drawer stacks above it).
- **Picture peek** (`Peek.svelte`, `peek.ts`, `.fx-peek`). A picture in `.fx-main` drawn 48px or smaller
  (heads, item and advancement icons; not the map's stage) is shown at 128px beside itself after 120 ms of
  mouse hover, or at once when keyboard focus lands on the link around it. A head shows the player's full
  skin (`/img/skin/<uuid>.png`, 128x256), falling back to the head. It opens as a dithered circle from the
  corner nearest the picture, 8px cells, 6 frames at 12 fps; reduced motion or no CSS masks: one frame.
  Leaves on pointer out, blur, Escape, scroll, resize and navigation. Touch gets no peek. Decorative
  (`aria-hidden`).
- The skip link (`.fx-skip`) jumps to `#main`. The drawer closes on navigation, on Escape and on the veil.

## Classes

haiiro's own (`base.css`):

| Class | Use |
| --- | --- |
| `.window` (+ `.gold` `.love` `.foam`, `.fx-off`) > `.section-header` + `.content` (+ `.foot`) | the terminal pane; the frame colour carries meaning |
| `.title` (`.shadowed`) | a display title |
| `.c1`…`.c8` | ink: muted, love, gold, rose, pine, foam, iris, base. `a.c2`… are inverse links (a filled band) |
| `.ink` (+ `.c1`…`.c7`, `.flat`, `.on`, `:disabled`/`[aria-disabled]`) | buttons and button-like links; gold (`.ink.c3`) is the one action |
| `.list` > `.li` (`.sel` or `[aria-current]`) > `.mk` `.grow` `.meta` | list rows; the current one gets an overlay band and a rose » |
| `.seg` > span/a/button (`.on`, `[aria-current]`, `[aria-pressed=true]`) | a choice of a few words, the current one on pine |
| `.stat-panel`, `.kv`, `.kv_label`, `.kv_value`, `.stat_block`, `.stat_sub` | the hairline stat grid |
| `.progress` > `.progress_head` (`.progress_num`) + `.progress_track` > `.progress_fill` | a bar with a label |
| `.chip` (`.on`), `.badge`, `.kbd`, `.lab`, `.cap`, `.placeholder`, `.hr`, `.code`, `.num` | small parts |
| `.spark` (`.iris`) > `i` | a sparkline of squares |
| `.veil` (`.heavy`), `.dith` (`.lo` `.pine` `.big`) | dither |
| `.r2`…`.r6` | sets `--rarity` (love, pine, foam, iris, gold) for a framed picture |

Fishnet's (`components.css`), markup as the design system's Fishnet group draws it:

| Class | Use | Owner of the component |
| --- | --- | --- |
| `.fx-head` > p (prompt) + `h1.title` + `.lede` + `.c1` + `.seg`/`.fx-filters`/`.fx-head.row` | the page head | H0 `PageHead` |
| `.fx-wh` > h2/h3 + `.asof` | a window's heading line | H0 `WindowHead` |
| `.fx-grid` (`.three`, `.wide`), `.fx-stack` | layout | pages |
| `.stat-panel.fx-tiles` > div/a (`.off`) > `.kv_label` `.kv_value` (`small`) `.note` `.spark` | stat tiles; `.off` (dashed, muted) is `StatTile`'s `off` prop, for a server that is not linked | H1 `StatTile` |
| `.fx-cols` (`.iris`) > i (`.now`), `.fx-axis`, `.fx-steps`, `.fx-read` > `.big` `.cap` | column and step charts | H1 `ColumnChart`, `LineChart` |
| `.fx-heat` > span + i.h1…h4, `.fx-legend` | the heatmap | H1 `Heatmap` |
| `.fx-scroll` > `table.fx-table` (`td.r`, `tr.sel`/`[aria-current]`) | tables; cells and headers never wrap, so a wide table scrolls inside `.fx-scroll`: always wrap a table in it | H1 `DataTable` |
| `.fx-rank` (`.compact`, `.bare`) > `.row` > `.pos`(.g .i .f) face `.who` `.bar` > i `.val` | ranked rows; the bar goes on a phone and in a list narrower than 440px (a container query) | H0 `RankList`; H1 `BarList` renders it |
| `.fx-feed` > `.li` > `.pic`/face `.txt` (`.sub`) `.when` | feeds | H0 `Feed`, `FeedRow` |
| `.fx-turns` > span/a (`.reached` `.now` `.locked` `.dead`) | ladders and One Soul turns | H0 `Ladder` |
| `.fx-sheet` > `.kv_label` + value | key/value sheet | H0 `KeyValueSheet`, `KV` |
| `.fx-cat` > a > span (`.pic`) + `.meta` | a catalogue grid | H0 `Catalogue` |
| `.fx-face` (`.sm` `.lg`, `.p` `.i` `.r`, `.gold` `.love`) > img, `.fx-faces` > a | faces | H0 `Face` |
| `.fx-player` > face `.who` `.on` | face and name as a link | H0 `PlayerName` |
| `.fx-slot` (`.lg`, `.r2`…`.r6`) > img or `.dith` | a framed picture | H0 `Slot` |
| `.fx-pager` | paging | H0 `Pager` |
| `.fx-filters`, `.fx-search` > `.c4` » + input | filters and search fields | pages |
| `.fx-notice` (`.love` `.foam`) > b + span | notices | H0 `Notice` |
| `.fx-empty` > b + text (`.since`) | empty states | H0 `EmptyState` |
| `.asof` (`.stale`) | as-of times | H0 `AsOf` |
| `.fx-soul` > face + `.name` | the living soul | H8 |
| `.fx-stage`, `.fx-land` `.fx-water` `.fx-area` `.fx-pin` `.fx-who` `.fx-float` `.fx-coords` `.fx-zoom` `.fx-sheetbar` `.fx-check` | the map stage and what floats on it | H7 |
| `.fx-prose` | long text (about) | pages |
| `.fx-trip` | the realm transition demo | H9 |
| `.hide-desk`, `.hide-phone`, `.fx-sep`, `.fx-pos-big` | helpers | |

Text straight on the blobs (`.fx-head > p`, `.fx-main > p`) gets a base band behind it; anything else sits
in a window. Hover is a step (a band or an ink change), never a transition.

## Components (`src/lib/design/`, exported from `index.ts`)

Props are frozen. Optional props may be added; none is removed or renamed without the coordinator. Every
string is rendered as text.

| Component | Props |
| --- | --- |
| `Window` | `shell = "fish"`, `path?` (no label without it), `args?`, `tone: WindowTone = "pine"` (`pine gold love foam off`), `tag = "section"` (`div nav aside article`), `id?`, `label?` (aria-label), `foot?: Snippet`, `children` |
| `WindowHead` | `title`, `href?`, `level: 2 \| 3 = 2`, `asof?: string`, `id?`, `children?` (the right side, instead of `asof`) |
| `PageHead` | `path?` (prompt place, "fishplex"), `cmd = "cat"`, `args?`, `title` (lower case words, or a name), `lede?` (rose narration), `note?` (quiet line), `children?` (switches) |
| `PromptLine` | `path = "fishplex"`, `cmd`, `args?`, `tag = "p"`, `class?` |
| `Segmented` | `label` (aria), `options: SegmentedOption[]` (`{ href?, label, current?, title? }`) |
| `ScopeSwitch` | `url: UrlLike`, `scope: Scope`, `servers: { id, display_name }[]`, `minis?: { server, id, display_name }[]` |
| `Pager` | `url: UrlLike`, `total`, `limit`, `offset`, `what = "rows"`, `prev = "prev"`, `next = "next"`, `numbers = true` |
| `Face` | `uuid`, `name?`, `size: "sm" \| "md" \| "lg" = "md"` (20, 32, 128px; 96px on a phone), `tint?: "pine" \| "iris" \| "rose"`, `frame?: "gold" \| "love"` |
| `PlayerName` | `uuid`, `name`, `size: "sm" \| "md" = "sm"`, `online?` |
| `Slot` | `icon`, `name?`, `size: "md" \| "lg" = "md"`, `rarity?: Rarity` |
| `RankList` | `rows: RankRow[]` (`{ key, rank, label, href?, uuid?, share?, value, sub?, current? }`), `compact = false`, `label?` |
| `Feed` | `label?`, `children` (FeedRows) |
| `FeedRow` | `icon?`, `uuid?` (a face instead of a picture), `rarity?`, `href?`, `when?`, `sub?: Snippet`, `children` (first line) |
| `Ladder` | `steps: LadderStep[]` (`{ key?, label, state: reached next locked dead now plain, title?, href? }`), `label` |
| `KeyValueSheet` | `rows?: SheetRow[]` (`{ label, value, num?, ink? }`), `children?` (KVs) |
| `KV` | `label`, `num = false`, `children` |
| `Catalogue` | `items: CatalogueItem[]` (`{ href, label, meta?, icon?, current? }`), `pic = false`, `label?` |
| `Progress` | `label`, `value?`, `share` (0..1), `ink?` (a `cN` class), `indent = 0` |
| `Notice` | `kind: info success warning error = "info"`, `word?` (the leading word; each kind has one), `children` |
| `EmptyState` | `title`, `line?`, `since?` ("Recording since 4 Nov 2026"), `children?` |
| `AsOf` | `at` (epoch ms), `stale = false` |
| `Blobs` | none; the shell renders it once |

Rules the components keep, and pages using the classes directly keep too:

- A `share` (bar width) is a share inside one scope. Never add scopes together.
- State is never colour alone: a ladder step has a title, a notice a word, an off window says so.
- `RankList` puts a ★ before the top three and gives them gold, iris and foam.
- The three answers for "not happened yet" stay as PLAN §2.2 says; `EmptyState` is the empty list.
- Faces are the real head in the frame, nearest neighbour, not dithered: an 8×8 head does not survive a
  two-tone dither. The frame's dither shows while it loads and behind a transparent head.

## Motion

No easing, no slides, no fades. The blob backdrop runs at 30 fps at most, pauses while the tab is hidden and
is one still frame under `prefers-reduced-motion: reduce`. The realm transition steps at 12 fps (H9 owns
`transition.ts`; `dither.ts` has the numbers and `inCircle`).

## Checks

- `tests/design.test.ts`: the dither, the blob tones, the shell helpers. `tests/peek.test.ts`: the peek's
  frames, its placement and the head → skin route.
- `tests/e2e/checks.ts` "one dark theme": no theme attribute or toggle; `data-realm` is empty on the
  regular site and `onesoul` in the section.
- The map checks measure the stage against `.fx-main` and the document (stage mode).
- Screenshots: `bun run shots --base <url> --out docs/screenshots/<unit>/busy <paths>`, dark only;
  `--reduced` for the still blob frame.
