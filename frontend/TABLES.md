# Table Guidelines

Rules for data tables in this app. Any table (or flexbox pseudo-table) should be
compared against these rules and adjusted to match. Reference implementations,
in order of authority:

- `src/pages/leaderboard/recent-games.tsx` — card table (narrow widget)
- `src/pages/leaderboard/recent-achievements.tsx` — card table with avatars/icons
- `src/pages/recent-games/recent-games-page.tsx` — full-page table

## 1. Structure

Always a real HTML `<table>` — never flexbox rows with fixed widths (`w-24`,
`w-40`, …). Native auto table layout is what makes columns size to their widest
cell.

```jsx
<div className="bg-primary-background rounded-lg w-full overflow-hidden">
  {/* optional title/link header */}
  <table className="w-full text-primary-text border-collapse">
    <thead>…</thead>
    <tbody className="divide-y divide-primary-text/50">…</tbody>
  </table>
</div>
```

- Wrapper: `bg-primary-background rounded-lg w-full overflow-hidden` (the
  `overflow-hidden` clips row hover backgrounds to the rounded corners).
- Table: `w-full text-primary-text border-collapse`. No `table-fixed`.

## 2. Column sizing — the core pattern

Every column is one of two kinds:

**Hug columns** — short data that must never truncate: numbers, points, scores,
relative times.

```jsx
<td className="py-1 px-2 text-right w-[1%] whitespace-nowrap">…</td>
```

The `w-[1%]` hint makes auto layout shrink the column to exactly its widest
cell; `whitespace-nowrap` stops it wrapping. Multi-word headers over hug columns
("Elo won", "W pts") also need `whitespace-nowrap` or they wrap to two lines.

**Flexible columns** — free text that absorbs remaining space and truncates
with `…` when tight: player names, titles.

```jsx
<td className="py-1 px-2 w-[35%] max-w-0">
  <div className="truncate">🏆 {name}</div>
</td>
```

`max-w-0` lets the cell shrink below its content; the inner block element with
`truncate` does the ellipsis. Never put `whitespace-nowrap` on a flexible cell.

- Split the percentage roughly evenly between flexible columns (two names →
  `w-[35%]`/`w-[35%]` in a 4-col table, `w-[30%]` each in a 5–6-col table,
  `w-[50%]`/`w-[50%]` in a 3-col table). Hug columns take their space first, so
  the exact numbers only control how leftover space is shared.
- The table must never exceed its container: no horizontal page scroll, no
  clipped last column, ever. Truncation is always preferred over overflow.

**Flexible cell containing an avatar or icon** (flex row inside the cell):

```jsx
<td className="py-1 px-2 w-[45%] max-w-0">
  <div className="flex items-center gap-2 min-w-0">
    <ProfilePicture … />              {/* has shrink-0 internally */}
    <span className="truncate">{name}</span>
  </div>
</td>
```

`truncate` goes on the text span, `min-w-0` on the flex container (without it
flex refuses to shrink below content). Fixed-size items (avatars, icons) must
be `shrink-0` so they never squish.

Right-aligned flexible cells: keep the same structure and use
`justify-end` on the flex container, or `text-right` on the truncating div.

**Tail-visible truncation** — for sequence columns where the _latest_ entry
must always stay readable (e.g. a chronological list of rank changes
"+4, +5, −1, …"), truncate from the start instead: ellipsis on the left, end
of the content visible.

```jsx
<div className="truncate" dir="rtl">
  <bdi dir="ltr">{changes.join(", ")}</bdi>
</div>
```

`dir="rtl"` on the truncating element moves the overflow/ellipsis to the left
edge; the `<bdi dir="ltr">` wrapper isolates the content so its characters keep
normal left-to-right order. Note this right-aligns the content when it fits —
appropriate for a trailing column.

## 3. Breakpoints and text sizes

Breakpoints used by tables: **`xs` = 470px** (custom, in `tailwind.config.js`)
and **`md` = 768px**. Do not gate table sizing on `lg` (1024px) — the largest
style must arrive already at `md`, and the middle step at `xs`. Sizes change in
moderate steps; never jump e.g. 10px → 18px between adjacent breakpoints.

| Context                                      | Row text                          | Secondary text (times, meta)      |
| -------------------------------------------- | --------------------------------- | --------------------------------- |
| Card tables (leaderboard column, ~450px max) | `text-sm xs:text-lg md:text-xl`   | `text-xs xs:text-sm md:text-base` |
| Full-page tables                             | `text-xs xs:text-sm md:text-base` | one step below row text           |

- Floor: nothing below 12px (`text-xs`); primary row text not below 14px
  (`text-sm`) in card tables.
- Cell padding on full-page tables scales too: `py-1 px-1 xs:px-2 md:px-3`.
- Non-Tailwind size switches (e.g. `useMediaQuery` for avatar px sizes) follow
  the same breakpoints: switch at 768, not 1024.

## 4. Headers

- Real `<th>` in `<thead>` — this is what guarantees header/column alignment.
- **Same font as the column content**: same size classes, same color
  (`text-primary-text`, full opacity — no `/70` muting), and the same weight as
  the cells they label, per column (a header over `font-medium` numbers is
  `font-medium`; over `font-light` cells it is `font-light`). Set the weight
  explicitly on each `th` — browsers default `th` to bold.
- Alignment matches the column: `text-left` over left-aligned cells,
  `text-right` over right-aligned.
- Headers are cells too: a column is as wide as its widest cell _including the
  header_. A header must never inflate a hug column. Two ways to comply:
  - **Short label**: "Pts", not "Winner's points". The time column header is
    empty (`<th …></th>`).
  - One constant label at all widths — do **not** swap in a longer label on
    bigger screens (`md:hidden`/`hidden md:inline` pairs). On width-capped
    tables the long variant wrecks the layout, and a header that changes text
    across widths is confusing anyway.
  - **Zero-width overflow label**: keep the full word but stop it from taking
    width — wrap it in a `w-0` element so it paints past the cell edge into
    empty neighbouring header space without widening the column. Choose the
    overflow direction toward the empty side, and make sure two overflowing
    labels can't collide:

    ```jsx
    {
      /* overflows leftward (right edge stays aligned with the column) */
    }
    <th className="py-1 px-1 font-normal w-[1%]">
      <div className="w-0 ml-auto whitespace-nowrap" dir="rtl">
        <bdi dir="ltr">Place</bdi>
      </div>
    </th>;
    {
      /* overflows rightward (into an empty header, e.g. the detail column) */
    }
    <th className="py-1 px-1 font-normal w-[1%]">
      <div className="w-0 whitespace-nowrap">Changes</div>
    </th>;
    ```

## 5. Relative times

Use the shared `RelativeTime` (`src/common/date-utils.tsx`) — never format
dates ad hoc. It has three variants:

- `variant="long"` (default) — "21 hours ago"
- `variant="short"` — "21h ago", "3d ago", "2mo ago" ("just now" < 1 min)
- `variant="auto"` — short below `md`, long from `md` up

Rules: **card tables always use `short`** (space is at a premium at every
width); **full-page tables use `auto`**. The freed space goes to name columns —
that is the point: it is wrong for a time sentence to stay long while player
names truncate next to it. Time columns are hug columns.

## 6. Rows: color, dividers, hover, click

```jsx
<tr
  onClick={() => navigate(`/…`)}
  className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors font-light"
>
```

- Dividers: `divide-y divide-primary-text/50` on `<tbody>`. If the header row
  needs a separating line, use `border-b border-primary-text/50` on `<thead>`
  so it matches the row dividers.
- Theme colors only (`primary`/`secondary` classes) — never hardcoded colors.
- Clickable rows: `onClick` + `useNavigate` on the `<tr>` with `cursor-pointer`,
  `hover:bg-secondary-background hover:text-secondary-text transition-colors`.
  Do not wrap rows in `<Link>`.
- Weights within a row: base `font-light`, names `font-normal`, emphasized
  numbers (primary points) `font-medium`.

## 7. Extra whitespace behaviour

With this pattern, spare width flows into the flexible columns and truncation
only happens when space actually runs out. Do **not** "fix" whitespace with
fixed pixel/vw caps (`max-w-[120px]`, `max-w-[26vw]`) — caps tuned to today's
data break when content changes (e.g. a longer time string). The `w-[%]` +
`max-w-0` combination is fully adaptive and needs no magic numbers.

**Cap the table, not the columns.** A table does not need to span the full page
width. When a table has few/narrow columns, a full-width layout stretches the
flexible column into a huge unreadable gap between the name and the numbers.
Give the table's card a max width and center it:

```jsx
<div className="bg-secondary-background rounded-lg overflow-hidden max-w-md mx-auto">
```

`max-w-md` (448px) reads well for leaderboard-shaped tables (rank + name + a
few numbers) — it matches the leaderboard page's card width. Wider content
(score breakdowns, action buttons) earns a wider cap (`max-w-2xl`/`max-w-4xl`)
or none. The inside of the table still follows the normal column rules.

## 8. Verification checklist

For every table change, verify in the browser (dev server on `localhost:3000`):

1. Every view/toggle the table has (e.g. Overall vs Season render different
   columns).
2. Widths ~375px, ~600px, and desktop. At each: no horizontal page scroll, no
   clipped last column, table width === wrapper width.
3. Long names truncate with `…`; numbers, scores and times never truncate.
4. Headers sit exactly over their columns, same font as content.
5. Row click still navigates.
6. `npm run lint` passes.

Measuring beats eyeballing — screenshots can crop at the viewport edge and fake
an overflow. From the console:

```js
const t = document.querySelector("table");
t.getBoundingClientRect().width === t.parentElement.getBoundingClientRect().width;
document.documentElement.scrollWidth > window.innerWidth; // must be false
```
