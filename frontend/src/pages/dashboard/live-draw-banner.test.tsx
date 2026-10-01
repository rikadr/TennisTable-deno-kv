import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EventDbContext } from "../../wrappers/event-db-context";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { DRAW_TIMING, buildDrawTimeline, timelineDuration } from "../tournament/draw/draw-timeline";
import {
  LIVE_DRAW_COUNTDOWN_WINDOW,
  LIVE_DRAW_REPLAY_WINDOW,
  LiveDrawBanners,
  liveDrawPhase,
} from "./live-draw-banner";

const TOURNAMENT_ID = "t1";
const START = new Date(2026, 8, 22, 18, 0).getTime();
const ANCHOR = START + DRAW_TIMING.START_DELAY;
const PLAYERS = ["P1", "P2", "P3", "P4", "P5", "P6"];
const DRAW = ["P6", "P3", "P1", "P5", "P4", "P2"];
const SHOW_ENDS_AT = ANCHOR + timelineDuration(buildDrawTimeline([PLAYERS.slice(0, 3), PLAYERS.slice(3)]));

function buildEvents(options: { randomGroupSeeding?: boolean; seeded?: boolean } = {}): EventType[] {
  const { randomGroupSeeding = true, seeded = true } = options;
  const events: EventType[] = PLAYERS.map((id, index) => ({
    time: index + 1,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: `Name ${id}` },
  }));
  events.push({
    time: 100,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_CREATED,
    data: { name: "Draw cup", startDate: START, groupPlay: true, randomGroupSeeding },
  });
  PLAYERS.forEach((player, index) =>
    events.push({ time: 200 + index, stream: TOURNAMENT_ID, type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player } }),
  );
  if (seeded) {
    events.push({
      time: START - 1,
      stream: TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
      data: { playerOrder: PLAYERS, groupSeeding: randomGroupSeeding ? DRAW : undefined },
    });
  }
  return events;
}

function phaseAt(time: number, events = buildEvents()) {
  jest.useFakeTimers().setSystemTime(time);
  const tournament = new TennisTable({ events }).tournaments.getTournament(TOURNAMENT_ID);
  if (!tournament) throw new Error("No tournament");
  return liveDrawPhase(tournament, time);
}

afterEach(() => jest.useRealTimers());

describe("liveDrawPhase", () => {
  it("is hidden more than 5 days before the draw", () => {
    expect(phaseAt(START - LIVE_DRAW_COUNTDOWN_WINDOW - 1)).toBeUndefined();
  });

  it("counts down from 5 days before the draw", () => {
    expect(phaseAt(START - LIVE_DRAW_COUNTDOWN_WINDOW)).toBe("countdown");
    expect(phaseAt(START - 60_000)).toBe("countdown");
  });

  it("is live from the start to the end of the show", () => {
    expect(phaseAt(START + 1)).toBe("live");
    expect(phaseAt(SHOW_ENDS_AT - 1)).toBe("live");
  });

  it("offers the replay for one hour after the show", () => {
    expect(phaseAt(SHOW_ENDS_AT)).toBe("replay");
    expect(phaseAt(SHOW_ENDS_AT + LIVE_DRAW_REPLAY_WINDOW - 1)).toBe("replay");
    expect(phaseAt(SHOW_ENDS_AT + LIVE_DRAW_REPLAY_WINDOW)).toBeUndefined();
  });

  it("stays live while the draw has not arrived", () => {
    const events = buildEvents({ seeded: false });
    expect(phaseAt(SHOW_ENDS_AT, events)).toBe("live");
    expect(phaseAt(ANCHOR + LIVE_DRAW_REPLAY_WINDOW, events)).toBeUndefined();
  });

  it("is hidden for a tournament without a random draw", () => {
    expect(phaseAt(START - 60_000, buildEvents({ randomGroupSeeding: false }))).toBeUndefined();
  });
});

describe("LiveDrawBanners", () => {
  it("shows the countdown and links to the draw page", () => {
    jest.useFakeTimers().setSystemTime(START - 65_000);
    render(
      <MemoryRouter>
        <EventDbContext.Provider value={new TennisTable({ events: buildEvents() })}>
          <LiveDrawBanners />
        </EventDbContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/tournament/draw?tournament=${TOURNAMENT_ID}`);
  });
});
