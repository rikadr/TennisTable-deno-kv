import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EventDbContext } from "../../wrappers/event-db-context";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { StatisticsPage } from "./statistics-page";

// jsdom has no ResizeObserver, which the recharts container asks for on mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

// Recharts measures its container, which jsdom always reports as zero, so the
// charts would render nothing. Handing the chart a fixed size instead makes it
// draw its marks, which is the point of a render test.
jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts");
  const react = jest.requireActual("react");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      react.cloneElement(children, { width: 800, height: 300 }),
  };
});

const PLAYERS = ["alice", "bob", "carol", "dave"];
const START = new Date(2024, 0, 1, 12, 0).getTime();
const HOUR_MS = 60 * 60 * 1000;

function buildEvents(): EventType[] {
  const events: EventType[] = PLAYERS.map((id, index) => ({
    time: index + 1,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id },
  }));

  // Enough games, spread over months and weekdays, for every section to pass
  // its minimum. Every fourth game records a full point by point log.
  for (let index = 0; index < 120; index++) {
    const playedAt = START + index * 7 * HOUR_MS;
    const winner = PLAYERS[index % PLAYERS.length];
    const loser = PLAYERS[(index + 1 + (index % 3)) % PLAYERS.length];
    if (winner === loser) continue;

    events.push({
      time: 1000 + index * 10,
      stream: `game-${index}`,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt, winner, loser },
    });

    if (index % 2 === 0) {
      events.push({
        time: 1001 + index * 10,
        stream: `game-${index}`,
        type: EventTypeEnum.GAME_SCORE,
        data:
          index % 4 === 0
            ? {
                setsWon: { gameWinner: 1, gameLoser: 0 },
                setPoints: [{ gameWinner: 11, gameLoser: 4 }],
                pointSequences: ["WWWWLWWWWLWWLWL"],
                tracking: {
                  version: 1,
                  source: index % 8 === 0 ? "live-game" : "track-game",
                  startedAt: playedAt,
                  pointDeltas: [new Array(15).fill(80)],
                  endedAfter: 20,
                  firstServers: "W",
                  corrections: 0,
                },
              }
            : { setsWon: { gameWinner: 2, gameLoser: 1 } },
      });
    }
  }
  return events;
}

function renderTab(tab: string) {
  const context = new TennisTable({ events: buildEvents(), gameLimitForRankedOverride: 3 });
  return render(
    <MemoryRouter initialEntries={[`/statistics?tab=${tab}`]}>
      <EventDbContext.Provider value={context}>
        <StatisticsPage />
      </EventDbContext.Provider>
    </MemoryRouter>,
  );
}

/**
 * Recharts draws its marks as SVG with no accessible role, so counting them
 * needs a plain DOM query. Everything else in these tests goes through the
 * Testing Library queries.
 */
function countMarks(container: HTMLElement, selector: string): number {
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  return container.querySelectorAll(selector).length;
}

describe("StatisticsPage", () => {
  it("opens on the activity tab and draws its charts", () => {
    const { container } = renderTab("");
    expect(screen.getByRole("heading", { name: "Statistics" })).toBeInTheDocument();
    expect(screen.getByText("Activity over time")).toBeInTheDocument();
    expect(screen.getByText("Day of the week")).toBeInTheDocument();
    expect(screen.getByText("Time of the day")).toBeInTheDocument();

    expect(countMarks(container, ".recharts-surface")).toBe(3);
    expect(countMarks(container, ".recharts-line")).toBeGreaterThan(0);
    expect(countMarks(container, ".recharts-bar-rectangle")).toBeGreaterThan(0);
    // The axis is labelled in percent, and shows no quantity.
    expect(screen.getAllByText(/^\d+%$/).length).toBeGreaterThan(0);
  });

  it("renders the games tab", () => {
    renderTab("games");
    expect(screen.getByText("How much detail we record")).toBeInTheDocument();
    expect(screen.getByText("Tracked games over time")).toBeInTheDocument();
    expect(screen.getByText("Pace and serve")).toBeInTheDocument();
  });

  it("renders the matchups tab", () => {
    const { container } = renderTab("matchups");
    expect(screen.getByText("Rating gap of the matchups")).toBeInTheDocument();
    expect(screen.getByText("How often the weaker player wins")).toBeInTheDocument();
    expect(countMarks(container, ".recharts-bar-rectangle")).toBeGreaterThan(0);
  });

  it("renders the league tab", () => {
    renderTab("league");
    expect(screen.getByText("Rating spread")).toBeInTheDocument();
    expect(screen.getByText("Ranked and unranked")).toBeInTheDocument();
  });

});
