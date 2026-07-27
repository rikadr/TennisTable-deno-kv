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
 */
export const CHANGELOG_POSTS: ChangelogPost[] = [
  {
    slug: "earliest-and-latest-game-achievements",
    title: "2 new achievements: Earliest and Latest Game",
    date: "2026-07-27",
    tags: ["new-feature"],
    summary: "Records for the earliest and latest game ever played, which move when someone beats them.",
    body: [
      text(
        "League-wide rather than personal. Play at 06:12 and you take the Earliest Game record from whoever held it; the same goes for the last game of the evening.",
      ),
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
        "Single elimination gives half the field exactly one game. In a double elimination tournament everyone who loses drops into a losers bracket and keeps playing, and the winners-bracket champion meets the losers-bracket survivor in a grand final.",
      ),
      text(
        "It is a choice on the tournament form, so both formats are available. The bracket view, the pending games list and signup all handle the extra structure.",
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
      text("These reward the shape of a run rather than a single result."),
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
        "The live game pages and the TV overlay show a win percentage for each player, from the same model as the 1v1 comparison. It updates as the score changes.",
      ),
      text(
        "It is the first place predictions turn up without you going looking for them, which turns out to be a much better way to start an argument about whether the rating system is fair.",
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
        "Serve alternates every two points, and every point at deuce. This is trivially simple and universally forgotten mid-rally.",
      ),
      text(
        "The score is enough to derive it, so it now appears in the game tracker, the live game pages, the TV overlay and the live game card on the leaderboard.",
      ),
    ],
  },
  {
    slug: "predictions-rebuilt",
    title: "Predictions rebuilt and moved to a web worker",
    date: "2026-06-24",
    tags: ["technical"],
    summary: "Player pages no longer freeze while the prediction engine runs.",
    body: [
      text(
        "The old prediction module recomputed its full set of results synchronously every time a player page opened, and the UI simply stopped until it finished. It was replaced with a version that computes the expensive parts once and shares them between consumers.",
      ),
      text(
        "Prediction history also moved into a web worker, joining the tournament and Elo simulations that were already there. Graphs now fill in while you scroll instead of blocking the page.",
      ),
    ],
  },
  {
    slug: "deno-kv-to-sql",
    title: "Deno KV → SQL",
    date: "2026-06-20",
    tags: ["technical"],
    summary:
      "The event store moved off Deno KV to SQL, which also changed where the database is hosted and how the server is deployed.",
    body: [
      text(
        "Deno KV is a good place to start - no schema, no connection string - but the event store had outgrown it. Reading the full log meant paging through a key-value list, a single value was capped at 64 KiB, and there was no way to ask the store anything more specific than 'give me everything'.",
      ),
      text("Events now live in SQL behind a database interface with two implementations:"),
      list(
        "SQLite for local development, so the server runs with no external service at all.",
        "A hosted Postgres in production, which moved the database to a different provider.",
      ),
      text(
        "The schema is a single file. The old inline migrations that ran on server startup were a Deno KV coping mechanism and went away with it.",
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
      text("How do you rank careers that never overlapped? The score gained three factors:"),
      list(
        "All-time high Elo rather than your final rating - retiring after a bad run should not erase a good year.",
        "Podium time - how long you spent in the top three, measured over time rather than counted.",
        "Experience split into games won and games lost, so showing up a lot counts for something even when it did not go well.",
      ),
      text(
        "Peak Elo was also wrong for players who never crossed the ranked threshold: they had no leaderboard entries to read a peak from and were scoring zero instead of their actual best.",
      ),
      text(
        "The new leaderboard page ranks every player who has ever played, active and retired, together. It is not a real standing, and it is the most argued-about screen in the app.",
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
        "Self-contained, with no connection to the event store, the leaderboard or anything else. It does not affect your Elo. It is on its fourth version.",
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
        "Achievement cards also started carrying context, so a card can say who you beat and by how much instead of only when you earned it.",
      ),
    ],
  },
  {
    slug: "deactivated-players-no-longer-rewrite-history",
    title: "Deactivated players no longer rewrite everyone's history",
    date: "2026-05-14",
    tags: ["bug-fix"],
    summary:
      "Removing a player from the leaderboard also removed their games from every Elo calculation, retroactively changing the ratings of everyone they had played.",
    body: [
      text(
        "Elo is path-dependent - your rating is the result of replaying every game in order. The projection only counted games where both players were in the active list, so deactivating someone did not just hide them, it deleted their games from the replay.",
      ),
      text(
        "The symptom was a player page graph that changed shape retroactively: a rating you earned in March could move in May because an opponent left the office. Deactivated players are now kept in the calculation and only filtered out of the standings, so history stops moving.",
      ),
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
        "One page for whoever is running the score and one for everyone watching. Live game state lives on the server and is pushed to viewers over the existing WebSocket connection, so the public page does not poll.",
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
        "Until now, someone who left had two options: sit on the leaderboard forever slowly sinking, or be deactivated and disappear as though they had never played.",
      ),
      text(
        "The Hall of Fame is the third option - a separate page ranking retired players by a career score, with a page for each of them. It also made deactivating someone a reasonable thing to do, which it had not been before.",
      ),
    ],
  },
  {
    slug: "create-tournaments-in-the-app",
    title: "Admins can create tournaments without a deploy",
    date: "2026-02-22",
    tags: ["feature-update"],
    summary: "Tournaments are created and edited in the app. Until now every tournament was a code change.",
    body: [
      text(
        "The history is full of commits like 'start optio tournament', '2025 year end tournament' and 'remove vlad from tournament'. Every tournament, signup change and start-date adjustment meant editing code and deploying. That works right up until the person who wants the tournament is not the person who wrote the app.",
      ),
      text(
        "There is now a form: create a tournament, edit it, set the start date, adjust the players. The Finals and Group Play tabs also stay hidden until a tournament has actually started.",
      ),
    ],
  },
  {
    slug: "recent-games-page",
    title: "Recent games page",
    date: "2026-02-20",
    tags: ["new-feature"],
    summary: "Recent results moved from a box on the leaderboard to a page with scores and an overall/season toggle.",
    body: [
      text(
        "Recent games had been a widget showing the last handful of results. It is the most-looked-at thing in the app and it kept outgrowing its box.",
      ),
      text(
        "The page shows actual scores rather than just winner and loser, profile pictures, column headers, and a toggle between overall and season points - the same game is worth different amounts in each.",
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
        "The problem with an all-time rating is that the top of it is settled. If you joined last month you are not catching someone with 600 games no matter how well you play, and 'you cannot win' is a poor reason to keep playing.",
      ),
      text(
        "Seasons run on a schedule with their own leaderboard, podium, graph and per-player page, plus an achievement for winning one. If two players finish level on points, the one who played more games takes it - turnout beats protecting a rating.",
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
    summary: "The client stores the event log locally and only asks the server for what happened since its last event.",
    body: [
      text(
        "A client that projects the full event log has to download the full event log. That was fine at a few hundred events and less fine at tens of thousands.",
      ),
      text(
        "Events are now persisted locally. On startup the client reads its cache, finds the newest event it has, and asks the server only for what came after that. On a warm cache a page load fetches almost nothing. Settings has a button to clear it, because every cache eventually needs a manual escape hatch.",
      ),
    ],
  },
  {
    slug: "tournament-win-predictions",
    title: "Tournament win predictions",
    date: "2025-11-15",
    tags: ["new-feature"],
    summary: "Simulating a whole bracket thousands of times to show who is likely to take it.",
    body: [
      text(
        "Predicting one game is a single probability. Predicting a tournament means playing the bracket out thousands of times and counting who ends up with the trophy - accounting for the games already played, and the ones that were skipped.",
      ),
      text(
        "Skips had been a mutable flag on a tournament. To replay a bracket the simulation needs to know when a game was skipped, not just that it was, so skips became part of the event log. That also made undoing a skip possible.",
      ),
      text(
        "The simulation runs in a web worker, so the page stays responsive. The tournament page was split into tabs at the same time, since a bracket, a group table, a signup list and a prediction chart do not fit on one phone screen.",
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
        "This started as a small list of badges and was rewritten within two days into something closer to a rules engine: each achievement is evaluated against your projected history, and the ones you have not earned yet show how far along you are.",
      ),
      text(
        "The first batch included Nice Game, Close Calls, Edge Lord, Consistency Is Key, Variety Player, Best Friends, Welcome Committee, Community Builder and a set of tournament achievements.",
      ),
      text(
        "Deciding what counts as 'active' turned out to be the hard part, and rules that read like 'win 5 in a row without dropping a set' are very easy to get subtly wrong - there are now over 30 test files covering them.",
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
        "Adding a game afterwards means remembering the score, which people are bad at. The tracker records it as you play and hands the result straight to the add-game flow.",
      ),
      text("Because there are now two ways in, adding a game starts with a choice: a finished game, or a live one."),
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
        "The leaderboard tells you who is good. The network tells you that half the league has never played the other half, which is the thing that actually undermines a rating system.",
      ),
      text("It lives under the simulations page and shows active players."),
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
        "Win/loss records flatten everything. Beating someone 11-9 five times is a very different relationship from beating them 11-2 five times, and the leaderboard cannot tell you which one you have.",
      ),
      text(
        "The graph shows the spread of scores your opponents put up against you. Bars span only the real minimum and maximum, since a bar starting at zero implies you have conceded every score below it.",
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
        "The real leaderboard is partly a ranking of skill and partly a ranking of who you happened to play. Beat the same three people forty times and your rating says something quite narrow.",
      ),
      text(
        "The expected leaderboard simulates the games that never happened: every player against every other player, using the prediction model for each matchup. It is not the real leaderboard and is not meant to replace it - it is the answer to 'yes, but'.",
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
        "Every addition to the player page was reasonable on its own and the result was enormous. It was rebuilt as a parallel page and swapped in once it was ready, so the old one kept working while the two could be compared.",
      ),
      text(
        "The Elo timeline also got a range slider, so you can zoom into a month instead of squinting at two years of history. Mobile padding was reduced throughout - on a phone held next to the table, every wasted pixel costs a row of data.",
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
        "The original data model was two players and a winner. That is all Elo needs, and it threw away the thing everyone talks about afterwards.",
      ),
      text(
        "Most of the work went into the input: entering four or six numbers on a phone while standing next to a table, with optional set points that have to stay optional without letting nonsense through. Scores can also be edited after the fact, for when you typo.",
      ),
      text(
        "Scores made a lot of later work possible - the opponent score graph, close-call achievements, Marathon Set, the serve tracker, and predictions that can reason about points and sets rather than just wins.",
      ),
    ],
  },
  {
    slug: "k-factor-decay-reverted",
    title: "K-factor decay tried and reverted",
    date: "2025-04-10",
    tags: ["removed-feature", "technical"],
    summary: "Reducing how much a single game moves an experienced player's rating ran for two months and was removed.",
    body: [
      text(
        "In Elo, K controls how much one game moves your rating. Chess federations lower it for established players so that one bad Tuesday does not undo a year. Here, past 200 games, K decayed from 32 towards a floor of 10.",
      ),
      text(
        "An office league is not a chess federation. A decaying K freezes the top of the table: the players with the most games become the hardest to move, so a newcomer who is genuinely better has to grind through games that barely register. It made the leaderboard more stable and less true.",
      ),
      text("The parameters are still in the function signature, ignored, in case the idea ever comes back."),
    ],
  },
  {
    slug: "event-sourcing",
    title: "Event sourcing",
    date: "2025-03-29",
    tags: ["technical"],
    summary:
      "Tables of players and games became an append-only event log, projected into state in the browser. The biggest change the project has had.",
    body: [
      text(
        "Before: deleting a game deleted a row, and renaming a player rewrote a name and quietly broke every game that referenced the old one. There was no way to ask what the leaderboard looked like in November, because November was gone.",
      ),
      text(
        "Now the database stores events - player created, game created, tournament signup - appended and never updated. State is what you get when you replay them.",
      ),
      text(
        "The painful part was that player names had been primary keys since the first commit, and every reference had to move to an id while existing data was translated in place. With the server reduced to storing opaque payloads, validation moved to the client that creates them.",
      ),
      text(
        "Almost everything since depends on it: seasons replay a date window, achievements are evaluated against history, prediction timelines walk it, and the event backup is just the log.",
      ),
    ],
  },
  {
    slug: "theme-system",
    title: "Theme system",
    date: "2025-03-19",
    tags: ["technical"],
    summary: "Colours moved into CSS variables, so a theme is a list of values rather than conditionals in components.",
    body: [
      text(
        "There were three themes, each implemented by branching inside components, and adding a fourth was going to be worse than adding the third.",
      ),
      text(
        "Themes are now CSS variables exposed through Tailwind as primary, secondary and tertiary text and background colours. Components never learn which theme is active. The detail that made it work is opacity support, so modifiers like `/50` still work on a themed colour.",
      ),
      text("There are now per-organisation themes, Halloween, Easter, Christmas snowfall and a stealth mode."),
    ],
  },
  {
    slug: "one-app-several-organisations",
    title: "One app, several organisations",
    date: "2025-03-15",
    tags: ["technical"],
    summary: "A client config layer gives each organisation its own theme, logo, tournaments and ranked threshold.",
    body: [
      text(
        "The app was built for one office. Then a second one wanted it, and the difference between 'our tool' and 'a tool' turned out to be a config object.",
      ),
      text(
        "Each client gets a theme and logo, its own page title and favicon, its own tournaments, and its own threshold for how many games you must play to be ranked. There are six of them now, plus one for local development.",
      ),
      text(
        "The ranked threshold is the setting that moves most - it has been anywhere between 5 and 30 games depending on how much the office actually plays.",
      ),
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
        "A pure knockout gives half the field exactly one game. In group play everyone plays several games in a group, and the group results seed the bracket.",
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
    summary: "A simulation of where your rating is heading, shown as a range with a confidence that grows as you play.",
    body: [
      text(
        "Take your recent results, simulate forward, and show where your rating is likely to end up as a band rather than a single number.",
      ),
      text(
        "The interesting problem is confidence. A prediction built on your last three games should be held loosely; one built on two hundred should not. Recent games also matter more than old ones, so the weighting has to decay - and how fast it decays is a judgement call dressed up as a parameter.",
      ),
      text(
        "It has been retuned repeatedly since, and now runs off a half-life and an exponent that can be reasoned about rather than a set of hard-coded weights.",
      ),
    ],
  },
  {
    slug: "simulations-page",
    title: "Simulations page",
    date: "2025-01-29",
    tags: ["new-feature"],
    summary: "The speculative tools got their own section, away from the standings.",
    body: [
      text(
        "Monte Carlo charts and expected-wins calculations do not belong next to the leaderboard. The standings are a fact; a simulation is an argument.",
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
      text("A leaderboard measures the long run. A tournament produces an evening."),
      text(
        "Seeding keeps the top two from meeting in round one. Skips handle people who do not turn up, and are reversible. The bracket has a list view as well as a tree, because a bracket on a phone is mostly horizontal scrolling.",
      ),
      text(
        "Pending tournament games show up in the add-game page so you do not have to remember who you owe a match, and the game you just entered scrolls into view and wiggles.",
      ),
    ],
  },
  {
    slug: "farmer-score-removed",
    title: "Farmer score added and removed",
    date: "2024-10-28",
    tags: ["removed-feature"],
    summary: "A metric for how much you were farming easy opponents. It lasted four days.",
    body: [
      text(
        "Elo has a known exploit in a small league: find someone below you, beat them repeatedly, bank the points. So the app measured it, first as a column on the leaderboard and eventually as its own page.",
      ),
      text(
        "The metric worked. The problem was social - a public number labelling colleagues as farmers turns a friendly leaderboard into an accusation.",
      ),
      text(
        "The underlying question was real, and it came back in better forms: the player network, the player diversity chart, the Variety Player and Community Builder achievements, and the expected leaderboard. Same concern, reframed from 'you are farming' to 'play more people, it is more fun'. That framing stayed.",
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
      text(
        "Profile pictures had existed for months and almost nobody had one, because uploading a photo of yourself from a work laptop starts with finding a photo of yourself on a work laptop.",
      ),
      text("Faces appeared on the leaderboard within a day."),
    ],
  },
  {
    slug: "leaderboard-calculation-in-the-browser",
    title: "Leaderboard calculation moved to the browser",
    date: "2024-10-14",
    tags: ["technical"],
    summary:
      "The server stopped computing the leaderboard and started shipping raw data, with all projection happening client-side.",
    body: [
      text(
        "For the first five months the server loaded every player and game, replayed the Elo and returned a ranked list. Every page that wanted a slightly different cut of the data needed a new endpoint.",
      ),
      text(
        "That inverted: one endpoint returns everything, and the client projects it. The backend leaderboard module was deleted in the same change.",
      ),
      text(
        "It works because the data is small, the derived views are many and varied, and the calculations are pure - ship the data once and the client can answer any question about it without a round trip. Seasons, achievements, the expected leaderboard and the player network all needed no backend work at all.",
      ),
      text(
        "The cost is a real startup wait on a cold cache. Most of the caching and web-worker work since exists to pay for this decision.",
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
        "Several people stand around the same table. Someone enters a result and everyone else is looking at a stale leaderboard until they think to refresh.",
      ),
      text(
        "New events are now broadcast to every connected client. Keeping a long-lived connection honest to a browser tab that might be asleep, on a laptop that might be in a bag, took considerably longer than opening it in the first place - heartbeats, retries and shutdown cleanup.",
      ),
      text(
        "The same channel now carries cache invalidation when an admin edits an event, and it is what lets the live game page and the TV overlay work without polling.",
      ),
    ],
  },
  {
    slug: "accounts-and-profile-pictures",
    title: "Accounts and profile pictures",
    date: "2024-06-10",
    tags: ["new-feature"],
    summary: "Sign-up, sessions that expire, and permission checks instead of everyone being able to do everything.",
    body: [
      text(
        "Before this, anyone could do anything, including deleting players. Accounts brought sign-up, sessions with automatic logout when the token expires, and per-resource permission checks rather than one admin flag.",
      ),
      text(
        "Including the check that stops an admin from removing their own access, which is the kind of thing you add immediately after doing it once.",
      ),
    ],
  },
  {
    slug: "unranked-players",
    title: "Unranked players and the ranked threshold",
    date: "2024-05-23",
    tags: ["new-feature"],
    summary:
      "New players are listed as unranked with a games-played count, instead of appearing last on the leaderboard on day one.",
    body: [
      text(
        "A fresh rating is 1000, and your first game against a decent player takes points off it. So a new player's experience was: join, lose, appear at the bottom of a public leaderboard with your name and your face on it.",
      ),
      text(
        "Play a handful of games and you are on the leaderboard; before that you are listed separately with a count, so you can see how close you are. The threshold is per-organisation, and there is now a Ranked achievement for crossing it - same mechanic, better framing.",
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
        "The first commit was a server with routes for players and games. Later the same day, Elo: seed everyone at 1000, replay every game in order, sort the result. Recomputed on the server on every request, keyed by player name.",
      ),
      text(
        "Almost every decision visible there has since been reversed. The calculation moved to the browser, names became ids, the tables became an event log, and the key-value store became SQL.",
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
