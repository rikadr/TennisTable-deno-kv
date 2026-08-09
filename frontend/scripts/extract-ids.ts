import { loadEvents, build } from "./season7";
import { findGame } from "./scenarios";

const tt = build(loadEvents());
for (const spec of [
  ["Fooa", "Christoffer", "2025-10-24"],
  ["Fooa", "Peder", "2025-10-24"],
  ["Alexander", "Fooa", "2025-10-23"],
  ["Rasmus", "Fooa", "2025-10-24"],
] as const) {
  const g = findGame(tt, spec[0], spec[1], spec[2]);
  console.log(`${spec[0]} vs ${spec[1]} ${spec[2]}: stream=${g.id} playedAt=${g.playedAt}`);
}
for (const tour of tt.tournaments.getTournaments()) {
  if (!tour.tournamentConfig.name.includes("Year-End Office Open 🏆")) continue;
  const signups = tt.eventStore.tournamentsProjector
    .getTournamentSignups(tour.tournamentConfig.id)
    .map((s) => tt.playerName(s.player));
  console.log(`\n${tour.tournamentConfig.name} signups: ${signups.join(", ")}`);
}
