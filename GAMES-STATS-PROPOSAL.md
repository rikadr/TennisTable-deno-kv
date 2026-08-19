# Games tab — candidate statistics per detail level

Working document. Not committed as part of the feature; delete when we are done.

Pick, cut and add. Reply with ids (`G3`, `S1`, `P4`…) plus anything missing.

## Ground rules that constrain the list

- **No counts.** The page may only show shares, medians and averages — never
  "412 games" or "9 players". Anything that needs a raw count is marked ⚠️.
- **Every share is over the games of its own level.** A point level percentage
  is a share of the games that record points, never of all the games. We do not
  know what a game without points would have contributed, so it cannot sit in
  the denominator. The same holds at every level, and each section prints the
  share of the games it covers so the reader knows the pool.
- **Levels nest.** Sets ⊃ points ⊃ tracked. A stat belongs to the *lowest*
  level that can produce it. `medianPointsPerGame` for example does not need
  tracking, only `setPoints`, so it is a point-level stat.
- **The other tabs already own some ground.** Activity owns when we play,
  Matchups owns the rating gap and upsets, League owns ratings, ranks and
  pairing coverage. Overlap is marked ↔ so we can decide to move or drop.

Status legend: `built` = on the branch now, `old` = was on the page before,
`new` = would need a new aggregation. ★ = asked for by Rikard.

---

## Level 1 — Game level — DECIDED
*Winner, loser, time. Every game. Ratings count as game level, since elo is
derived from results only.*

Kept: **G2, G8, G9, G13**. Scrapped: G1, G3, G4, G5, G6, G7, G10, G11, G12,
G14, G15, G16. G4-G7 are built on the branch, so `gameLevelStats` and its tests
get deleted when we implement this.

| id | Statistic | Shape | Note |
|----|-----------|-------|------|
| G2 | Median rating gap in a game | tile | The gap before the game, from `forEachGameWithPreGameStanding`. Absolute, so it never reads as a sign. |
| G8 | Median days since the pair last played | tile | Over the games of the period that are not a first meeting. |
| G9 | Share of games that are the first ever meeting of the pair | tile | "Ever" is over the whole history, so a game in the period counts as a first meeting only if the pair never played before it. |
| G13 | Both ranked / one ranked / neither ranked | chart | The three shares add up to 100. Ranked is measured **at the time of the game**. |

**G13 in detail.** A player is ranked when they have played
`gameLimitForRanked` games, so ranked at the time of a game means they had
played that many before it. `forEachGameWithPreGameStanding` already reports
the games each player had played before a game, so this needs no new walk of
the history. Deactivation stops mattering: the question is what the player was
on the day, not whether they are still in the league.

The League tab has the same three shares today, but measured against the
leaderboard of **today** and against the active players of today, so its
numbers will not match. We should move the statistic here and remove it from
League, rather than print two different values for "both ranked" on one page.

### Open decisions for level 1

1. **G13 chart.** A 100% stacked bar for the selected period, or a stacked area
   per month over the whole history? The second shows the league maturing as
   players cross the ranked limit, but it ignores the period selector, the way
   the tracked-share chart already does. I suggest the stacked area.
2. **G13 in League.** Remove it there, or leave the two versions? I suggest
   removing it there.
3. **Section shape.** 3 tiles and 1 chart. Good?
4. **The pace statistic** (games per day, week and month) is not decided. It
   conflicts with the privacy rule of the file: A the literal averages and a
   repeal of the rule, B the pace as a ratio to the usual pace, C the share of
   days with a game.
5. **Level 1 stays small here.** Many game level statistics fit better in
   another tab, or in a chart of the busiest periods like the one on the admin
   statistics page. That is separate work, not this section.

## Level 2 — Set level — DECIDED
*Games that record `setsWon`. No order and no points, so only the sets and who
won them.*

Kept: **S5, S7, S8**. Scrapped: S1, S2, S3, S4 (S8 carries all four) and S6.

| id | Statistic | Shape | Note |
|----|-----------|-------|------|
| S5 | Share of all the sets that the game winners won | tile | Over the games with sets. Always above 50%, and it reads as dominance. |
| S7 | Games by the number of sets they hold: 1, 2, 3, 4, 5 | chart | The relative quantity of each, as a share of the games with sets. |
| S8 | The set score of a game: 2-0, 2-1, 3-0, 3-1, 3-2, 1-0… | pie | Read from the winner, so 2-1 and 1-2 are one slice. The slices add up to 100%. |

**S7 and S8 stay two charts.** They are read differently: S8 for the exact
score, S7 for how long a game runs. S8 is a pie, S7 is a bar chart.

**Open decision for level 2:** an unusual scoreline (4-3, 5-2) makes a thin
slice of the pie. Roll everything past the common ones into "other", or keep
every scoreline? Default if we do not decide: keep every scoreline.

## Level 3 — Point level — DECIDED
*Games that record `setPoints`. The sets are in the order they were played, so
the first set and the deciding set are known here.*

Kept: **P1-P10**. Scrapped: P11, and P12 (the P9 chart carries it).

| id | Statistic | Shape | Note |
|----|-----------|-------|------|
| P1 | Sets that reach deuce | tile | Both players at 10 or more. |
| P2 | Median points in a set | tile | |
| P3 | Median winning margin in a set | tile | |
| P4 | Distribution of the points in a game | line chart | A line over the buckets of the total points of a game, with a reference line at the median, so the reader sees the spread on each side of it. The y axis is the share of the games, never a count. |
| P5 | Share of the points won by the game winner | tile | |
| P6 | Games won with fewer points than the loser | tile | Name it after the **Less is More** achievement, which awards exactly this. Link the card to the achievement. |
| P7 | The winner of the first set wins the game | tile | |
| P8 | Games where the winner lost the first set | tile | 100 minus P7. Show one of the two, framed the way that reads best. |
| P9 | Distribution of the losing score of a set: 0-9 and deuce | bar chart | The most common way a set ends. |
| P10 | Match deciding sets against the other sets, as a ratio | tile | "A match deciding set reaches deuce 1.4 times as often as a set that decides nothing." The two pools do not overlap: a deciding set is never in the comparison pool. |

**P10 in detail.** A match deciding set is the last set of a game where the
loser ended one set short of the winner, so both players could still win the
match when it started. Every other set is the comparison pool. The number
printed is the deuce rate of the deciding sets divided by the deuce rate of the
rest.

**Open decisions for level 3**

1. **P7 and P8 are one number.** Which framing do we print: the first set wins
   the game, or the winner lost the first set?
2. **P7 and P8 in a game of one set.** The first set is also the last one, so
   the statistic is trivially true. Leave games of one set out? I suggest yes.
3. **P4 buckets.** Points in a game run from about 20 to over 100. Buckets of 5
   points, or of 10?

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
| T17 ★ | Average set points a set winner needs to close the set | How hard it is to finish a set | new |
| T18 ★ | Average match points a game winner needs to close the game | How hard it is to finish a game | new |
| T19 ★ | **The difference between T18 and T17** | Whether closing a game is harder than closing a set | new |
| T20 ★ | Set points converted, against match points converted | The same, as two conversion rates | new |
| T21 ★ | Games where the game loser held a match point | How often a game is nearly stolen | new |
| T22 ★ | Sets where the set loser held a set point | How often a set is nearly stolen | new (was T10) |

---

## Definitions for the set point and match point statistics (T17-T22)

The rules the app already uses, from `live-game-win-probability.ts`: a set is
first to 11 and won by 2, and a match is first to N sets. For a finished game N
is the set count of the winner, so the match format is known in hindsight.

- **Set point.** A point where the player who is ahead wins the set by winning
  it. The player is at 10 or more and leads by 1 or more. At 10-10 nobody is at
  set point; at 11-10 only the leader is. So at most one player holds set point
  at a time, and no point is counted twice.
- **Match point.** A set point of a player who has won N-1 sets already. In a
  deciding set both players can hold a match point, in turn.
- **T17 and T18** count the set points and match points the eventual winner
  held before converting. 1 means the first one went in. 4 means three were
  missed first.
- **T19** is the number that answers the question: a set takes x set points to
  close, a game takes y match points, and y - x is the price of the moment.

**Decision needed.** A set is marked won by hand, so a recorded set does not
always meet the 11 and 2 rule. A set that ends at 8-5, or at 11-10, holds no set
point under the rule. Leave those sets out of T17-T22, or count them as a set
that was closed on the first set point? I suggest leaving them out and saying so
in the description of the card.

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
