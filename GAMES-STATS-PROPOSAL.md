# Games tab — candidate statistics per detail level

Working document. Not committed as part of the feature; delete when we are done.

Pick, cut and add. Reply with ids (`G3`, `S1`, `P4`…) plus anything missing.

## Ground rules that constrain the list

- **No counts.** The page may only show shares, medians and averages — never
  "412 games" or "9 players". Anything that needs a raw count is marked ⚠️.
- **Levels nest.** Sets ⊃ points ⊃ tracked. A stat belongs to the *lowest*
  level that can produce it. `medianPointsPerGame` for example does not need
  tracking, only `setPoints`, so it is a point-level stat.
- **The other tabs already own some ground.** Activity owns when we play,
  Matchups owns the rating gap and upsets, League owns ratings, ranks and
  pairing coverage. Overlap is marked ↔ so we can decide to move or drop.

Status legend: `built` = on the branch now, `old` = was on the page before,
`new` = would need a new aggregation.

---

## Level 1 — Game level
*Winner, loser, time. Every game. Ratings count as game level, since elo is
derived from results only.*

| id | Statistic | What it tells you | Status |
|----|-----------|-------------------|--------|
| G1 | Share of games won by the higher rated player | Does the rating hold up | new ↔ Matchups |
| G2 | Median rating gap in a game | Do we play equals or mismatches | new ↔ Matchups |
| G3 | Share of games between players within 50 rating points | How much of the league is a close matchup | new |
| G4 | The pair played before (in the period) | How much of the league is repeat fixtures | built |
| G5 | Rematch within the hour | How much of the league is one session at the table | built |
| G6 | Revenge: the loser of the previous game wins the rematch | Does losing get avenged | built |
| G7 | The winner won their previous game | Does form carry between games | built |
| G8 | Median days between two games of the same pair | How often a rivalry meets | new |
| G9 | Share of games that are the first ever meeting of the pair | How much new ground the league covers | new ↔ League |
| G10 | Median elo points moved in a game | How much a single game is worth | new |
| G11 | Share of games that changed a leaderboard position | How often a result matters to the table | new |
| G12 | Share of games that changed the top 3 | How often the top of the table moves | new |
| G13 | Share of games played by two ranked players | Who the league is between | new ↔ League |
| G14 | Median length of a session of a pair ⚠️ | Best of 3, best of 5, or one game | needs a count |

## Level 2 — Set level
*Games that record `setsWon`. No order and no points, so only the sets and who
won them.*

| id | Statistic | What it tells you | Status |
|----|-----------|-------------------|--------|
| S1 | Loser won no set (whitewash) | How often a game is one sided | built, old |
| S2 | The last set decided it (loser one set short) | How often a game goes the distance | built |
| S3 | Played as a single set | The format mix of the league | built |
| S4 | Median sets in a game | The format mix, as one number | built |
| S5 | Share of all sets that the game winner won | Dominance, at set level | new |
| S6 | Whitewash share by rating gap group (chart) | Does a rating gap predict a whitewash | new |
| S7 | Share of games that reach 3 sets, 4 sets, 5 sets (bar chart) | The shape of a game, as a distribution | new |

## Level 3 — Point level
*Games that record `setPoints`. The sets are in the order they were played, so
first set and deciding set are known here.*

| id | Statistic | What it tells you | Status |
|----|-----------|-------------------|--------|
| P1 | Sets that reach deuce (both at 10 or more) | How often a set gets tight | built, old |
| P2 | Median points in a set | The size of a set | built, old |
| P3 | Median winning margin in a set | How close a set is | built, old |
| P4 | Median points in a game | The size of a game | built (moved from tracked) |
| P5 | Share of the points won by the game winner | Dominance, at point level | built |
| P6 | Games won with fewer points than the loser | How often the scoreboard lies | built |
| P7 | The winner of the first set wins the game | Is the first set the game | new |
| P8 | Games the winner lost the first set of (comeback) | How often a game turns around | new (inverse of P7) |
| P9 | Distribution of the losing score of a set: 0…9, deuce (bar chart) | The most common way a set ends | new |
| P10 | Deciding sets that reach deuce, against all sets | Is the last set tighter than the rest | new |
| P11 | Median point margin by rating gap group (chart) | How much a rating gap is worth in points | new ↔ Matchups |
| P12 | Sets won to 0 or to 1 | How often a set is a walkover | new |

## Level 4 — Fully tracked games
*Games with `pointSequences` and `tracking`: every point in order, its time,
and who served it.*

| id | Statistic | What it tells you | Status |
|----|-----------|-------------------|--------|
| T1 | Median game length | How long a game takes | built, old |
| T2 | Median time per point | The pace of play | built, old |
| T3 | Median break between two sets | How long we stand around | built |
| T4 | Points won by the server | What a serve is worth | built, old |
| T5 | The player who won the last point wins the next | Do points come in runs | built |
| T6 | The first point of a set wins the set | Is the start of a set worth anything | built |
| T7 | Median longest run of points in a game | How streaky a game is | new |
| T8 | Win probability from a set score (chart: at 8-5, x% win the set) | The real value of a lead | new |
| T9 | Sets won after being 5 points down | How alive a set is when you are behind | new |
| T10 | Sets where the loser held a set point | How many sets are nearly stolen | new |
| T11 | Points won on serve at deuce, against normal play | Does the serve matter more when it is tight | new |
| T12 | Median seconds per point at deuce, against normal play | Do we slow down when it is tight | new |
| T13 | Median lead changes in a set | How much a set swings | new |
| T14 | Tracked on the live screen | Which tracker we use | built, old |
| T15 | Share of the games of each month that are tracked (line chart) | Are we recording more over time | built, old |
| T16 | Tracked games with a correction | How much to trust the times | new, admin-ish |

---

## Open questions before we cut

1. **Who is this for?** Bragging rights and "what should I know about my game",
   or league health? G10-G13 and T15 serve the second, P7-P10 and T8-T13 the
   first.
2. **How much should the level-1 section overlap the Matchups tab?** G1 and G2
   are the most valuable game-level statistics there are, but the Matchups tab
   already plots them. Move them here, or leave them and keep level 1 thin?
3. **Tiles or charts?** Right now every level is tiles. P9, S7 and T8 are
   distributions and only work as charts. Do we want a chart per level?
4. **Period.** Everything except T15 respects the period selector. Keep that?
