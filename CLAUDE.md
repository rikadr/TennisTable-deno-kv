# Claude Code Project Guidelines

## Project Overview
This repository contains the **Tennis Table** application.
- **Frontend:** React (Thick Client)
- **Backend:** Deno (Thin Server)

## Commands

### Frontend (`/frontend`)
- **Build:** `npm run build`
- **Test:** `npm run test` (Runs Jest)
- **Lint:** `npm run lint`
- **Install:** `npm install`

### Backend (`/DenoServer`)
- **Run Dev:** `deno task dev`
- **Check Types:** `deno task check`
- **Format:** `deno fmt`

## Architecture Highlights
- **Event Sourcing:** The frontend projects events into state (`TennisTable` class).
- **Backend:** Stateless event store + Auth.
- **Do not** add business logic to the backend.

## Code Style
- **Never use `any` type** in application code. Always use proper types. In test files, `any` is acceptable in rare cases where typing is impractical.

## Changelog
Posts live in `frontend/src/client/changelog/changelog-posts.ts`. Add one when a
change clears the bar; skip it when it does not, rather than padding the list.

The test is whether a reader gets something out of reading it: a capability they
did not have, a behaviour they need to know changed, or a correction to numbers
they may have believed. If there is nothing for them to take away, there is no
post - a short list of things worth reading beats a complete one.

**Add a post when the change is either:**
- Something players can see or try - a new feature, a meaningful update to one,
  or a removed feature.
- A bug fix that showed players something *wrong* - an elo, a leaderboard
  position, a stat or a history they may have acted on. The post exists so they
  can revise what they believed.
- A significant change under the hood. The audience is mostly engineers, so
  architecture, performance and data-model work is worth reading about even when
  it changes nothing for a player.

**Skip it for:** small UI tweaks, admin-only changes (the bar is higher, since
most readers never see those screens), internal plumbing, config and cron
changes, dependency bumps, and refactors with no visible or architectural
consequence.

**A tweak to an existing feature is an edit, not a post.** When a feature already
has an entry, a small change to it - a refined rule, a tightened unit, a link
added, a count corrected - belongs in that entry, where the reader meets it in
the context of the feature itself. A new post is for an update substantial enough
to stand on its own. This applies hardest to features that shipped days ago: the
original post is what people will read, and it should describe the feature as it
now works. If the tweak is not worth adding to that post either, there was
nothing to say - cut it and change nothing. Corrections to numbers nobody was
reading, like a progress-bar target or a duration unit, fail the test even though
they are player-facing.

**Also skip fixes that just restore intended behaviour**, however player-facing
the symptom was: crashes, blank or broken pages, empty states, layout and
rendering bugs, a control that did not respond. Being able to reach a page that
was broken is not news to the reader - either they never saw it and have nothing
to learn, or they did and already know it was broken. "You can now open X again"
and "X no longer crashes" are not worth a post. That a fix is user-visible, or
that the bug was embarrassing, does not by itself clear the bar; the reader has
to end up knowing something useful. When it is a close call, skip it.

**Writing a post:**
- **Lead with what is new.** The reader is here for what it changed *to*.
  Describe the previous behaviour only where it makes the new thing land, and put
  it after, not first.
- **Plain, descriptive titles.** "Live win% predictions on tracked games", not
  "Live odds on the wall-mounted TV". For a batch of achievements, "4 new
  achievements" beats anything clever.
- **One post per thing, not per change.** Related work that lands together, or
  one extending another a day later, is a single post - three period records are
  "3 new achievements: Hero of the Day, Week and Month", not three entries. When
  merging, keep the slug that shipped first; slugs are permalinks.
- **Keep only the most valuable and impactful content.** A post covers what the
  change does and what the reader must know to use it or to correct what they
  believed. Cut the rest: jokes, asides, metaphors, office anecdotes, and the
  history of how the code got there. Give the reason for a change in one
  sentence, and only when the reason changes what the reader does or believes.
  State a trade-off or a reverted decision honestly, in one sentence.
- **Short.** A summary of one or two sentences, and a body of 2 to 4 blocks. A
  post that documents two separate widgets may need a fifth. If a sentence can
  go without loss, it goes.
- **No commit hashes or commit messages** - they are noise for this reader.
- Tag with one or two of: `new-feature`, `feature-update`, `removed-feature`,
  `bug-fix`, `technical`. **`new-feature` means the feature did not exist
  before.** Something added inside a feature that already shipped is a
  `feature-update`, however new it is to play with - new achievements update
  Achievements, a new tournament format or tab updates Tournaments, and a new
  theme updates Theme support. The
  posts tagged `new-feature` should read as the list of things the app gained,
  not the list of times one of them grew.
- Body blocks are `text` and `list` only. Backticks render as inline code.
- Slugs are permalinks - do not change one once it has shipped.
- It is a static content list and needs no tests.

**Language: ASD-STE100 Simplified Technical English.** The posts are written for
fast and accurate comprehension by a human reader. Follow the STE writing rules:

- **One short sentence, one idea.** Maximum 25 words in a sentence, and 20 in a
  sentence inside a list item. Maximum 6 sentences in a paragraph.
- **Active voice, simple present tense.** "The app calculates the record", not
  "the record is calculated". Use a past tense only for what the app did before
  the change.
- **Simple, approved words, one meaning each.** Prefer the common word: `use`
  not `utilise`, `start` not `commence`, `about` not `regarding`. Do not use a
  word in a second sense - a game `starts`, it does not `kick off`.
- **No idioms, metaphors, slang, irony or humour.** They are the largest source
  of slow or wrong reading, and they do not translate. "A player who loses moves
  to the losers bracket", not "losing once no longer ends your evening".
- **Consistent terms.** One name for one thing, every time: player, game, set,
  point, score, rating, record, achievement, leaderboard, season, tournament.
  Never switch to a synonym for variety.
- **Use articles.** "The bracket", not "bracket". Keep noun clusters to 3 words
  or fewer - write "the record for the longest set", not "the longest set record
  holder".
- **Write positively.** No double negatives, and no "-ing" form where a simple
  verb works.
- Keep the emoji in an achievement name, and keep numbers as digits.

The page is at `/changelog`. Until the navigation structure is reworked it is
only in the nav menu for logged-in admins - everyone else reaches it by direct
url.

## Context Files
- Root Instructions: `./GEMINI.md`
- Frontend Details: `./frontend/AGENTS.md`
- Backend Details: `./DenoServer/AGENTS.md`
