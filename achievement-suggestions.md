# Achievement Suggestions

Shortlisted new achievement ideas for Tennis Table. Implemented ideas have been
removed; only the not-yet-implemented ones remain.

## 1. Century Club 💯
Play 100 total games.

## 2. Free Fall 📉
Drop 300 Score from your all-time high.

## 3. Throne Holder 👑
Hold rank #1 for 30 consecutive days.

## 4. Dynasty 🏛️
Hold rank #1 for 90 consecutive days.

## 5. Rocket 🚀
Climb 100 Score in a single calendar week.

## 6. Yin Yang ☯️
Alternate Win/Loss/Win/Loss for 10 games straight.

## 7. Worst Day 🌧️
Lose 5+ games in a single day without a win.

## 8. Tour de Table 🚲
Play against 5 different opponents in a single day.

## 9. Late Bloomer 🌷
Enter a season's top 3 only in its final week.

## 10. Founding Member 🪴
Be among the first 5 players ever created in the league.

## 11. Block Party 🎉
Play on a day where every currently active ranked player also plays.

# Point-sequence achievements

Ideas that need the `pointSequences` field on `GAME_SCORE` — the point-by-point
log added by live game tracking. Each set is one string, one char per point in
the order scored, `W` for a point to the game winner and `L` to the game loser.

What the log adds over `setPoints` is **order inside a set**. Everything below
needs a score state part-way through a set, which the final set score cannot
give. Set-level order (lost the first set, won the match) is already available
from the ordered `setPoints` array and needs none of this.

Read the design notes at the end before implementing any of these.

## 12. Match Point Down 🧗
Win a game after the opponent held a match point.

A match point exists at a prefix of a set where the opponent would have won the
match by taking the next point: the opponent leads the sets one short of the
match, and inside the set their running score is 10 or more with a lead of 1 or
more. Awarded to the game winner, re-achievable per game.

The rarest and most valuable of these ideas. It is also the one a player
remembers, so the badge has a story attached to it.

## 13. Saved 🪢
Win a set after facing set point. Career counter — win 5 such sets.

Same set-point rule as Match Point Down, without the match condition. It happens
often enough to fill a progress bar, so it gives the point log a low tier to
sit next to Deuce Demon.

## 14. Comeback 🔄
League record for the largest deficit turned into a set win.

At a prefix of a set the player trails by N points, and the player wins that
set. Floor the first record at 5, the way Shootout and Marathon Set floor
theirs. The badge shows the deficit and the set score.

## 15. Point Storm 🌪️
League record for the longest run of consecutive points inside one set.

The direct analogue of Marathon Set, one level deeper in the data. Floor the
first record at 7. Awarded to the player who scored the run, not to both.

## 16. Wire to Wire 🚩
Win a game where you never trailed, in any set.

At every prefix of every set the player's running score is equal to or higher
than the opponent's. A clean statement of total control, and impossible to see
from the final scores — an 11-6, 11-4 game can still contain a 0-4 start.

## 17. Seesaw ⚖️
League record for the most lead changes in a single set.

A lead change is the leader flipping from one player to the other; going level
does not count on its own. Awarded to both players, like Shootout — the set was
played together. Floor the first record at 6.

## 18. Escape Artist 🫧
Win a game where your replayed win chance dropped below 5%.

`replayWinPercentHistory` already computes this curve for the game details page.
The threshold is a read of the existing samples.

Note the trade-off: the value comes from a seeded Monte-Carlo simulation of the
current prediction model. A change to the model can move a game across the
threshold, and the badge then appears or disappears on recalculation. Either
accept that, or use a deterministic proxy — for example the fewest points the
opponent needed to win the match at any prefix.

## 19. Heartbreaker 💔
Lose a game after your replayed win chance was above 95%.

The mirror of Escape Artist, and the same trade-off applies. The league already
awards Goliath, Humbled and Punching Bag, so a badge for a loss fits.

# Design notes

**Coverage is thin, so prefer thresholds over league records.** Only games
tracked on the track game page or the live broadcast carry a point log, and only
since the feature shipped. Editing a game's score replaces the `GAME_SCORE`
event without `pointSequences`, so the log is lost and any achievement built on
it disappears on recalculation. A league record over a small set of games reads
as a record over the whole league, which it is not. Threshold achievements —
12, 13, 16, 18, 19 — do not have this problem.

**Reuse the set validity rule.** `#isValidSetScore` in `achievements.ts` already
states the format: 11 points, win by 2. Gate every set-point and match-point
rule on it. The tracker does not enforce a target score, so a set can end at any
score, and a rule that assumes 11 is wrong without the gate.

**Do not read the last char of a set string.** The event type states that the
last char is not necessarily the set winner's point. Derive state from prefixes
and take the set result from `setPoints`.

**Undo distorts the recorded order.** `removeLastPointFromSequence` drops the
player's own last point and keeps every point scored after it, so the order
after an undo can differ from the order played. Point totals stay correct.
Achievements that count exact transitions — Seesaw most of all — carry this
noise. Achievements that test whether a state was ever reached are robust to it.

**Serve is not in the data.** Serve alternates every 2 points, and every point
from 10-10, so the log fixes the serve pattern of a set. It does not say which
player served first, and the first server alternates each set, so the whole
family of service achievements — break points, points held on serve — needs one
more field on the event: who served the first point of the game.
