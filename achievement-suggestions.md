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

A tracked game almost always means a third person watched and recorded it. That
effort is the reason the data is rare, and the rarity is the point — a tracked
game is worth a badge on its own, before any of the point-level detail is read.
Ideas 20 and 21 award the tracking. Ideas 12 to 19 award what happened inside it.

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

# Awards for the tracking itself

On the Record 👀 — play 5 tracked games — is the first of these, and it now
ships. The 2 below build on it.

## 20. Under Observation 🔍
Play 25 tracked games. Awarded to both players, earned once.

The second tier above On the Record, in the pattern of Close Calls and Edge
Lord. Adding it means uncapping the On the Record progress count, which caps at
5 today because no higher tier reads it.

## 21. Full Session 📼
Play 3 or more games in one local calendar day, and have every one of them
tracked.

This awards a whole tracked session, not one game. It needs an observer to stay
for the full evening, which is the largest version of the effort.

# Design notes

**A tracked game is rare on purpose, so records over them are fair.** An
observer has to be arranged, so only a small part of the league's games carry a
point log. That is the reason the badges are worth having. The one thing to get
right is the wording: a record from ideas 14, 15 and 17 is a record among
tracked games, not among all games. Say so in the title or the description, so
the badge does not claim more than it holds. Floors can also start lower than
the Shootout and Marathon Set floors, because a smaller pool of games competes
for the record and a record nobody can take is not interesting.

**An award for a tracked game must survive a score edit.** Editing a game's
score replaces the `GAME_SCORE` event without `pointSequences`, so the log is
lost and every achievement built on it disappears on the next recalculation.
That is already a warning on the edit page, and it becomes a real problem once
the badge rewards the observer's effort rather than the score. Two options:
carry `pointSequences` through the edit form unchanged when the set scores are
unchanged, or store a separate durable marker on the event that says the game
was tracked, which edits preserve.

**The observer is not recorded, and does not need to be.** Both the track game
page and the live broadcast write the same `GAME_SCORE` event, and neither names
the person who tracked the game. The award goes to the 2 players who played it.
The same absence means the 2 tracking paths cannot be told apart, so a badge
only for a broadcast game is not possible.

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

**Serve is known while tracking, but not saved.** The house rule in
`serve-tracker.ts` is 2 serves each for the whole set — it does not change to 1
serve each at 10-10 — so the server for any point follows from the points played
so far and the first server of the set. The tracker holds `firstServer` in its
own state and the live game state carries it, but `GAME_SCORE` does not store
it, so it is lost on save. Service achievements — break points, points held on
serve — need only that one field added to the event, not new tracking work.
