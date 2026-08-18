import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EventDbContext } from "../../../wrappers/event-db-context";
import { TennisTable } from "../../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../../client/client-db/event-store/event-types";
import { WhrResult } from "../../../client/client-db/whr";
import { SkillRatingPage } from "./skill-rating-page";

// The worker hook cannot be imported under Jest, because the worker entry uses
// `import.meta`. The fit itself is the real one, see whr.test.ts.
let mockWorkerState: { result: WhrResult | null; progress: number } = { result: null, progress: 0 };
jest.mock("../../../hooks/use-whr-worker", () => ({
  useWhrWorker: () => mockWorkerState,
}));

const DAY_MS = 24 * 60 * 60 * 1000;

let sequence = 0;

function player(id: string): EventType {
  return { time: ++sequence, stream: id, type: EventTypeEnum.PLAYER_CREATED, data: { name: id } };
}

function game(winner: string, loser: string, day: number): EventType {
  const playedAt = day * DAY_MS + ++sequence;
  return {
    time: playedAt,
    stream: `game-${playedAt}`,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt, winner, loser },
  };
}

function renderPage(events: EventType[]) {
  const context = new TennisTable({ events });
  mockWorkerState = { result: context.whr.compute(), progress: 1 };

  return render(
    <MemoryRouter>
      <EventDbContext.Provider value={context}>
        <SkillRatingPage />
      </EventDbContext.Provider>
    </MemoryRouter>,
  );
}

function selectedNames(): (string | null)[] {
  return Array.from(document.querySelectorAll('tr[data-selected="true"]')).map(
    (row) => (row as HTMLTableRowElement).cells[1].textContent,
  );
}

function playerColumn(): (string | null)[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => (row as HTMLTableRowElement).cells[1].textContent);
}

describe("SkillRatingPage", () => {
  beforeEach(() => {
    sequence = 0;
    mockWorkerState = { result: null, progress: 0 };
  });

  it("lists the rated players, strongest first", () => {
    const events: EventType[] = [player("Ada"), player("Bo"), player("Cy")];
    for (let day = 0; day < 6; day++) {
      events.push(game("Ada", "Bo", day), game("Ada", "Cy", day), game("Bo", "Cy", day));
    }

    renderPage(events);

    expect(screen.getByText("Skill rating over time")).toBeInTheDocument();
    expect(playerColumn()).toEqual(["Ada", "Bo", "Cy"]);
  });

  it("tells the user when there is nothing to rate", () => {
    renderPage([player("Ada"), player("Bo")]);

    expect(screen.getByText("No games to rate yet.")).toBeInTheDocument();
  });

  it("hides a retired player from the list until it is asked for", () => {
    const events: EventType[] = [player("Ada"), player("Bo"), player("Cy")];
    for (let day = 0; day < 6; day++) {
      events.push(game("Ada", "Bo", day), game("Bo", "Cy", day));
    }
    events.push({ time: ++sequence, stream: "Bo", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null });

    renderPage(events);

    expect(playerColumn()).toEqual(["Ada", "Cy"]);
    // The retired player is still rated, so the fit does not change when they leave
    expect(mockWorkerState.result?.curves.map((curve) => curve.playerId).sort()).toEqual(["Ada", "Bo", "Cy"]);

    fireEvent.click(screen.getByLabelText("Include retired players"));
    // The retired row carries a "retired" badge next to the name
    expect(playerColumn()).toHaveLength(3);
    expect(playerColumn().some((name) => name?.startsWith("Bo"))).toBe(true);
  });

  it("hides an unranked player from the list until it is asked for", () => {
    // 'Cy' plays 2 games, below the 5 a ranked place needs
    const events: EventType[] = [player("Ada"), player("Bo"), player("Cy")];
    for (let day = 0; day < 6; day++) {
      events.push(game("Ada", "Bo", day));
    }
    events.push(game("Ada", "Cy", 7), game("Bo", "Cy", 7));

    renderPage(events);

    expect(playerColumn()).not.toContain("Cy");

    fireEvent.click(screen.getByLabelText("Include unranked players"));
    expect(playerColumn()).toContain("Cy");
  });

  it("adds every player in the filter, and clears the selection", () => {
    const events: EventType[] = [player("Ada"), player("Bo"), player("Cy")];
    for (let day = 0; day < 6; day++) {
      events.push(game("Ada", "Bo", day), game("Bo", "Cy", day), game("Ada", "Cy", day));
    }

    renderPage(events);

    fireEvent.click(screen.getByText("Clear all"));
    expect(selectedNames()).toEqual([]);

    fireEvent.click(screen.getByText("Add all"));
    expect(selectedNames().sort()).toEqual(["Ada", "Bo", "Cy"]);

    // No upper limit, so the whole filter can go on the chart
    fireEvent.click(screen.getByLabelText("Include unranked players"));
    fireEvent.click(screen.getByText("Add all"));
    expect(selectedNames().length).toBe(playerColumn().length);
  });

  it("says how many games carry a score", () => {
    const events: EventType[] = [player("Ada"), player("Bo")];
    for (let day = 0; day < 3; day++) {
      events.push(game("Ada", "Bo", day));
    }
    const scoredAt = 9 * DAY_MS + ++sequence;
    events.push(
      { time: scoredAt, stream: "scored", type: EventTypeEnum.GAME_CREATED, data: { playedAt: scoredAt, winner: "Ada", loser: "Bo" } },
      {
        time: scoredAt + 1,
        stream: "scored",
        type: EventTypeEnum.GAME_SCORE,
        data: { setsWon: { gameWinner: 2, gameLoser: 0 }, setPoints: [{ gameWinner: 11, gameLoser: 5 }, { gameWinner: 11, gameLoser: 7 }] },
      },
    );

    renderPage(events);

    expect(screen.getByText(/A set score is recorded on/)).toHaveTextContent(
      "A set score is recorded on 1 of 4 games, and the points of each set on 1.",
    );
  });

  it("shows the progress bar while the fit runs", () => {
    render(
      <MemoryRouter>
        <EventDbContext.Provider value={new TennisTable({ events: [] })}>
          <SkillRatingPage />
        </EventDbContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Fitting every game in the history…")).toBeInTheDocument();
  });
});
