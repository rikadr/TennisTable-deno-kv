import { useEffect, useRef } from "react";
import { EventTypeEnum, TournamentSetPlayerOrder } from "../client/client-db/event-store/event-types";
import { TennisTable } from "../client/client-db/tennis-table";
import { useEventMutation } from "./use-event-mutation";

export function useAutoSeedTournaments(tennisTable: TennisTable) {
  const attemptedRef = useRef(new Set<string>());
  const addEventMutation = useEventMutation();

  useEffect(() => {
    const seedTournament = (config: { id: string; startDate: number }) => {
      if (attemptedRef.current.has(config.id)) return;
      attemptedRef.current.add(config.id);

      const playerOrder = tennisTable.tournaments.buildPlayerOrder(config.id);

      const event: TournamentSetPlayerOrder = {
        time: config.startDate - 1,
        stream: config.id,
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        data: { playerOrder },
      };

      addEventMutation.mutate(event);
    };

    // Seed tournaments that already need it
    const tournamentsNeedingOrder = tennisTable.tournaments.getTournamentsNeedingPlayerOrder();
    for (const config of tournamentsNeedingOrder) {
      seedTournament(config);
    }

    // Schedule seeding for future tournaments 1 second after their start time
    const now = Date.now();
    const futureTournaments = tennisTable.eventStore.tournamentsProjector
      .getTournamentConfigs()
      .filter(
        (config) =>
          config.playerOrder === undefined &&
          config.startDate > now
      );

    const timeouts = futureTournaments.map((config) => {
      const randomOffset = 1000 + Math.random() * 4000; // 1-5 seconds after start
      return setTimeout(() => seedTournament(config), config.startDate + randomOffset - now);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tennisTable]);
}
