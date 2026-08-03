import { ChangelogTag } from "./changelog-tags";

/** A paragraph or a bullet list. Keeps posts writable without a markdown dependency. */
export type ChangelogBlock = { kind: "text"; text: string } | { kind: "list"; items: string[] };

export type ChangelogPost = {
  /** Url slug. Stable - it is a permalink. */
  slug: string;
  title: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  tags: ChangelogTag[];
  /** One or two sentences, shown in the list view. */
  summary: string;
  body: ChangelogBlock[];
};

const text = (value: string): ChangelogBlock => ({ kind: "text", text: value });
const list = (...items: string[]): ChangelogBlock => ({ kind: "list", items });

/**
 * Backfilled from the git history, newest first.
 *
 * The bar for a post: it changes something players can see or try, or it is a
 * significant change under the hood. Small fixes, admin-only tweaks and
 * internal plumbing are left out.
 *
 * Write about what is new. Describe how it used to work only where that is
 * needed to make the new thing land - the reader is here for what changed to,
 * not for what it changed from.
 */
export const CHANGELOG_POSTS: ChangelogPost[] = [
  {
    slug: "retirement-achievements",
    title: "2 new achievements for retiring and coming back",
    date: "2026-08-03",
    tags: ["new-feature"],
    summary:
      "Retired 🪦 marks leaving the league, Back From The Dead 🧟 marks returning from retirement, and retired players now appear in the achievements progress list.",
    body: [
      list(
        "Retired 🪦 - earned when you retire from the league. Awarded for every retirement, should you make a habit of it.",
        "Back From The Dead 🧟 - earned when you come back after retiring. The achievement shows how long you were gone.",
      ),
      text(
        "The 2-year comeback achievement previously held the Back From The Dead name; it is now called A Cinderella Story 👸. Returning from an actual retirement is the stronger claim to the title.",
      ),
      text(
        "The Everyone's Progress view on the achievements page now includes retired players, tagged with a Retired badge. Their history is as real as anyone's, and their names were already on the records they hold.",
      ),
    ],
  },
  {
    slug: "record-achievement-targets-beyond-record",
    title: "Record achievement progress bars now aim one beyond the record",
    date: "2026-08-03",
    tags: ["bug-fix"],
    summary:
      "Progress toward Longest Win/Lose Streak, Marathon Set and Leap Frog is now measured against the value that actually takes the record, not the record itself.",
    body: [
      text(
        "The four record-chasing achievements are earned by beating the league record, not by matching it. Their progress bars and targets now reflect that: with the win-streak record at 8, the bar aims at 9. Previously the target was the record itself, so tying it read as 100% without earning anything. If your progress on one of these dropped slightly, this is why - the goal moved to where it always really was.",
      ),
    ],
  },
  {
    slug: "tournament-timeline-whole-days",
    title: "The tournament timeline counts whole days",
    date: "2026-07-31",
    tags: ["feature-update"],
    summary:
      "Every duration on the timeline is now a count of calendar days, inclusive at both ends: same day is one day, into the next day is two.",
    body: [
      text(
        "A round's duration is the number of calendar days it touched. A round that started and finished on the same day took one day. One that started in the afternoon and finished the next morning took two, even though only a few hours passed. The bars and the axis are drawn in the same unit, so a bar covers whole day cells and the tournament total is the number of days it spanned.",
      ),
      text(
        "It used to be a straight clock difference, reported as minutes, hours or fractional days - a round could read 4.5 hours and the one after it 1.2 days. Tournaments here are played out over days, not measured to the minute, and the mixed units made two rounds hard to compare at a glance. Sub-day precision was never the interesting number. If you read a round as taking half a day, it now reads as the one or two days it actually spanned.",
      ),
      text("Hovering a bar still gives the dates it ran between."),
    ],
  },
  {
    slug: "new-connections-view-match",
    title: "Follow a New connections entry back to the match",
    date: "2026-07-31",
    tags: ["feature-update"],
    summary:
      "Every entry in the New connections widget links to the game behind it, and First tournament now counts everyone whose first tournament it was, debuts included.",
    body: [
      text(
        "Every entry in New connections carries a View match button. It opens the tab the game is on - group play, either bracket, or the grand final - scrolls that game's card into view and wiggles it. A pair points at the game they first met over, a player at their first game of the tournament.",
      ),
      text(
        "First tournament now lists everyone this was a first tournament for. That includes players making their club debut and players back from a long break, both of which it used to leave out to stop the lists repeating each other. The count read lower than the number of people it was true of, so if you read a debut as someone who had been to a tournament before, that is why. A player can now turn up in two lists, which is the honest answer to each.",
      ),
      text(
        "The lists run in two columns from tablet width up. One column left most of the width empty, and these entries are short.",
      ),
    ],
  },
  {
    slug: "win-chance-predictions-for-unranked-and-retired-players",
    title: "Win chance predictions for unranked and retired players on Compare 1v1",
    date: "2026-07-31",
    tags: ["feature-update"],
    summary:
      "Compare 1v1 predicts retired matchups outright, and offers the prediction for unranked players behind a warning you have to acknowledge. A player with no games at all still gets none.",
    body: [
      text(
        "Retired players get a prediction like anybody else now. Their game history is still there, and that is all the model needs - retirement says nothing about how the games went.",
      ),
      text(
        "Pick a matchup where one or both players are unranked and the prediction card offers to show it anyway. Acknowledge the warning and you get the same numbers as any other pairing, with a banner above them as a standing reminder that the data behind them is thin. It works the way the predictions tab on a player page does.",
      ),
      text(
        "A player with zero games is the one case that is not offered: there is nothing at all to predict from, so the card says so and stops there. The same goes for a matchup where no chain of games connects the two players - the model has no path between them, and it now says that instead of quietly showing 0% at 0% confidence.",
      ),
      text(
        "Previously the card refused a retired matchup, and said both players had to be ranked otherwise. That was more caution than either situation called for. An unreliable estimate you have been warned about is more useful than no estimate.",
      ),
    ],
  },
  {
    slug: "longest-win-and-lose-streak-achievements",
    title: "2 new achievements: Longest Win Streak and Longest Lose Streak",
    date: "2026-07-30",
    tags: ["new-feature"],
    summary:
      "Two league records, one for consecutive wins and one for consecutive losses. Whoever holds a record keeps the award, and it grows as the streak does.",
    body: [
      text(
        "Longest Win Streak goes to whoever has strung together the most wins in a row, and Longest Lose Streak to whoever has managed the opposite. Both are league records: you take one by beating the streak that stands, and the award records how long your streak was.",
      ),
      text(
        "Extending a streak you already hold the record with does not hand you a second award - the one you have grows instead. Win your 11th in a row while your 10 is still the record and you have one award worth 11, not two.",
      ),
      text(
        "It can be earned more than once, in two ways. A new streak that beats the record earns its own award, so a run of 10, a loss, and then 11 is two awards. So is being overtaken mid-streak: if somebody else reaches 11 while your 10-streak is alive, passing them again earns a second award, and the first keeps the 10 it was worth while it was the record.",
      ),
      text(
        "The first record in either direction needs 3 in a row. After that only the record matters - and ties do not count, you have to beat it.",
      ),
      text(
        "Your Progress tab shows the streak you are on, your longest ever, and who holds the record. Note that the progress bar tracks the streak you are on now: a long run in the past does not bring you closer to the record, only a live streak can grow into it.",
      ),
    ],
  },
  {
    slug: "tournament-predictions-stream-running-tallies",
    title: "Tournament predictions update while they run",
    date: "2026-07-30",
    tags: ["feature-update"],
    summary:
      "Predictions now draw a running tally every 2,000 simulations, so the graph fills in as it goes instead of after.",
    body: [
      text(
        "The prediction graph and the table under it now redraw while a time point is still simulating. The numbers are the tally so far, based on however many simulations have finished, and they settle as the count climbs. The table says how far along it is, for example 40,000 of 50,000 simulations.",
      ),
      text(
        "Previously nothing appeared for a time point until all of its simulations were done, which on Extreme or Melt your pc meant a long wait with an empty graph and no way to tell whether it was working. The estimates are usable well before the run finishes, so there was no reason to hold them back.",
      ),
      text(
        "The progress bar moves within a time point too, rather than only stepping when one completes. Every setting streams, Normal included, though the quicker ones are over before there is much to watch.",
      ),
    ],
  },
  {
    slug: "perfect-day-awarded-when-the-day-ends",
    title: "Perfect Day is awarded once the day is over",
    date: "2026-07-30",
    tags: ["bug-fix"],
    summary:
      "Five undefeated games no longer earns Perfect Day on the spot - it lands after midnight, once the day can no longer be spoilt by a loss.",
    body: [
      text(
        "An undefeated day now shows as a complete 5/5 attempt until the day ends, and the achievement is granted when the next day starts.",
      ),
      text(
        "Previously the fifth win awarded it immediately, which was wrong: a loss later the same afternoon disqualifies the day, so the achievement would appear and then vanish from your profile. If you saw a Perfect Day you later lost, that is why.",
      ),
      text(
        "Perfect Week is unaffected and is still awarded the moment you win on the Friday. Losses never count against a perfect week, so nothing later in the week can take it back.",
      ),
    ],
  },
  {
    slug: "tournament-statistics-timeline",
    title: "A Statistics tab on tournaments",
    date: "2026-07-30",
    tags: ["new-feature"],
    summary:
      "Two widgets alongside the bracket and info tabs: a timeline of how long each part of the tournament took, and the pairs and players the tournament brought together.",
    body: [
      text(
        "The Statistics tab sits alongside the bracket and info tabs, and holds one widget per stat.",
      ),
      text(
        "The timeline draws one bar per part of the tournament, laid out over the days since it started.",
      ),
      list(
        "Group play, with a bar per group",
        "The bracket, with a bar per round",
        "For double elimination: the winners bracket, the losers bracket and the grand final as their own sections",
      ),
      text(
        "A round's clock starts when it became possible to play - the round feeding it finished, and for a losers bracket round also the winners bracket round dropping players into it - and ends at its last game. Waiting for people to show up is therefore part of how long a round took, which is usually the more interesting number. Group play is the exception: its groups run side by side from the tournament start. Rounds still being played run up against now, and rounds nobody has reached yet read as not started.",
      ),
      text(
        "New connections sits under it, and answers the thing a bracket cannot: who did this tournament put in front of each other that an ordinary week never would.",
      ),
      list(
        "First-ever meetings - pairs who had never played each other before",
        "Reunions - pairs who had not met in six months or more, and how long it had been",
        "First game ever - players who had never played in the club until this tournament",
        "Back after a break - players returning after six months or more away, longest absence first",
        "First tournament - players who had been playing all along, but never in a tournament",
      ),
      text(
        "Those are measured against the club as it stood the moment the tournament started. That single baseline is what keeps the numbers steady: a pair meeting twice, in group play and then again in the bracket, is one first meeting rather than a meeting followed by a rematch. Skipped games, byes and walkovers are left out, since nobody met over them.",
      ),
      text(
        "A tournament between regulars will show little there, and saying so is the point of it: the widget reports that everyone already plays each other, and gives the longest anyone had gone without meeting anyway.",
      ),
    ],
  },
  {
    slug: "switch-to-live-tracking-mid-flow",
    title: "Switch to live tracking without starting over",
    date: "2026-07-29",
    tags: ["feature-update"],
    summary:
      "The Choose Winner step of Add Finished Game now offers to track the match point by point instead, with both players carried over.",
    body: [
      text(
        "Picking the two players and then realising the game has not been played yet no longer means backing out and picking them again. The button under Choose Winner takes you straight to live tracking with the same two players selected.",
      ),
      text(
        "Admins get the same shortcut one step further along: while tracking a match, a button at the bottom hands it over to the broadcasted live game, keeping the sets and the current score. Scoring continues on the live game admin page and the match shows up on the public live game page and the TV overlay.",
      ),
    ],
  },
  {
    slug: "player-pairings-widget",
    title: "Player pairings on the player page",
    date: "2026-07-28",
    tags: ["new-feature"],
    summary:
      "A widget in the Statistics tab that groups everyone else by how many players it takes to connect you through games played.",
    body: [
      text(
        "The first column is the players you have played, most games first. The next column is the players you have not played but share an opponent with, then the ones two steps away, and so on. A final column collects anyone with no chain of games leading to you at all.",
      ),
      text(
        "Hover anyone in an in-between column and the widget draws the chain back to the player you have actually played, arrows pointing your way, with everybody else faded out.",
      ),
      text(
        "Where several equally short chains exist, the one with the most games on its last hop wins - picked hop by hop working back from the player you hover. That same count is what orders each column.",
      ),
      text(
        "A cog in the widget's top right opens two settings, both recalculating the chains as you change them, so the columns, their counts and the paths on hover all follow along.",
      ),
      list(
        "Include retired players - off by default. Left off, only games between two active players count as links, so a retired player does not keep bridging the people who used to play through them. Turn it on and they reappear in the columns and start bridging again.",
        "Games per link - anywhere from 1 to 10. At 1 a single game between two players connects them; higher up, only pairs who play each other that often count.",
      ),
      text(
        "Games per link is the more interesting of the two: it strips out the one-off games that make almost everyone look two steps apart, leaving the chains that run through opponents people actually play. Pushed far enough it will route you around someone you have only met once, and drop players into the no-connection column entirely.",
      ),
    ],
  },
  {
    slug: "earliest-and-latest-game-achievements",
    title: "2 new achievements: Earliest and Latest Game",
    date: "2026-07-27",
    tags: ["new-feature"],
    summary: "Records for the earliest and latest game ever played, which move when someone beats them.",
    body: [
      text(
        "Two league-wide records rather than personal ones. Play at 06:12 and you take the Earliest Game record from whoever held it; stay late enough and the same goes for the last game of the day.",
      ),
      text("They keep moving, so neither is ever settled for good."),
    ],
  },
  {
    slug: "double-elimination-tournaments",
    title: "Double elimination tournaments",
    date: "2026-07-24",
    tags: ["new-feature"],
    summary: "Lose once and you drop into a losers bracket instead of going home.",
    body: [
      text(
        "Tournaments can now be run as double elimination. Everyone who loses drops into a losers bracket and keeps playing, and the winners-bracket champion meets the losers-bracket survivor in a grand final. Losing once no longer ends your evening.",
      ),
      text(
        "It is a choice on the tournament form, alongside the original single elimination format. The bracket view, the pending games list and signup all handle the extra structure.",
      ),
    ],
  },
  {
    slug: "4-new-achievements",
    title: "4 new achievements",
    date: "2026-07-11",
    tags: ["new-feature"],
    summary: "Full House, Humbled, Perfect Day and Perfect Week.",
    body: [
      list(
        "Perfect Day and Perfect Week - play at least a few games in the period and win all of them.",
        "Full House - beat a wide slice of the league.",
        "Humbled - the mirror of Full House, for the day nothing went your way.",
      ),
      text("These reward the shape of a run rather than any single result."),
    ],
  },
  {
    slug: "live-win-predictions",
    title: "Live win% predictions on tracked games",
    date: "2026-06-28",
    tags: ["new-feature"],
    summary: "Tracked and live games now show each player's win probability while you play.",
    body: [
      text(
        "The live game pages and the TV overlay show a win percentage for each player, updating as the score changes. It comes from the same model as the 1v1 comparison.",
      ),
      text(
        "It is the first place predictions turn up without you going looking for them, which turns out to be a very effective way to start an argument about whether the rating system is fair.",
      ),
    ],
  },
  {
    slug: "serve-tracker",
    title: "Serve tracker",
    date: "2026-06-25",
    tags: ["new-feature"],
    summary: "The app works out whose serve it is and shows it next to the score.",
    body: [
      text(
        "Whose serve it is now appears in the game tracker, the live game pages, the TV overlay and the live game card on the leaderboard. No need to remember it.",
      ),
      text(
        "Serve alternates every two points, and every point at deuce - trivially simple, universally forgotten mid-rally, and entirely derivable from the score.",
      ),
    ],
  },
  {
    slug: "major-performance-improvements-to-predictions",
    title: "Major performance improvements to predictions",
    date: "2026-06-24",
    tags: ["technical"],
    summary:
      "The prediction engine was rebuilt around pre-computed lookups and memoisation, and its slowest part moved to a background thread.",
    body: [
      text(
        "Predictions are dramatically faster, and pages that show them no longer freeze while they are worked out. Four changes got it there:",
      ),
      list(
        "Stats for every pair of players are accumulated once up front, so looking up how two people have done against each other is a direct map lookup rather than a pass over the full game list.",
        "A map of who has played whom is built lazily and reused. Predictions that have to route through a shared opponent - because the two players have never met - use it to find the overlap instead of searching for it.",
        "One-layer and two-layer results are memoised, and each result is stored under both player orderings, so A against B and B against A share an entry.",
        "Converting point odds into set odds into game odds reads from pre-computed probability tables instead of being derived on every call.",
      ),
      text(
        "The slowest remaining piece, the prediction history timeline, moved into a web worker alongside the tournament and Elo simulations. Graphs now fill in while you scroll.",
      ),
      text(
        "For context on the size of the problem: the old engine walked every game in the league to answer a single question about two players, and did it again from scratch on every request, synchronously. Anything cached needs invalidating, and one new game changes every prediction involving those two players, so the engine has an explicit cache clear.",
      ),
    ],
  },
  {
    slug: "stealth-theme",
    title: "New theme: Stealth",
    date: "2026-06-24",
    tags: ["new-feature"],
    summary: "Black on dark greyscale, for when you would rather the leaderboard did not glow.",
    body: [
      text("No colour at all - black backgrounds, greyscale text."),
      text(
        "Unlike the seasonal themes it is not tied to a date, and unlike the per-organisation themes it is not tied to where you work. Pick it in settings as a theme override and it stays until you change it back.",
      ),
    ],
  },
  {
    slug: "deno-kv-to-sql",
    title: "Deno KV → SQL",
    date: "2026-06-20",
    tags: ["technical"],
    summary:
      "The event store now runs on SQL, which also changed where the database is hosted and how the server is deployed.",
    body: [
      text("Events live in SQL behind a database interface with two implementations:"),
      list(
        "SQLite for local development, so the server runs with no external service at all.",
        "A hosted Postgres in production, on a new database provider.",
      ),
      text(
        "The schema is a single file, which replaced the inline migrations that used to run on server startup.",
      ),
      text(
        "The store it replaced was Deno KV - a fine place to start, with no schema and no connection string, but reading the full event log meant paging through a key-value list, a single value was capped at 64 KiB, and there was no way to ask it anything more specific than 'give me everything'. SQL answers questions.",
      ),
    ],
  },
  {
    slug: "hall-of-fame-scoring-update",
    title: "Update to hall of fame scoring",
    date: "2026-06-19",
    tags: ["feature-update"],
    summary: "Peak Elo, podium time and a games won/lost split, plus a leaderboard of everyone who has ever played.",
    body: [
      text("The career score now weighs three more things:"),
      list(
        "All-time high Elo rather than final rating, so retiring after a bad run does not erase a good year.",
        "Podium time - how long you spent in the top three, measured over time rather than counted.",
        "Experience split into games won and games lost, so showing up counts for something even when it did not go well.",
      ),
      text(
        "Peak Elo is now also correct for players who never crossed the ranked threshold. They have no leaderboard entries to read a peak from, and used to score zero rather than their actual best.",
      ),
      text(
        "There is a new page too: a leaderboard ranking every player who has ever played, active and retired, together. It is not a real standing, and it is the most argued-about screen in the app.",
      ),
    ],
  },
  {
    slug: "optio-pong",
    title: "Optio Pong",
    date: "2026-06-10",
    tags: ["new-feature"],
    summary: "A playable pong game, under the simulations page.",
    body: [
      text(
        "Entirely self-contained, with no connection to the event store, the leaderboard or anything else. It does not affect your Elo. It is on its fourth version.",
      ),
    ],
  },
  {
    slug: "9-new-achievements",
    title: "9 new achievements",
    date: "2026-05-17",
    tags: ["new-feature"],
    summary: "David and Goliath, Marathon Set, Streak Ender, Group Stage Star, and five derived from Elo and rank.",
    body: [
      text(
        "Some reward beating the odds: David for taking down a much higher-rated player, Goliath for holding your ground against the field below you, Streak Ender for being the one who breaks someone's run.",
      ),
      text(
        "Marathon Set is league-wide rather than personal - it belongs to whoever played the longest deuce battle on record, and moves when someone plays a longer one.",
      ),
      text(
        "Achievement cards also carry context now, so a card can tell you who you beat and by how much rather than only when you earned it.",
      ),
    ],
  },
  {
    slug: "elo-scores-are-now-static-over-time",
    title: "Elo scores are now static over time",
    date: "2026-05-14",
    tags: ["feature-update"],
    summary: "Your rating and your history only change when you play. Nothing else moves them.",
    body: [
      text(
        "Retired players stay in the Elo calculation. They are filtered out of the standings, but their games remain part of history, so your score and your graph move when you play and at no other time. Previously, deactivating a player pulled their games out of the replay and recalculated everyone they had ever played - a rating you earned in March could shift in May because a colleague left.",
      ),
      text("Two reasons that is worth more than it sounds:"),
      list(
        "Ownership. Your score and your history are yours. If they change without you playing, they are worth less to you.",
        "It lets other features depend on a score. Achievements tied to your Elo or your leaderboard rank, and Hall of Fame scoring built on peak rating and time on the podium, all need numbers that do not move underneath them.",
      ),
      text(
        "There is a real cost. Elo is zero-sum, so when a high-ranked player retires their points stay out of play for good rather than being redistributed. That is a genuine downside - it is just rare enough to be worth paying for what it buys, and a pile of achievements plus a career score players can trust is worth considerably more than the occasional pocket of points sitting out of circulation.",
      ),
      text("This is a call that went back and forth a few times before it settled here."),
    ],
  },
  {
    slug: "live-game-pages-and-tv-overlay",
    title: "Live game pages and TV overlay",
    date: "2026-04-23",
    tags: ["new-feature"],
    summary:
      "A public and an admin page for a game in progress, plus a chrome-free overlay for putting the score on a screen next to the table.",
    body: [
      text(
        "One page for whoever is running the score, one for everyone watching. State lives on the server and is pushed to viewers over the existing WebSocket connection, so the public page never polls.",
      ),
      text(
        "The overlay is a separate route that renders with no menu, header or padding, so it can be captured and shown on a TV. It has a zoom option for different screen sizes and a fallback refetch for when the connection drops mid-match.",
      ),
    ],
  },
  {
    slug: "hall-of-fame",
    title: "Hall of Fame",
    date: "2026-03-07",
    tags: ["new-feature"],
    summary: "A place for players who have left, so the leaderboard can be about the people still playing.",
    body: [
      text(
        "Retired players get their own page, ranked by a career score built from what they did while they were active, with a page for each of them.",
      ),
      text(
        "It gives leaving a third option. Before, someone who left could either sit on the leaderboard forever slowly sinking, or be deactivated and disappear as though they had never played - which is why nobody was ever deactivated.",
      ),
    ],
  },
  {
    slug: "create-tournaments-in-the-app",
    title: "Admins can create tournaments without a deploy",
    date: "2026-02-22",
    tags: ["feature-update"],
    summary: "Tournaments are created and edited in the app.",
    body: [
      text(
        "There is a form now: create a tournament, edit it, set the start date, adjust the players. The Finals and Group Play tabs also stay hidden until a tournament has actually started.",
      ),
      text(
        "Every tournament used to be a code change and a deploy - the history is full of commits like 'start optio tournament' and 'remove vlad from tournament'. That works right up until the person who wants the tournament is not the person who wrote the app.",
      ),
    ],
  },
  {
    slug: "recent-games-page",
    title: "Recent games page",
    date: "2026-02-20",
    tags: ["new-feature"],
    summary: "A page for recent results, with scores and an overall/season toggle.",
    body: [
      text("Recent results have a page of their own, showing:"),
      list(
        "Actual scores, not just winner and loser.",
        "A toggle between overall and season points - the same game is worth different amounts in each.",
        "Profile pictures, and column headers.",
      ),
      text(
        "It had been a small widget on the leaderboard showing the last handful of results. That widget is the most-looked-at thing in the app, and it kept outgrowing its box.",
      ),
    ],
  },
  {
    slug: "seasons",
    title: "Seasons",
    date: "2026-01-22",
    tags: ["new-feature"],
    summary: "A leaderboard that resets, so joining late does not mean you can never win anything.",
    body: [
      text(
        "Seasons run on a schedule, each with its own leaderboard, podium, graph and per-player page, plus an achievement for winning one. Finish level on points and the player who played more games takes it - turnout beats protecting a rating.",
      ),
      text(
        "It exists because an all-time rating settles at the top. If you joined last month you are not catching someone with 600 games no matter how well you play, and 'you cannot win' is a poor reason to keep playing. A season is short enough to be worth entering.",
      ),
      text(
        "It spent two months visible only to logged-in players while the edges were worked out: what happens to games played right on a boundary, and how a season interacts with achievements. There is a FAQ page, which is the tell for a feature people have opinions about.",
      ),
    ],
  },
  {
    slug: "events-cached-in-your-browser",
    title: "Events cached in your browser",
    date: "2025-11-25",
    tags: ["technical"],
    summary: "The app stores the event log locally and only fetches what happened since your last visit.",
    body: [
      text(
        "Your browser keeps the event log. On startup the app reads its cache, finds the newest event it already has, and asks the server only for what came after it - so on a warm cache a page load fetches almost nothing and starts almost immediately.",
      ),
      text(
        "It is the fix for the cost of a thick client: projecting the full event log means downloading the full event log, which was fine at a few hundred events and less fine at tens of thousands.",
      ),
      text("Settings has a button to clear the cache, because every cache eventually needs a manual escape hatch."),
    ],
  },
  {
    slug: "tournament-win-predictions",
    title: "Tournament win predictions",
    date: "2025-11-15",
    tags: ["new-feature"],
    summary: "Who is likely to take the whole tournament, from simulating the bracket thousands of times.",
    body: [
      text(
        "Tournaments show each player's chance of winning the whole thing. It plays the bracket out thousands of times and counts who ends up with the trophy, accounting for the games already played and the ones that were skipped. It runs in a web worker, so the page stays responsive while it works.",
      ),
      text(
        "Skips had to become part of the event log for this: replaying a bracket needs to know when a game was skipped, not just that it was. That also made undoing a skip possible.",
      ),
      text(
        "The tournament page was split into tabs in the same stretch, since a bracket, a group table, a signup list and a prediction chart do not fit on one phone screen.",
      ),
    ],
  },
  {
    slug: "achievements",
    title: "Achievements",
    date: "2025-11-08",
    tags: ["new-feature"],
    summary: "Two dozen achievements with progress tracking, on player pages and a page of their own.",
    body: [
      text(
        "Achievements are rules evaluated against your history, and the ones you have not earned show how far along you are. The first batch included Nice Game, Close Calls, Edge Lord, Consistency Is Key, Variety Player, Best Friends, Welcome Committee, Community Builder and a set of tournament achievements.",
      ),
      text(
        "Deciding what counts as 'active' turned out to be the hard part, and rules like 'win 5 in a row without dropping a set' are very easy to get subtly wrong - there are now over 30 test files covering them.",
      ),
    ],
  },
  {
    slug: "track-a-game-point-by-point",
    title: "Track a game point by point",
    date: "2025-10-21",
    tags: ["new-feature"],
    summary: "Put a phone on the table, tap points as they happen, and save the finished game.",
    body: [
      text(
        "The tracker records a game while you play it and hands the result straight to the add-game flow, so nothing has to be remembered afterwards.",
      ),
      text("Adding a game now starts with a choice: a finished game you type in, or a live one you track."),
    ],
  },
  {
    slug: "player-network-graph",
    title: "Player network graph",
    date: "2025-08-28",
    tags: ["new-feature"],
    summary: "A graph of who plays whom, with thicker connections where two people play each other more.",
    body: [
      text(
        "Players are nodes, games are the connections between them. It shows you the shape of the league: who plays whom, who plays everyone, and which parts of the office have never met across a table.",
      ),
      text(
        "That last one matters more than it looks - two clusters that never play each other cannot be meaningfully ranked against each other, which is the thing that quietly undermines any rating system. Lives under the simulations page, showing active players.",
      ),
    ],
  },
  {
    slug: "opponent-score-distribution",
    title: "Opponent score distribution graph",
    date: "2025-08-14",
    tags: ["new-feature"],
    summary: "How many points your opponents actually score against you, not just whether they won.",
    body: [
      text(
        "The graph shows the spread of scores your opponents put up against you, so you can see whether your wins are comfortable or narrow. Bars span only the real minimum and maximum, since a bar starting at zero would imply you have conceded every score below it.",
      ),
      text(
        "It answers something a win/loss record cannot: beating someone 11-9 five times is a very different relationship from beating them 11-2 five times.",
      ),
    ],
  },
  {
    slug: "expected-leaderboard",
    title: "Expected leaderboard",
    date: "2025-06-17",
    tags: ["new-feature"],
    summary: "What the standings would look like if everyone played everyone the same number of times.",
    body: [
      text(
        "It simulates the games that never happened - every player against every other player, using the prediction model for each matchup - and ranks the results. A leaderboard with the schedule taken out of it.",
      ),
      text(
        "Useful because the real standings are partly a ranking of skill and partly a ranking of who you happened to play: beat the same three people forty times and your rating says something quite narrow. This is not the real leaderboard and is not meant to replace it. It is the answer to 'yes, but'.",
      ),
    ],
  },
  {
    slug: "simulations-moved-to-a-web-worker",
    title: "Simulations moved to a web worker",
    date: "2025-06-04",
    tags: ["technical"],
    summary:
      "The first web worker in the app. Heavy simulations run on a background thread, so the page stays responsive while they work.",
    body: [
      text(
        "Simulations run on a background thread. The page stays interactive while they work, and the progress bar actually moves, because the worker posts progress back as it goes.",
      ),
      text(
        "On the main thread, tens of thousands of simulated games meant the page simply stopped - no scrolling, no button presses, eventually a browser warning that the tab was unresponsive. A loading spinner could not help, because the thread that would animate it was the one doing the work.",
      ),
      text(
        "The payoff arrived the next day: with the main thread free, the iteration count went up. Work that had been kept small to avoid freezing the page could be as expensive as it needed to be.",
      ),
      text(
        "This became the pattern for everything heavy since. Elo simulation, tournament win predictions and prediction history all run in workers, and it is what makes a browser-side rating engine practical at all.",
      ),
    ],
  },
  {
    slug: "player-page-rebuilt",
    title: "Player page rebuilt with tabs",
    date: "2025-06-03",
    tags: ["feature-update"],
    summary: "Elo history, games, stats and achievements split into tabs instead of one very long scroll.",
    body: [
      text(
        "The player page is organised into tabs, with an overview that leads on graphs. The Elo timeline has a range slider, so you can zoom into a month instead of squinting at two years of history.",
      ),
      text(
        "Mobile padding was cut throughout at the same time - on a phone held next to the table, every wasted pixel costs a row of data.",
      ),
      text(
        "It was built as a parallel page and swapped in once ready, so the old one kept working and the two could be compared side by side.",
      ),
    ],
  },
  {
    slug: "game-scores",
    title: "Game scores",
    date: "2025-05-30",
    tags: ["new-feature"],
    summary: "Games record 11-9, 11-7, 9-11 instead of just who won, and can be corrected afterwards.",
    body: [
      text(
        "Games carry their scores. Set points are optional, so a game played to one set records cleanly, and a score can be edited after the fact for when you typo.",
      ),
      text(
        "Most of the work went into the input: entering four or six numbers on a phone, standing up, next to a table.",
      ),
      text(
        "Scores made a lot of later work possible - the opponent score graph, close-call achievements, Marathon Set, the serve tracker, and predictions that reason about points and sets rather than just wins. The original model was two players and a winner, which is all Elo needs and throws away everything people actually talk about afterwards.",
      ),
    ],
  },
  {
    slug: "k-factor-decay-reverted",
    title: "K-factor decay tried and reverted",
    date: "2025-04-10",
    tags: ["removed-feature", "technical"],
    summary: "A game moves your rating by the same amount no matter how many you have played.",
    body: [
      text(
        "K, the factor controlling how much a single game moves your rating, is a constant again. It is the same for a player with 20 games and one with 500.",
      ),
      text(
        "For two months it decayed: past 200 games it fell from 32 towards a floor of 10, copying chess federations, where lowering K for established players stops one bad Tuesday undoing a year.",
      ),
      text(
        "An office league is not a chess federation. A decaying K freezes the top of the table - the players with the most games become the hardest to move, so a newcomer who is genuinely better has to grind through games that barely register. It made the leaderboard more stable and less true.",
      ),
      text("The parameters are still in the function signature, ignored, in case the idea ever comes back."),
    ],
  },
  {
    slug: "easter-theme",
    title: "New theme: Easter",
    date: "2025-03-30",
    tags: ["new-feature"],
    summary: "Spring colours and an Easter logo, including a matching pass over the admin page.",
    body: [
      text(
        "The second seasonal theme: Easter colours, a themed logo, and a debug easter bunny that lasted exactly one day.",
      ),
      text(
        "It gets switched off again once the season passes, rather than lingering until somebody notices it is June.",
      ),
    ],
  },
  {
    slug: "event-sourcing",
    title: "Event sourcing",
    date: "2025-03-29",
    tags: ["technical"],
    summary:
      "The database is an append-only log of events, projected into state in the browser. The biggest change the project has had.",
    body: [
      text(
        "Everything is an event - player created, game created, tournament signup - appended and never updated. State is what you get by replaying them, and the full history is always there to be asked about.",
      ),
      text(
        "Almost everything since depends on it: seasons replay a date window, achievements are evaluated against history, prediction timelines walk it, and the event backup is just the log.",
      ),
      text(
        "What it replaced was tables of players and games, where deleting a game deleted a row and renaming a player rewrote a name and quietly broke every game referencing the old one. There was no way to ask what the leaderboard looked like in November, because November was gone.",
      ),
      text(
        "The painful part of getting here was that player names had been primary keys since the first commit, so every reference had to move to an id while existing data was translated in place. With the server reduced to storing opaque payloads, validation moved to the client that creates them.",
      ),
    ],
  },
  {
    slug: "theme-system",
    title: "Theme system",
    date: "2025-03-19",
    tags: ["technical"],
    summary: "Themes are CSS variables, so adding one is a list of colours rather than a pass through every component.",
    body: [
      text(
        "Colours come from CSS variables exposed through Tailwind as primary, secondary and tertiary text and background pairs. Components never learn which theme is active.",
      ),
      text(
        "The detail that makes it usable is opacity support, so modifiers like `/50` still work on a themed colour - without it every border and divider in the app would have needed a hardcoded value.",
      ),
      text(
        "There are now four per-organisation themes plus Halloween, Easter and Stealth, and any of them can be picked as an override in settings. The previous approach branched inside components, which was survivable for three themes and would not have survived a fourth.",
      ),
    ],
  },
  {
    slug: "one-app-several-organisations",
    title: "One app, several organisations",
    date: "2025-03-15",
    tags: ["technical"],
    summary: "Each organisation gets its own theme, logo, tournaments and ranked threshold from a config layer.",
    body: [
      text(
        "A client config gives each organisation its own theme and logo, page title and favicon, its own tournaments, and its own threshold for how many games you must play to be ranked. There are six of them now, plus one for local development.",
      ),
      text(
        "The ranked threshold is the setting that moves most - anywhere between 5 and 30 games, depending on how much the office actually plays.",
      ),
      text("Before this the app was built for one office. The difference between 'our tool' and 'a tool' was a config object."),
    ],
  },
  {
    slug: "group-play",
    title: "Group play in tournaments",
    date: "2025-02-26",
    tags: ["new-feature"],
    summary: "A group stage before the bracket, so a tournament is worth turning up to even if you lose early.",
    body: [
      text(
        "Everyone plays several games in a group, and the group results seed the bracket. A knockout on its own gives half the field exactly one game.",
      ),
      text(
        "The hard part is distribution: near-equal groups from an arbitrary number of signups, seeded so the strong players do not all land together, and still sensible when someone drops out an hour before.",
      ),
    ],
  },
  {
    slug: "future-elo-predictions",
    title: "Future Elo predictions",
    date: "2025-02-05",
    tags: ["new-feature"],
    summary: "Where your rating is heading, as a range with a confidence that grows as you play.",
    body: [
      text(
        "Your recent results are simulated forward to show where your rating is likely to end up - as a band rather than a single number, with the confidence shown alongside it and visibly tightening the more you play.",
      ),
      text(
        "Confidence is the interesting problem. A prediction built on your last three games should be held loosely; one built on two hundred should not. Recent games matter more than old ones, so the weighting decays, and how fast it decays is a judgement call dressed up as a parameter. It now runs off a half-life and an exponent that can be reasoned about rather than a set of hardcoded weights.",
      ),
    ],
  },
  {
    slug: "simulations-page",
    title: "Simulations page",
    date: "2025-01-29",
    tags: ["new-feature"],
    summary: "A section of the app for the speculative tools, away from the standings.",
    body: [
      text(
        "Monte Carlo charts, expected wins and the other what-if tools have their own section, separate from the leaderboard. The standings are a fact; a simulation is an argument, and the two read better apart.",
      ),
      text(
        "It has since become the app's back room - expected leaderboard, individual points, win/loss, the player network and a playable pong game all live there. If something is interesting but not authoritative, that is where it goes.",
      ),
    ],
  },
  {
    slug: "tournaments",
    title: "Tournaments",
    date: "2024-11-24",
    tags: ["new-feature"],
    summary: "Brackets with seeding and signup, skips for no-shows, and a list view for small screens.",
    body: [
      text(
        "Tournaments have a signup flow and a bracket with seeding, so the top two do not meet in round one. Skips handle people who do not turn up, and are reversible. There is a list view as well as a tree, because a bracket on a phone is mostly horizontal scrolling.",
      ),
      text(
        "Pending tournament games show up in the add-game page so you do not have to remember who you owe a match, and the game you just entered scrolls into view and wiggles.",
      ),
      text("A leaderboard measures the long run. A tournament produces an evening."),
    ],
  },
  {
    slug: "halloween-theme",
    title: "New theme: Halloween",
    date: "2024-10-29",
    tags: ["new-feature"],
    summary: "Pumpkin colours and a pumpkin logo for October. The first theme the app had.",
    body: [
      text(
        "Orange and dark colours throughout, with a pumpkin version of the logo in the nav menu. It comes back every October.",
      ),
      text(
        "Being the first theme, it was built the direct way - conditionals inside components and hardcoded colours. That works for exactly one theme, and it is why the theming was rebuilt properly a few months later.",
      ),
    ],
  },
  {
    slug: "farmer-score-removed",
    title: "Farmer score removed",
    date: "2024-10-28",
    tags: ["removed-feature"],
    summary: "The metric measuring how much you farmed easy opponents is gone, four days after it arrived.",
    body: [
      text("The farmer score column and its page are gone. Nothing on the leaderboard grades who you choose to play."),
      text(
        "It measured a real thing - Elo has a known exploit in a small league, where you find someone below you, beat them repeatedly and bank the points. The metric worked. The problem was social: a public number labelling colleagues as farmers turns a friendly leaderboard into an accusation.",
      ),
      text(
        "The underlying question survived in better forms: the player network, the player diversity chart, the Variety Player and Community Builder achievements, and the expected leaderboard. Same concern, reframed from 'you are farming' to 'play more people, it is more fun'.",
      ),
    ],
  },
  {
    slug: "camera-profile-pictures",
    title: "Profile pictures from your camera",
    date: "2024-10-16",
    tags: ["new-feature"],
    summary: "Take a photo and crop it in the app, instead of uploading a file.",
    body: [
      text("Point your camera at yourself, crop, done. Faces appeared on the leaderboard within a day."),
      text(
        "Profile pictures had existed for months and almost nobody had one, because uploading a photo of yourself from a work laptop starts with finding a photo of yourself on a work laptop.",
      ),
    ],
  },
  {
    slug: "leaderboard-calculation-in-the-browser",
    title: "Leaderboard calculation moved to the browser",
    date: "2024-10-14",
    tags: ["technical"],
    summary: "The server ships raw data and the browser does the projection. The decision the whole app now rests on.",
    body: [
      text(
        "One endpoint returns everything, and the client projects it into leaderboards, stats and everything else. The backend stopped calculating standings entirely.",
      ),
      text(
        "It works because the data is small, the derived views are many and varied, and the calculations are pure. Ship the data once and the client can answer any question about it without a round trip - seasons, achievements, the expected leaderboard and the player network needed no backend work at all.",
      ),
      text(
        "The cost is a real startup wait on a cold cache, and most of the caching and web-worker work since exists to pay for it. Before, the server replayed every game on every request and returned a ranked list, which meant every page wanting a slightly different cut of the data needed a new endpoint.",
      ),
    ],
  },
  {
    slug: "live-updates-over-websockets",
    title: "Live updates over WebSockets",
    date: "2024-09-26",
    tags: ["new-feature", "technical"],
    summary: "A game entered on one phone shows up on every other screen immediately, with no refresh.",
    body: [
      text(
        "New events are broadcast to every connected client, so the leaderboard updates itself while you are standing around the table looking at it.",
      ),
      text(
        "The same channel now carries cache invalidation when an admin edits an event, and it is what lets the live game page and the TV overlay work without polling.",
      ),
      text(
        "Keeping a long-lived connection honest to a browser tab that might be asleep, on a laptop that might be in a bag, took considerably longer than opening it in the first place - heartbeats, retries and shutdown cleanup.",
      ),
    ],
  },
  {
    slug: "accounts-and-profile-pictures",
    title: "Accounts and profile pictures",
    date: "2024-06-10",
    tags: ["new-feature"],
    summary: "Sign-up, sessions that expire, and permissions - plus the first profile pictures.",
    body: [
      text(
        "You can sign up, and what you are allowed to do depends on your role rather than being open to everyone. Sessions log you out when the token expires, and permissions are checked per resource rather than behind one admin flag.",
      ),
      text(
        "Including the check that stops an admin from removing their own access, which is the kind of thing you add immediately after doing it once.",
      ),
      text("Profile pictures arrived in the same batch."),
    ],
  },
  {
    slug: "unranked-players",
    title: "Unranked players and the ranked threshold",
    date: "2024-05-23",
    tags: ["new-feature"],
    summary: "New players are listed as unranked with a games-played count until they have played enough to be ranked.",
    body: [
      text(
        "Play a handful of games and you appear on the leaderboard. Before that you are listed separately as unranked, with a count so you can see how close you are.",
      ),
      text(
        "It exists because a fresh rating is 1000 and your first game against a decent player takes points off it - so a new player used to join, lose, and land at the bottom of a public leaderboard with their name and face on it.",
      ),
      text(
        "The threshold is per-organisation, and there is now a Ranked achievement for crossing it. Same mechanic, better framing.",
      ),
    ],
  },
  {
    slug: "the-first-version",
    title: "The first version",
    date: "2024-05-09",
    tags: ["technical"],
    summary: "Day one: a Deno server, a key-value store, players, games and fifty lines of Elo.",
    body: [
      text(
        "A server with routes for players and games, and by the end of the day, Elo: seed everyone at 1000, replay every game in order, sort the result.",
      ),
      text(
        "Almost every decision visible in it has since been reversed. The calculation moved to the browser, names became ids, the tables became an event log, and the key-value store became SQL.",
      ),
      text(
        "What survived is `K = 32`, a starting rating of 1000, and the shape of the Elo update - expected score from the rating difference, then a K-weighted correction. The arithmetic is still line for line the same.",
      ),
    ],
  },
];

/** Newest first. */
export function getChangelogPosts(): ChangelogPost[] {
  return [...CHANGELOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function getChangelogPost(slug: string): ChangelogPost | undefined {
  return CHANGELOG_POSTS.find((post) => post.slug === slug);
}

/** How many posts carry each tag. Used for the counts in the filter row. */
export function changelogTagCounts(): Map<ChangelogTag, number> {
  const counts = new Map<ChangelogTag, number>();
  CHANGELOG_POSTS.forEach((post) => {
    post.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  return counts;
}
