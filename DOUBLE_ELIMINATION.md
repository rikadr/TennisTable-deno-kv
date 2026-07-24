# Double Elimination (Losers Bracket) — Feature Handover

Handover doc for the double-elimination tournament feature developed on branch
`claude/losers-bracket-tournament-iyq2xu`. Read this before fixing bugs in tournament code.

## What the feature is

A per-tournament option (`doubleElimination`, off by default, admin-set, **locked once the
tournament starts**, combinable with group play). When enabled:

- Every winners-bracket loser drops into a **losers bracket** for a second chance.
- The winners-bracket champion meets the losers-bracket champion in the **Grand Final**.
- If the losers-bracket champion wins the grand final, both players have one loss each, and a
  second deciding match is played. UI name: **"The Final Decider"** (internally `bracketReset`).
- Champion = grand final winner if the winners champ wins it; otherwise the reset winner.

## Architecture primer (unchanged by this feature)

- Event sourcing: the frontend projects an append-only event log into state. The Deno backend is
  a dumb event store (`DenoServer/event-store/`) — **no business logic there**, its
  `event-types.ts` is a verbatim copy of the frontend's (keep them in sync).
- **There is no "tournament match played" event.** Regular `GAME_CREATED` events are matched to
  bracket slots purely by player-pair identity + time ordering. `TOURNAMENT_SKIP_GAME` is a
  walkover with an explicit winner. Everything (brackets included) is recomputed from scratch on
  every projection — there is no incremental state to corrupt; bugs are always in the pure
  construction/fill functions.

## Key files

Core logic (most bugs will be here):
- `frontend/src/client/client-db/tournaments/bracket.ts` — `TournamentBracket`. Construction,
  fill, pending/completed calculation, winner, simulation. **The heart of the feature.**
- `frontend/src/client/client-db/tournaments/tournament.ts` — `Tournament` aggregate:
  `TournamentGame` type, pending-game finders, `predictWinner`.
- `frontend/src/client/client-db/event-store/projectors/tournaments-projector.ts` — config
  projection + validators (`doubleElimination` locked after start).
- `frontend/src/client/client-db/event-store/event-types.ts` — `doubleElimination?: boolean` on
  `TOURNAMENT_CREATED` / `TOURNAMENT_UPDATED` (optional for backwards compatibility; projector
  defaults it to `false`). Mirrored in `DenoServer/event-store/event-types.ts`.
- `frontend/src/client/client-db/hall-of-fame.ts` — `#getBracketResult` has a double-elim branch.

UI:
- `frontend/src/pages/tournament/tournament-page.tsx` — tab bar. Double elim gets 3 bracket tabs:
  **Grand Final / Winners bracket / Losers bracket** (single elim keeps one "Finals" tab). Active
  tab is a `?tab=` URL param; the fallback default is resolved **once per navigation target**
  (memoized) so live data updates don't switch tabs under the user. Tab visibility rules live in
  ONE place (the `tabs` array with `visible` flags) shared by the bar and the default fallback.
- `frontend/src/pages/tournament/tournament-bracket.tsx` — winners bracket views + shared pieces:
  `TournamentGameListCard` (list card, `size="lg"` variant for grand final, `ghost` variant for
  previews, `useFallbackKey` to avoid key collisions), `GameTriangle` (tree card, works for either
  section via `section` prop), `TreeListToggle`, `getGameStates` (per-game UI state incl.
  undo-skip availability).
- `frontend/src/pages/tournament/tournament-losers-bracket.tsx` — losers tab; tree view is
  **round rows stacked vertically** (final at top), NOT recursive (consecutive losers rounds can
  have equal game counts, so the binary-triangle recursion doesn't fit). Card size follows the
  number of playable games in the round. All-bye rounds are skipped in both views.
- `frontend/src/pages/tournament/tournament-grand-final.tsx` — grand final tab: big cards, the
  "If <name> wins ↓" ghost preview of the Final Decider, champion box. Names are used only once
  BOTH finalists are known.
- `frontend/src/pages/leaderboard/tournament-pending-games.tsx` — home widget sections + round
  label helpers `losersRoundLabel` / `layerIndexToTournamentRound`.
- `frontend/src/pages/tournament/tournament-form.tsx` + new/edit pages — the toggle.
- `frontend/src/pages/add-game/pending-tournament-game.tsx` — round label on the add-game banner.

Tests: `frontend/src/client/client-db/__tests__/tournaments/double-elimination.test.ts` — 20 tests
covering structure, playthroughs (2/3/4/5/16 players), byes, bracket reset, skips, rematch
disambiguation, 16-player cross-seeding regression, simulation, single-elim regression.

## Data model

```ts
// tournament.ts
type TournamentBracketSection = "winners" | "losers" | "grandFinal" | "bracketReset";
type TournamentGameTarget = { section?; layerIndex; gameIndex; role: "player1" | "player2" };
type TournamentGame = {
  player1; player2; winner?; skipped?; completedAt;
  advanceTo?: TournamentGameTarget;       // where the winner goes
  loserAdvanceTo?: TournamentGameTarget;  // double elim: where the loser drops
  isBye?: boolean;                        // structural losers slot that can never be played (hidden in UI)
  section?: TournamentBracketSection;     // tagged at construction in double elim; undefined in single elim
};
```

`TournamentBracket` fields: `bracket` (winners layers), `losersBracket`, `grandFinal`,
`bracketReset` (all `Partial<TournamentGame>`), plus derived `bracketGames` /
`losersBracketGames` / `grandFinalGames` ({played, pending} per layer) and `bracketEnded`.

**Layer indexing is inverted everywhere**: `layer[0]` is the final of that bracket,
deeper index = earlier round. Losers rounds are also numbered forward for labels:
`forward round = totalLayers - layerIndex` (round 1 is played first).

## Losers bracket construction (`getStartingDoubleElimination`)

For a winners bracket with `L` layers (2^L max players), the losers bracket has
`R = 2*(L-1)` rounds (`R = 0` for 2 players — the final's loser goes straight to the grand final):

- **Round 1**: `2^(L-2)` games; losers of adjacent winners round-1 games pair up
  (winners game `g` loser → round-1 game `floor(g/2)`).
- **Even ("major"/drop-in) rounds** `2m`: `2^(L-1-m)` games; player1 = losers-bracket survivor,
  player2 = fresh loser from winners layer `L-1-m`.
- **Odd ("minor") rounds**: survivors of adjacent major games pair up.
- Last round's winner → grand final `player2`. Winners final winner → grand final `player1`.
  (So in the grand final, `player1` is ALWAYS the winners champ — `#decidingGame` relies on this.)

**Cross-seeding — the most important decision:** a winners-layer loser of game `g` drops into
major-round game `g ^ 1` (partner swap). Invariant: the losers-bracket survivor arriving at major
slot `j` descends exactly from winners game `j`'s region, so the swap guarantees a player's FIRST
losers game is never a rematch (not the player who beat them, not anyone they eliminated).
Player-facing rule: *"you drop one slot to the side."* Deeper in, rematches become possible once
regions merge (last minor round onwards) — accepted, standard DE behavior.
⚠️ Do not "improve" this to reverse/rotate permutations — that was the original code and it
cancelled itself out across rounds, producing immediate rematches at 16+ players (see the
16-player regression test).

**Byes**: winners byes are implicit (players pre-placed by `getStartingBracket`; empty
deepest-layer games are never played). At construction we compute which winners games will ever
be played, propagate that into the losers slots, then **collapse** losers games where only one
slot can ever be filled: pointers into them are redirected to where their lone player would have
advanced, the game is marked `isBye` and its `advanceTo` cleared. So at fill time there is no
passthrough logic — pointers always land on real games.

## Filling results into slots (`#fillBracketWithGames`)

Entries (games + skips, time-sorted) are matched against `#orderedGames()` — all games in play
order: winners deep→final, losers deep→final, grand final, bracket reset. For each entry, the
FIRST game whose two players are both set, unwon, and equal to the entry's pair is filled, then
**`break`** — one entry fills exactly one game. This is what disambiguates rematches (same pair in
winners final → grand final → reset): the earlier structural slot is always filled/closed before
the later one can have both players. The reset only receives its players when the grand final
completes with `winner === player2` (activated in `#advancePlayersIn`).

**The advancement engine is shared**: `#getGameIn` / `#advancePlayersIn` / `#assignPlayerIn` are
static helpers over a `SimulationStructures` shape used by BOTH the real fill and the Monte-Carlo
simulation (`#simulateBracket`), so predictions cannot diverge from real behavior. If you change
progression rules, change them there only. Sim order: whole winners bracket bottom-up, then
losers bottom-up, then grand final, then reset if needed.

## Winner / end detection

`#decidingGame()`: single elim → `bracket[0][0]`; double elim → grand final until won; if the
winners champ (player1) won it, the grand final decides; otherwise the bracket reset decides.
`winner` and `bracketEnded` derive from it. `Tournament.endDate` = `bracket.bracketEnded`.

## UI decisions worth knowing

- Scroll/highlight keys: `getGameKeyFromPlayers(p1, p2, "bracket")` identifies cards. Grand final
  and reset share a pair, so when the reset is activated the GF card registers under its fallback
  key (`useFallbackKey`) and the reset owns the players key (it's the pending one).
- Deep links (`?player1=&player2=`) pick the tab via `bracket.findGameByPlayers` — prefers a
  pending game, else the most recently completed one (works right after registering a result).
- Round labels say how a round is filled: "Losers Round 2 — losers from Winners Semi Finals
  enter" / "— losers only" / "Losers Final — loser of the Winners Final enters"
  (`losersRoundLabel`). List-view headers are fixed-height so cards align across columns.
- Undo-skip is offered only while no downstream game (winner target, loser target, reset) is
  completed (`getGameStates`). Projection recomputes from scratch, so undoing self-heals state.

## Hall of Fame scoring (double elim)

Champion 300 · reached grand final 200 ("Grand Final") · eliminated in losers final 100 ·
losers layers 1–2 → 75 · deeper → 50 · never in a bracket game 25. Rationale: everyone except
the grand finalists is eliminated in the losers bracket, so losers-bracket depth IS the true
placement. Mid-tournament, players with no losses yet fall back to winners-bracket depth.

## Known limitations / gotchas (honest list for bug hunting)

- Slot matching is by player pair only. A casual (non-tournament) game between two players who
  also have a pending tournament game WILL be consumed by the bracket — pre-existing behavior,
  applies to both formats.
- `advanceTo` without `section` means "winners bracket" (single-elim structures are untagged).
- `losersRoundLabel` derives the winners round name via `winnersLayerCount = totalLayers/2 + 1`;
  it assumes `totalLayers = 2*(L-1)`.
- Predictions rebuild the full DE structure per Monte-Carlo iteration (5000×) — correct but not
  cheap; a known, accepted perf trade-off (single elim did the same with a lighter build).
- The old code threw on a missing `advanceTo` mid-bracket; the new code silently skips (needed
  because finals legitimately lack targets). Structural corruption would stall silently.
- 0–1 player double-elim tournaments: `predictWinner` throws (parity with single elim).
- `frontend/src/pages/tournament/tournament-into.tsx` (filename typo is historical) shows the
  format label; winners-bracket tree still labels layer 0 "Final" (not "Winners Final") — known
  cosmetic inconsistency with the home widget.

## Verification

```bash
cd frontend
npx tsc --noEmit
npm run lint
CI=true npm run test                # 38 suites; double-elimination.test.ts is the feature suite
CI=true npm run test -- --testPathPattern=double-elimination
```

Backend has no runnable check in this environment (`deno` not installed); its only change is the
copied `event-types.ts`.
