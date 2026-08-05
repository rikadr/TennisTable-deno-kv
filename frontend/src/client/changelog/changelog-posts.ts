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
 * A small change to a feature that already has a post is an edit to that post,
 * not a new one - and if it is not worth the edit, it is not worth recording at
 * all. See the Changelog section of CLAUDE.md for the full criteria.
 *
 * `new-feature` is for a feature that did not exist before. Anything added
 * inside a feature that already shipped is a `feature-update`, however new it
 * is to play with - new achievements update Achievements, a tournament format
 * or tab updates Tournaments, and a new theme updates Theme support.
 *
 * Write in ASD-STE100 Simplified Technical English: short sentences, active
 * voice, simple present tense, one idea per sentence, consistent terms, and no
 * idioms, metaphors or humour. Keep only the most valuable content. The reader
 * must understand a post quickly and correctly. Write about what is new, and
 * describe the behaviour before the change only where that is necessary.
 */
export const CHANGELOG_POSTS: ChangelogPost[] = [
  {
    slug: "shootout-season-opener-and-record-david-goliath",
    title: "3 new achievements, and David & Goliath become league records",
    date: "2026-08-04",
    tags: ["feature-update"],
    summary:
      "Shootout 💥, Season Opener 🌱 and Milestone Game 🏁 are new. David 🪨 and Goliath 🗿 are now league records. Perfect Week 🗓️ accepts any 5 consecutive days.",
    body: [
      list(
        "Shootout 💥 - the league record for the most points in one game. Only the 3 legal sets with the most points count, so a best-of-5 game competes on equal terms with a best-of-3. A game with 60 points or more sets the first record. A game with an illegal set score does not compete at all. A score of 15-12 is illegal, because above 11 a player must win a set by exactly 2 points. Bonus points from house rules therefore cannot increase a total.",
        "Season Opener 🌱 - both players of the first game of a season earn this. It returns every quarter. All players see the same progress view, which counts down to the start of the next season. The view stays at 100% from the start of a season until the first game of it.",
        "Milestone Game 🏁 - both players of every 500th game in the league earn this. Deleted games do not count. All players see the same progress view, and it restarts at each milestone.",
      ),
      text(
        "David 🪨 and Goliath 🗿 are now league records instead of fixed thresholds. The first Score swing of 20 or more set the record. After that you must beat it: a larger gain in one game takes David, and a larger loss takes Goliath. Score is zero-sum, so one upset moves both records together. The app calculates achievements from history, so some earlier David and Goliath awards are gone. Only the record upsets remain, and the progress view shows the record and its holder.",
      ),
      text(
        "Perfect Week 🗓️ accepts a win on any 5 consecutive days in the same week. Monday to Friday, Tuesday to Saturday and Wednesday to Sunday all count. A run that continues into the next week does not count. A loss does not stop a run, because only the wins count.",
      ),
    ],
  },
  {
    slug: "hero-of-the-day-achievement",
    title: "3 new achievements: Hero of the Day, Week and Month",
    date: "2026-08-03",
    tags: ["feature-update"],
    summary:
      "Three league records for the most games in a period: one day, one week and one calendar month. The first period with 3 games sets each record.",
    body: [
      list(
        "Hero of the Day 🦸 - the most games in one calendar day.",
        "Hero of the Week 🦸‍♂️ - the most games in one week, Monday to Sunday.",
        "Hero of the Month 🦸‍♀️ - the most games in one calendar month.",
      ),
      text(
        "All three are league records, the same as Marathon Set and the streak records. A player holds them. The first player with 3 games in a period sets the record for that period. After that you must play more games than the record to take it. Wins and losses both count.",
      ),
      text(
        "One award covers the full record period. If you play more games while you hold the record, that award grows. It does not become a second award. The three records are independent, so one busy day also adds to your week and your month.",
      ),
      text(
        "The progress view shows your current day, week and month against the records. It also shows your highest count and the holder of each record.",
      ),
    ],
  },
  {
    slug: "retirement-achievements",
    title: "2 new achievements for retiring and coming back",
    date: "2026-08-03",
    tags: ["feature-update"],
    summary: "Retired 🪦 is for a player who leaves the league. Back From The Dead 🧟 is for a player who returns.",
    body: [
      list(
        "Retired 🪦 - you earn this when you retire from the league. You earn it for each retirement.",
        "Back From The Dead 🧟 - you earn this when you return after a retirement. The card shows the length of your absence.",
      ),
      text("The 2-year comeback achievement had the Back From The Dead name before. It is now A Cinderella Story 👸."),
      text(
        "The Everyone's Progress view on the achievements page now includes retired players. Each one has a Retired badge.",
      ),
    ],
  },
  {
    slug: "win-chance-predictions-for-unranked-and-retired-players",
    title: "Win chance predictions for unranked and retired players on Compare 1v1",
    date: "2026-07-31",
    tags: ["feature-update"],
    summary:
      "Compare 1v1 predicts a game between retired players. For an unranked player it shows the prediction after you accept a warning.",
    body: [
      text(
        "A retired player now gets a prediction. Their game history is all the model needs, and retirement does not change that history.",
      ),
      text(
        "If one player or both players are unranked, the prediction card offers to show the prediction. Accept the warning and you get the same numbers as any other pair. A banner above the numbers shows that the data is thin. The predictions tab on a player page works the same way.",
      ),
      text(
        "A player with no games gets no prediction, and the card says so. A pair with no chain of games between them also gets no prediction. Before this change the card showed 0% at 0% confidence for such a pair.",
      ),
    ],
  },
  {
    slug: "longest-win-and-lose-streak-achievements",
    title: "2 new achievements: Longest Win Streak and Longest Lose Streak",
    date: "2026-07-30",
    tags: ["feature-update"],
    summary:
      "Two league records: one for consecutive wins and one for consecutive losses. The holder keeps the award, and the award grows with the streak.",
    body: [
      text(
        "Longest Win Streak goes to the player with the most wins in sequence. Longest Lose Streak goes to the player with the most losses in sequence. You take a record when you beat the streak that stands. The award shows the length of your streak.",
      ),
      text(
        "If you extend a streak that already holds the record, that award grows. You do not get a second award. A win of your 11th game in sequence gives you one award worth 11.",
      ),
      text(
        "You can earn each record more than once. A new streak that beats the record earns its own award, so 10 wins, a loss, then 11 wins gives you 2 awards. If another player passes you while your streak continues, you earn a second award when you pass them again. The first award keeps the value it had.",
      ),
      text(
        "The first record in each direction needs 3 games in sequence. A tie does not count, so you must beat the record. The Progress tab shows your current streak, your longest streak and the record holder. The progress bar tracks your current streak only.",
      ),
    ],
  },
  {
    slug: "tournament-predictions-stream-running-tallies",
    title: "Tournament predictions update while they run",
    date: "2026-07-30",
    tags: ["feature-update"],
    summary: "A prediction draws a result every 2,000 simulations, so the graph fills in while it runs.",
    body: [
      text(
        "The prediction graph and the table below it now update while a time point runs. The numbers are the total from the simulations that are complete, and they become stable as the count increases. The table shows the progress, for example 40,000 of 50,000 simulations.",
      ),
      text(
        "The progress bar also moves inside a time point. Every setting streams the results, but a fast setting completes before there is much to see.",
      ),
      text(
        "Before this change, a time point showed nothing until all of its simulations were complete. The estimates are useful much earlier.",
      ),
    ],
  },
  {
    slug: "tournament-statistics-timeline",
    title: "A Statistics tab on tournaments",
    date: "2026-07-30",
    tags: ["feature-update"],
    summary:
      "Two widgets next to the bracket and info tabs: a timeline of the parts of the tournament, and the player pairs the tournament brought together.",
    body: [
      text(
        "The Statistics tab is next to the bracket and info tabs. It holds one widget for each statistic. The timeline draws one bar for each part of the tournament, across the days since the start.",
      ),
      list(
        "Group play, with one bar for each group",
        "The bracket, with one bar for each round",
        "For double elimination: the winners bracket, the second chance bracket and the grand final as separate sections",
      ),
      text(
        "The clock for a round starts when the round becomes possible to play, and stops at its last game. A round becomes possible when the round before it is complete. For a second chance bracket round, the winners bracket round that sends players to it must also be complete. The wait for players is therefore part of the time. Group play is the exception, because its groups run together from the start of the tournament.",
      ),
      text(
        "New connections is the second widget. It shows the players and pairs that the tournament brought together, measured against the club at the start of the tournament. One baseline keeps the numbers stable, so a pair that meets in group play and again in the bracket is one first meeting. Skipped games, byes and walkovers do not count.",
      ),
      list(
        "First-ever meetings - pairs who had never played each other",
        "Reunions - pairs who had not met for 6 months or more, and the length of the interval",
        "First game ever - players who had never played in the club",
        "Back after a break - players who return after 6 months or more, with the longest absence first",
        "First tournament - every player for whom this was a first tournament",
      ),
    ],
  },
  {
    slug: "player-pairings-widget",
    title: "Player pairings on the player page",
    date: "2026-07-28",
    tags: ["new-feature"],
    summary:
      "A widget in the Statistics tab. It groups the other players by the number of players that connect them to you.",
    body: [
      text(
        "The first column shows the players you have played, with the highest number of games first. The next column shows the players you have not played but who share an opponent with you. Then come the players 2 steps away, and so on. The last column shows the players with no chain of games to you.",
      ),
      text(
        "Point at a player in a middle column and the widget draws the chain back to a player you have played. The arrows point to you, and the other players fade. If several chains have the same length, the widget uses the chain with the most games on its last step. The same count sorts each column.",
      ),
      text(
        "A cog at the top right of the widget opens 2 settings. Each one recalculates the chains. Games per link is the more useful setting, because it removes the single games that make almost every player look 2 steps away.",
      ),
      list(
        "Include retired players - off by default. If it is off, only a game between 2 active players is a link. A retired player is then not a link between other players.",
        "Games per link - from 1 to 10. At 1, one game connects 2 players. At a higher value, only a pair who play each other that often count. A high value can move a player to the no-connection column.",
      ),
    ],
  },
  {
    slug: "earliest-and-latest-game-achievements",
    title: "2 new achievements: Earliest and Latest Game",
    date: "2026-07-27",
    tags: ["feature-update"],
    summary: "Records for the earliest game and the latest game in the league. They move when a player beats them.",
    body: [
      text(
        "These are league records, not personal records. Play at 06:12 and you take the Earliest Game record from its holder. Play late enough and you take the Latest Game record.",
      ),
    ],
  },
  {
    slug: "double-elimination-tournaments",
    title: "Double elimination tournaments",
    date: "2026-07-24",
    tags: ["feature-update"],
    summary: "A player who loses one game moves to the second chance bracket and continues to play.",
    body: [
      text(
        "You can now run a tournament as double elimination. Each player who loses moves to the second chance bracket and continues to play. The winner of the second chance bracket plays the winners bracket champion in the grand final.",
      ),
      text(
        "Double elimination is an option on the tournament form, next to single elimination. The bracket view, the pending games list and the signup all support it.",
      ),
      text(
        "The top of each bracket tab shows a card for the grand final. Click the card to open the grand final tab.",
      ),
    ],
  },
  {
    slug: "4-new-achievements",
    title: "4 new achievements",
    date: "2026-07-11",
    tags: ["feature-update"],
    summary: "Full House, Humbled, Perfect Day and Perfect Week.",
    body: [
      list(
        "Perfect Day and Perfect Week - play a minimum number of games in the period and win all of them.",
        "Full House - beat a large part of the league.",
        "Humbled - the opposite of Full House, for a day with no wins.",
      ),
      text("These achievements measure a run of games instead of a single result."),
    ],
  },
  {
    slug: "live-win-predictions",
    title: "Live win% predictions on tracked games",
    date: "2026-06-28",
    tags: ["new-feature"],
    summary: "A tracked game and a live game now show the win probability of each player while you play.",
    body: [
      text(
        "The live game pages and the TV overlay show a win percentage for each player. The percentage updates when the score changes. It comes from the same model as the 1v1 comparison.",
      ),
    ],
  },
  {
    slug: "serve-tracker",
    title: "Serve tracker",
    date: "2026-06-25",
    tags: ["new-feature"],
    summary: "The app calculates the player who must serve and shows it next to the score.",
    body: [
      text(
        "The player who must serve appears in the game tracker, the live game pages, the TV overlay and the live game card on the leaderboard.",
      ),
      text(
        "The serve changes after every 2 points. The house rule keeps 2 serves each for the whole set, also at 10-10. The app calculates the server from the score.",
      ),
    ],
  },
  {
    slug: "major-performance-improvements-to-predictions",
    title: "Major performance improvements to predictions",
    date: "2026-06-24",
    tags: ["technical"],
    summary:
      "The prediction engine now uses pre-computed lookups and memoisation. Its slowest part runs on a background thread.",
    body: [
      text("Predictions are much faster, and a page with predictions no longer freezes. Four changes did this:"),
      list(
        "The app accumulates the statistics for every pair of players one time. A lookup of the record between 2 players is now a direct map lookup.",
        "The app builds a map of who has played whom on demand and reuses it. A prediction that must route through a shared opponent uses this map to find the overlap.",
        "The app memoises the one-layer and two-layer results. It stores each result under both player orders, so A against B and B against A share one entry.",
        "The conversion from point odds to set odds to game odds reads from pre-computed probability tables.",
      ),
      text(
        "The prediction history timeline was the slowest remaining part. It moved into a web worker with the tournament and Elo simulations, so a graph now fills in while you scroll.",
      ),
      text(
        "Before this change, the engine walked every game in the league to answer one question about 2 players. It did this again on every request. The engine has an explicit cache clear, because one new game changes every prediction for those 2 players.",
      ),
    ],
  },
  {
    slug: "stealth-theme",
    title: "New theme: Stealth",
    date: "2026-06-24",
    tags: ["feature-update"],
    summary: "Black backgrounds and greyscale text. Press the S key twice to switch it on and off.",
    body: [
      text("Stealth has no colour."),
      text(
        "A seasonal theme depends on the date, and an organisation theme depends on your workplace. Stealth depends on neither. Select it in settings as a theme override and it stays until you change it.",
      ),
      text(
        "Stealth also has a shortcut. Press the S key twice, quickly, to switch it on. Press the S key twice again to go back to your usual theme. The shortcut does nothing while you type in a field, and it ignores a press with Ctrl, Cmd or Alt.",
      ),
    ],
  },
  {
    slug: "deno-kv-to-sql",
    title: "Deno KV → SQL",
    date: "2026-06-20",
    tags: ["technical"],
    summary: "The event store now runs on SQL. This also changed the database host and the server deployment.",
    body: [
      text("The events are in SQL, behind a database interface with 2 implementations:"),
      list(
        "SQLite for local development, so the server runs with no external service.",
        "A hosted Postgres in production, on a new database provider.",
      ),
      text("The schema is one file. It replaced the inline migrations that ran at server startup."),
      text(
        "The store before this was Deno KV. To read the full event log you had to page through a key-value list. One value had a limit of 64 KiB. You could not make a specific query, and SQL can answer one.",
      ),
    ],
  },
  {
    slug: "hall-of-fame-scoring-update",
    title: "Update to hall of fame scoring",
    date: "2026-06-19",
    tags: ["feature-update"],
    summary:
      "The career score now uses peak Elo, podium time and a split between games won and lost. There is also a leaderboard of every player.",
    body: [
      text("The career score now uses 3 more values:"),
      list(
        "The highest Elo of your career, not your final rating. A bad final year no longer removes a good year.",
        "Podium time - the time you spent in the top 3, not the number of times.",
        "Experience as games won and games lost, so a game counts even after a loss.",
      ),
      text(
        "Peak Elo is now also correct for a player who never became ranked. Such a player has no leaderboard entry to read a peak from, and scored zero before this change.",
      ),
      text("There is also a new page. It ranks every player who has played, active and retired, in one list."),
    ],
  },
  {
    slug: "optio-pong",
    title: "Optio Pong",
    date: "2026-06-10",
    tags: ["new-feature"],
    summary: "A pong game on the simulations page.",
    body: [
      text(
        "The game is self-contained. It has no connection to the event store or the leaderboard, and it does not change your Elo.",
      ),
    ],
  },
  {
    slug: "9-new-achievements",
    title: "9 new achievements",
    date: "2026-05-17",
    tags: ["feature-update"],
    summary:
      "David, Goliath, Marathon Set, Streak Ender, Group Stage Star, and 5 achievements from Elo and leaderboard rank.",
    body: [
      text(
        "Some achievements are for a result against the odds. David is for a win that gains a large amount of Score, which happens when you beat a much higher-rated player. Goliath is for the loss in the same game. Streak Ender is for the end of a run of wins by another player.",
      ),
      text(
        "Marathon Set is a league record instead of a personal one. It belongs to the player with the longest deuce set, and it moves when a player plays a longer one.",
      ),
      text(
        "An achievement card now also shows context. A card can show the opponent you beat and the score, not only the date.",
      ),
    ],
  },
  {
    slug: "elo-scores-are-now-static-over-time",
    title: "Elo scores are now static over time",
    date: "2026-05-14",
    tags: ["feature-update"],
    summary: "Your rating and your history change only when you play.",
    body: [
      text(
        "A retired player stays in the Elo calculation. The standings do not show them, but their games stay part of history. Your score and your graph therefore change only when you play. Before this change, the app removed the games of a deactivated player from the replay. It then recalculated every player they had played, so a rating from March could change in May.",
      ),
      text("Two reasons make this important:"),
      list(
        "Ownership. Your score and your history are yours. They are worth less if they change when you do not play.",
        "Other features can depend on a score. An achievement from your Elo or your rank, and a career score from peak rating and podium time, need numbers that are stable.",
      ),
      text(
        "There is a real cost. Elo is zero-sum, so the points of a retired player stay out of play. The app does not distribute them to the other players. This is rare, and stable achievements and a career score players can trust are worth more.",
      ),
    ],
  },
  {
    slug: "live-game-pages-and-tv-overlay",
    title: "Live game pages and TV overlay",
    date: "2026-04-23",
    tags: ["new-feature"],
    summary:
      "A public page and an admin page for a game in progress, and an overlay without app chrome for a screen next to the table.",
    body: [
      text(
        "One page is for the person who records the score. The other page is for everyone who watches. The state is on the server, and the server pushes it to viewers over the WebSocket connection. Each viewer also polls every few seconds, so the score follows the game if the connection stops.",
      ),
      text(
        "The overlay is a separate route with no menu, header or padding, so you can capture it and show it on a TV. It has a zoom option for different screen sizes. The poll continues while the tab is in the background, which a capture on a TV is.",
      ),
    ],
  },
  {
    slug: "hall-of-fame",
    title: "Hall of Fame",
    date: "2026-03-07",
    tags: ["new-feature"],
    summary: "A page for the players who left, so the leaderboard shows the players who still play.",
    body: [
      text(
        "A retired player gets a page of their own, with a rank from a career score. The score uses their results from the time they were active.",
      ),
      text(
        "A player who left had 2 options before this change. They could stay on the leaderboard and move slowly down, or the admin could deactivate them and they disappeared. The Hall of Fame is a third option.",
      ),
    ],
  },
  {
    slug: "create-tournaments-in-the-app",
    title: "Admins can create tournaments without a deploy",
    date: "2026-02-22",
    tags: ["feature-update"],
    summary: "An admin creates and edits a tournament in the app.",
    body: [
      text(
        "There is a form. Create a tournament, edit it, set the start date and change the players. The Finals and Group Play tabs stay hidden until the tournament starts.",
      ),
      text(
        "Every tournament was a code change and a deploy before this. That works only while the person who wants a tournament is also the person who writes the app.",
      ),
    ],
  },
  {
    slug: "recent-games-page",
    title: "Recent games page",
    date: "2026-02-20",
    tags: ["new-feature"],
    summary: "A page for recent results, with the scores and a toggle between overall and season points.",
    body: [
      text("The recent results have a page of their own. It shows:"),
      list(
        "The scores, not only the winner and the loser.",
        "A toggle between overall points and season points. One game is worth a different value in each.",
        "Profile pictures and column headers.",
      ),
      text("The recent results were a small widget on the leaderboard before this change."),
    ],
  },
  {
    slug: "seasons",
    title: "Seasons",
    date: "2026-01-22",
    tags: ["new-feature"],
    summary: "A leaderboard that resets, so a new player can also win something.",
    body: [
      text(
        "A season runs on a schedule. Each season has its own leaderboard, podium, graph and player pages, and there is an achievement for a season win. If 2 players have equal points, the player with more games wins.",
      ),
      text(
        "An all-time rating becomes stable at the top. A player who joined last month cannot pass a player with 600 games. A season is short enough to enter and to win.",
      ),
      text(
        "Seasons were visible only to logged-in players for 2 months. There is a FAQ page for the difficult cases. Examples are a game on a season boundary, and the effect of a season on an achievement.",
      ),
    ],
  },
  {
    slug: "events-cached-in-your-browser",
    title: "Events cached in your browser",
    date: "2025-11-25",
    tags: ["technical"],
    summary: "The app stores the event log in your browser and fetches only the events after your last visit.",
    body: [
      text(
        "Your browser keeps the event log. At startup the app reads its cache, finds the newest event it has, and asks the server only for the events after it. With a warm cache, a page load fetches almost nothing and starts almost immediately.",
      ),
      text(
        "A thick client must download the full event log to project it. That was acceptable at a few hundred events, and not at tens of thousands.",
      ),
      text("Settings has a button to clear the cache."),
    ],
  },
  {
    slug: "tournament-win-predictions",
    title: "Tournament win predictions",
    date: "2025-11-15",
    tags: ["feature-update"],
    summary: "A tournament shows the chance of each player to win it, from thousands of simulations of the bracket.",
    body: [
      text(
        "The app plays the bracket thousands of times and counts the winner of each simulation. It uses the games that are complete and the games that were skipped. It runs in a web worker, so the page stays responsive.",
      ),
      text(
        "A skip is now part of the event log, because a replay of a bracket must know when a game was skipped. This also made it possible to undo a skip.",
      ),
      text(
        "The tournament page became tabs at the same time. A bracket, a group table, a signup list and a prediction chart do not fit on one phone screen.",
      ),
    ],
  },
  {
    slug: "achievements",
    title: "Achievements",
    date: "2025-11-08",
    tags: ["new-feature"],
    summary: "More than 20 achievements with progress tracking, on the player pages and on a page of their own.",
    body: [
      text(
        "An achievement is a rule, and the app evaluates it against your history. For an achievement you have not earned, the app shows your progress.",
      ),
      text("The first group included:"),
      list(
        "Nice Game, Close Calls and Edge Lord",
        "Consistency Is Key and Variety Player",
        "Best Friends, Welcome Committee and Community Builder",
        "A set of tournament achievements",
      ),
      text(
        "The definition of an active player was the most difficult part. A rule such as 'win 5 games in sequence and lose no set' is easy to get wrong. There are now more than 30 test files for these rules.",
      ),
    ],
  },
  {
    slug: "track-a-game-point-by-point",
    title: "Track a game point by point",
    date: "2025-10-21",
    tags: ["new-feature"],
    summary: "Put a phone on the table, tap each point, then save the game.",
    body: [
      text(
        "The tracker records a game while you play it, then sends the result to the add-game flow. You do not have to remember the score.",
      ),
      text("To add a game you now select one of 2 options: a game that is complete, or a live game to track."),
    ],
  },
  {
    slug: "player-network-graph",
    title: "Player network graph",
    date: "2025-08-28",
    tags: ["new-feature"],
    summary: "A graph of who plays whom. A thicker connection shows more games between 2 players.",
    body: [
      text(
        "The players are the nodes and the games are the connections. The graph shows the shape of the league: who plays whom, who plays everyone, and which players have never played each other.",
      ),
      text(
        "The last one is the most important. If 2 groups of players never play each other, you cannot rank them against each other, and that weakens any rating system. The graph is on the simulations page and shows the active players.",
      ),
    ],
  },
  {
    slug: "opponent-score-distribution",
    title: "Opponent score distribution graph",
    date: "2025-08-14",
    tags: ["new-feature"],
    summary: "The number of points your opponents score against you, not only the result of the game.",
    body: [
      text(
        "The graph shows the spread of the scores your opponents make against you. You can see if you win by a large margin or a small margin. A bar spans only the real minimum and maximum, because a bar from zero would show scores you have never conceded.",
      ),
      text("A win/loss record cannot show this. Five wins at 11-9 are very different from five wins at 11-2."),
    ],
  },
  {
    slug: "expected-leaderboard",
    title: "Expected leaderboard",
    date: "2025-06-17",
    tags: ["new-feature"],
    summary: "The standings if every player played every other player the same number of times.",
    body: [
      text(
        "The app simulates the games that did not happen. It uses the prediction model for each pair of players, then ranks the results. The schedule has no effect on this leaderboard.",
      ),
      text(
        "The real standings are part a rank of skill and part a rank of the players you played. If you beat the same 3 players 40 times, your rating says little. This page is not the real leaderboard and does not replace it.",
      ),
    ],
  },
  {
    slug: "simulations-moved-to-a-web-worker",
    title: "Simulations moved to a web worker",
    date: "2025-06-04",
    tags: ["technical"],
    summary: "The first web worker in the app. A heavy simulation runs on a background thread.",
    body: [
      text(
        "A simulation runs on a background thread. The page stays responsive, and the progress bar moves, because the worker sends its progress back.",
      ),
      text(
        "On the main thread, tens of thousands of simulated games stopped the page. There was no scroll and no response to a button, and the browser reported an unresponsive tab. A spinner could not help, because the thread that must animate it did the work.",
      ),
      text(
        "The main benefit came the next day. With a free main thread, the iteration count went up, and work that was small to protect the page could become as expensive as necessary.",
      ),
      text(
        "This is now the pattern for all heavy work. The Elo simulation, the tournament win predictions and the prediction history all run in workers.",
      ),
    ],
  },
  {
    slug: "player-page-rebuilt",
    title: "Player page rebuilt with tabs",
    date: "2025-06-03",
    tags: ["feature-update"],
    summary: "Elo history, games, statistics and achievements are now tabs instead of one long page.",
    body: [
      text(
        "The player page has tabs, and the overview starts with the graphs. The Elo timeline has a range slider, so you can zoom to one month instead of the full history.",
      ),
      text("The page also uses less padding on a phone, because each pixel costs a row of data."),
      text("The new page was built next to the old one. The old page continued to work until the new one was ready."),
    ],
  },
  {
    slug: "game-scores",
    title: "Game scores",
    date: "2025-05-30",
    tags: ["new-feature"],
    summary: "A game records 11-9, 11-7, 9-11 instead of only the winner. You can correct a score later.",
    body: [
      text(
        "A game carries its scores. The set points are optional, so a game of one set records correctly. You can edit a score after you save the game.",
      ),
      text("Most of the work was the input: 4 or 6 numbers on a phone, next to the table."),
      text(
        "The scores made much later work possible. Examples are the opponent score graph, the close-call achievements, Marathon Set, the serve tracker, and predictions from points and sets. The first model was 2 players and a winner, which is all Elo needs.",
      ),
    ],
  },
  {
    slug: "k-factor-decay-reverted",
    title: "K-factor decay tried and reverted",
    date: "2025-04-10",
    tags: ["removed-feature", "technical"],
    summary: "A game moves your rating by the same amount, at any number of games played.",
    body: [
      text(
        "K controls how much one game moves your rating. K is a constant again. It is the same for a player with 20 games and a player with 500 games.",
      ),
      text(
        "K decayed for 2 months. After 200 games it fell from 32 towards a floor of 10. Chess federations use a low K for an established player, so that one bad result does not remove a year of work.",
      ),
      text(
        "An office league is not a chess federation. A decayed K makes the top of the table static, because the players with the most games are the most difficult to move. A new and better player must then play many games with almost no effect. The leaderboard became more stable and less correct.",
      ),
      text("The parameters stay in the function signature, and the function ignores them."),
    ],
  },
  {
    slug: "easter-theme",
    title: "New theme: Easter",
    date: "2025-03-30",
    tags: ["feature-update"],
    summary: "Spring colours and an Easter logo.",
    body: [
      text("This is the second seasonal theme. It has Easter colours and a themed logo."),
      text("The app switches it off when the season ends."),
    ],
  },
  {
    slug: "event-sourcing",
    title: "Event sourcing",
    date: "2025-03-29",
    tags: ["technical"],
    summary:
      "The database is an append-only log of events, and the browser projects them into state. This is the largest change in the project.",
    body: [
      text(
        "Everything is an event: player created, game created, tournament signup. The app appends an event and never updates it. The state is the result of a replay of the events, and the full history is always available.",
      ),
      text(
        "Almost all later work depends on this. A season replays a date window, an achievement evaluates the history, a prediction timeline walks it, and the event backup is the log.",
      ),
      text(
        "Before this there were tables of players and games. To delete a game removed a row. To rename a player rewrote a name and broke every game with the old name. You could not ask what the leaderboard was in November, because that state no longer existed.",
      ),
      text(
        "Player names were primary keys from the first commit, so every reference had to move to an id. The app translated the existing data in place. The server now stores opaque payloads, so validation moved to the client that creates them.",
      ),
    ],
  },
  {
    slug: "theme-system",
    title: "Theme support",
    date: "2025-03-19",
    tags: ["new-feature", "technical"],
    summary:
      "The app supports themes. Each organisation has its own, a seasonal theme follows the date, and you can select any theme as an override in settings.",
    body: [
      text(
        "A theme is a set of colours and a logo. Each organisation has its own theme. A seasonal theme becomes active on its dates. You can also select any theme as an override in settings. There are 4 organisation themes, and Halloween, Easter and Stealth.",
      ),
      text(
        "The colours come from CSS variables. Tailwind exposes them as primary, secondary and tertiary pairs of text and background. A component never knows the active theme, so a new theme is a list of colours.",
      ),
      text(
        "Opacity support makes this usable, so a modifier such as `/50` still works on a themed colour. Without it, every border and divider in the app needed a hardcoded value.",
      ),
      text(
        "The approach before this used a condition inside each component. That was possible for 3 themes, and not for a fourth.",
      ),
    ],
  },
  {
    slug: "one-app-several-organisations",
    title: "One app, several organisations",
    date: "2025-03-15",
    tags: ["technical"],
    summary: "A config layer gives each organisation its own theme, logo, tournaments and ranked threshold.",
    body: [
      text(
        "A client config gives each organisation a theme and logo, a page title and a favicon. It also gives each organisation its own tournaments and its own ranked threshold. There are 6 organisations, and one config for local development.",
      ),
      text("The ranked threshold changes the most, from 5 to 30 games. It depends on how much the office plays."),
      text("The app was built for one office before this change."),
    ],
  },
  {
    slug: "group-play",
    title: "Group play in tournaments",
    date: "2025-02-26",
    tags: ["feature-update"],
    summary: "A group stage before the bracket, so an early loss does not end your tournament.",
    body: [
      text(
        "Each player plays several games in a group, and the group results seed the bracket. A knockout alone gives half of the players exactly one game.",
      ),
      text(
        "The distribution is the difficult part. The groups must be almost equal in size for any number of signups. The strong players must be in different groups. The result must also stay correct when a player leaves an hour before the start.",
      ),
    ],
  },
  {
    slug: "future-elo-predictions",
    title: "Future Elo predictions",
    date: "2025-02-05",
    tags: ["new-feature"],
    summary: "Where your rating is likely to go, as a range with a confidence value that increases as you play.",
    body: [
      text(
        "The app simulates your recent results forward and shows where your rating is likely to end. It shows a band instead of one number, with the confidence next to it. The band becomes narrower as you play more games.",
      ),
      text(
        "Confidence is the interesting problem. A prediction from your last 3 games is weak, and a prediction from 200 games is strong. Recent games count more than old games, so the weight decays. The decay uses a half-life and an exponent instead of hardcoded weights.",
      ),
    ],
  },
  {
    slug: "simulations-page",
    title: "Simulations page",
    date: "2025-01-29",
    tags: ["new-feature"],
    summary: "A section of the app for the speculative tools, separate from the standings.",
    body: [
      text(
        "The Monte Carlo charts, the expected wins and the other what-if tools have their own section. The standings are a fact, and a simulation is an estimate, so the two read better in separate places.",
      ),
      text(
        "The page now also holds the expected leaderboard, individual points, win/loss, the player network and a pong game. A tool that is interesting but not authoritative goes there.",
      ),
    ],
  },
  {
    slug: "tournaments",
    title: "Tournaments",
    date: "2024-11-24",
    tags: ["new-feature"],
    summary: "Brackets with seeding and signup, skips for absent players, and a list view for a small screen.",
    body: [
      text(
        "A tournament has a signup flow and a bracket with seeding, so the top 2 players do not meet in round one. A skip handles a player who does not arrive, and you can reverse a skip. There is a list view and a tree view, because a bracket on a phone needs much horizontal scroll.",
      ),
      text(
        "A pending tournament game appears on the add-game page, so you do not have to remember the games you must play.",
      ),
    ],
  },
  {
    slug: "halloween-theme",
    title: "New theme: Halloween",
    date: "2024-10-29",
    tags: ["feature-update"],
    summary: "Pumpkin colours and a pumpkin logo for October. This is the first theme in the app.",
    body: [
      text(
        "The theme has orange and dark colours, and a pumpkin version of the logo in the nav menu. It returns every October.",
      ),
      text(
        "This was the first theme, and it came before theme support. It was built the direct way: a condition inside each component, and hardcoded colours. That works for exactly one theme, so the theming was rebuilt 5 months later.",
      ),
    ],
  },
  {
    slug: "farmer-score-removed",
    title: "Farmer score removed",
    date: "2024-10-28",
    tags: ["removed-feature"],
    summary: "The metric for how many easy opponents you play is gone, 4 days after it arrived.",
    body: [
      text("The farmer score column and its page are gone. The leaderboard does not grade the opponents you select."),
      text(
        "The metric measured a real effect. Elo has a known weakness in a small league: you find a lower-rated player, beat them many times, and collect the points. The problem was social. A public number that labels a colleague as a farmer changes a friendly leaderboard into an accusation.",
      ),
      text(
        "The same question survives in better forms: the player network, the player diversity chart, the Variety Player and Community Builder achievements, and the expected leaderboard. These encourage a player to play more opponents instead of a report on the opponents they played.",
      ),
    ],
  },
  {
    slug: "camera-profile-pictures",
    title: "Profile pictures from your camera",
    date: "2024-10-16",
    tags: ["new-feature"],
    summary: "Take a photo in the app and crop it, instead of an upload of a file.",
    body: [
      text("Point your camera at yourself and crop the photo."),
      text(
        "Profile pictures existed for months, and almost no player had one. Few players have a photo of themselves on a work laptop to upload.",
      ),
    ],
  },
  {
    slug: "leaderboard-calculation-in-the-browser",
    title: "Leaderboard calculation moved to the browser",
    date: "2024-10-14",
    tags: ["technical"],
    summary: "The server sends the raw data and the browser projects it. The whole app now depends on this decision.",
    body: [
      text(
        "One endpoint returns all of the data, and the client projects it into the leaderboards, the statistics and the other views. The backend no longer calculates the standings.",
      ),
      text(
        "This works because the data is small, the derived views are many, and the calculations are pure. The client can answer any question about the data with no request to the server. Seasons, achievements, the expected leaderboard and the player network needed no backend work.",
      ),
      text(
        "The cost is a wait at startup with a cold cache, and most of the later cache and web worker work pays for that cost. Before this change, the server replayed every game on every request and returned a ranked list. Each view that needed different data also needed a new endpoint.",
      ),
    ],
  },
  {
    slug: "live-updates-over-websockets",
    title: "Live updates over WebSockets",
    date: "2024-09-26",
    tags: ["new-feature", "technical"],
    summary: "A game you enter on one phone appears on every other screen immediately, with no refresh.",
    body: [
      text("The server broadcasts a new event to every connected client, so the leaderboard updates itself."),
      text(
        "The deployment runs the server in several instances, and each instance holds its own connections. A broadcast now travels between the instances first, so it reaches every client and not only the clients of the instance that took the write.",
      ),
      text(
        "The same channel now carries the cache invalidation when an admin edits an event. It also lets the live game page and the TV overlay work with no poll.",
      ),
      text(
        "A long-lived connection to a browser tab that can sleep needs heartbeats, retries and shutdown cleanup. This work took much longer than the connection itself.",
      ),
    ],
  },
  {
    slug: "accounts-and-profile-pictures",
    title: "Accounts and profile pictures",
    date: "2024-06-10",
    tags: ["new-feature"],
    summary: "Sign-up, sessions that expire, and permissions. The first profile pictures came with them.",
    body: [
      text(
        "You can sign up, and your role controls what you can do. A session logs you out when its token expires. The app checks a permission for each resource instead of one admin flag.",
      ),
      text("One check stops an admin who tries to remove their own access."),
    ],
  },
  {
    slug: "unranked-players",
    title: "Unranked players and the ranked threshold",
    date: "2024-05-23",
    tags: ["new-feature"],
    summary: "A new player is unranked, with a count of games played, until they have played enough games.",
    body: [
      text(
        "Play a few games and you appear on the leaderboard. Before that the app lists you separately as unranked, with a count of your games, so you can see the games you still need.",
      ),
      text(
        "A new rating is 1000, and your first game against a good player takes points from it. Before this change, a new player joined, lost, and appeared at the bottom of a public leaderboard with their name and face.",
      ),
      text("The threshold is per organisation. There is now also a Ranked achievement for the players who pass it."),
    ],
  },
  {
    slug: "the-first-version",
    title: "The first version",
    date: "2024-05-09",
    tags: ["technical"],
    summary: "Day one: a Deno server, a key-value store, players, games and 50 lines of Elo.",
    body: [
      text(
        "The server had routes for players and games. Elo arrived at the end of the same day: start every player at 1000, replay every game in order, then sort the result.",
      ),
      text(
        "Almost every decision in it has changed since. The calculation moved to the browser, the names became ids, the tables became an event log, and the key-value store became SQL.",
      ),
      text(
        "Three things did not change: `K = 32`, a start rating of 1000, and the shape of the Elo update. The update takes the expected score from the difference in rating, then applies a correction with the weight of K.",
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
