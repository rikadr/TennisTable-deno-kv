import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { EventDbContext } from "../../wrappers/event-db-context";
import { ImageKitContext } from "../../wrappers/image-kit-context";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { AchievementsPage } from "./achievements-page";
import { PlayerAchievements } from "../player/player-achievements";

// jsdom implements no scrolling, so the progress row cannot scroll itself into
// view. The stub records the call the browser would act on.
const scrollIntoView = jest.fn();
Element.prototype.scrollIntoView = scrollIntoView;

// jsdom has no ResizeObserver, which the recharts container asks for on mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

// Recharts measures its container, which jsdom always reports as zero, so the
// charts would render nothing. Handing the chart a fixed size instead makes it
// draw its bars, which is the point of a render test.
jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts");
  const react = jest.requireActual("react");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      react.cloneElement(children, { width: 600, height: 200 }),
  };
});

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const START = new Date(2024, 0, 1, 12, 0).getTime();
const PLAYERS = ["alice", "bob", "carol"];

/**
 * Three days of play, 40 days apart, with 3, then 4, then 5 games. Alice plays
 * every game of a day, so each day beats the Hero of the Day record of the day
 * before it — a record that moves across three months.
 */
function buildEvents(): EventType[] {
  const events: EventType[] = PLAYERS.map((id, index) => ({
    time: index + 1,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id },
  }));

  let game = 0;
  [
    { dayOffset: 0, games: 3 },
    { dayOffset: 40, games: 4 },
    { dayOffset: 80, games: 5 },
  ].forEach(({ dayOffset, games }) => {
    for (let index = 0; index < games; index++) {
      const opponent = index % 2 === 0 ? "bob" : "carol";
      const aliceWins = game % 3 !== 2;
      events.push({
        time: 1000 + game,
        stream: `game-${game}`,
        type: EventTypeEnum.GAME_CREATED,
        data: {
          playedAt: START + dayOffset * DAY_MS + index * 2 * HOUR_MS,
          winner: aliceWins ? "alice" : opponent,
          loser: aliceWins ? opponent : "alice",
        },
      });
      game++;
    }
  });
  return events;
}

/**
 * Shows the current url, so a click's effect on the history is observable. The
 * button walks the router's history back, which window.history cannot do for a
 * MemoryRouter.
 */
const LocationProbe: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="location">{location.pathname + location.search}</div>
      <button onClick={() => navigate(-1)}>history back</button>
    </>
  );
};

function renderPage(url: string, element: React.ReactElement) {
  const context = new TennisTable({ events: buildEvents(), gameLimitForRankedOverride: 3 });
  return render(
    // The profile pictures need the ImageKit endpoint of the app.
    <MemoryRouter initialEntries={[url]}>
      <ImageKitContext>
        <EventDbContext.Provider value={context}>
          {element}
          <LocationProbe />
        </EventDbContext.Provider>
      </ImageKitContext>
    </MemoryRouter>,
  );
}

/** Recharts draws its bars as SVG with no accessible role. */
function countBars(container: HTMLElement): number {
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  return container.querySelectorAll(".recharts-bar-rectangle").length;
}

function currentUrl(): string {
  return screen.getByTestId("location").textContent ?? "";
}

/**
 * The row the link scrolls to is found by its dom id, which is what the scroll
 * itself uses. Testing Library has no query for an id.
 */
function progressRow(type: string): HTMLElement | null {
  // eslint-disable-next-line testing-library/no-node-access
  return document.getElementById(`achievement-progress-${type}`);
}

describe("navigation from the achievements page", () => {
  beforeEach(() => scrollIntoView.mockClear());

  it("opens the details of the achievement whose name you click", async () => {
    renderPage("/achievements", <AchievementsPage />);

    // Every player earns First Game, so the unfiltered list holds more types.
    expect(screen.getAllByRole("link", { name: "First Game" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Ranked" }).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole("link", { name: "First Game" })[0]);

    expect(currentUrl()).toBe("/achievements?filter=first-game&view=details");
    expect(screen.getByRole("heading", { name: "First Game" })).toBeInTheDocument();
    expect(screen.getByText("Times earned")).toBeInTheDocument();
  });

  it("filters the recent list on the achievement, and keeps the filter in the history", async () => {
    renderPage("/achievements", <AchievementsPage />);

    await userEvent.selectOptions(screen.getByLabelText("Filter:"), "first-game");
    expect(currentUrl()).toBe("/achievements?filter=first-game");
    expect(screen.getAllByRole("link", { name: "First Game" })).toHaveLength(3);
    expect(screen.queryByRole("link", { name: "Ranked" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "history back" }));
    expect(currentUrl()).toBe("/achievements");
  });

  it("switches between the three views, and keeps the achievement", async () => {
    renderPage("/achievements?filter=first-game", <AchievementsPage />);

    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(currentUrl()).toBe("/achievements?filter=first-game&view=details");
    expect(screen.getByText("Times earned")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Progress" }));
    expect(currentUrl()).toBe("/achievements?filter=first-game&view=progress");
    expect(screen.getByText("👶 First Game")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Recent" }));
    expect(currentUrl()).toBe("/achievements?filter=first-game");
  });

  it("shows who holds a one-time achievement, and how rare it is", () => {
    renderPage("/achievements?filter=first-game&view=details", <AchievementsPage />);

    // Every player earns First Game once, so all three of them hold it.
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
    expect(screen.getByText("One time only")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who holds it" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First and latest" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Closest to earning it" })).toBeInTheDocument();
    // Every player earns it in their own first game, so the time to earn it
    // says nothing and the section stays out.
    expect(screen.queryByRole("heading", { name: "Time to earn it" })).not.toBeInTheDocument();
  });

  it("shows the record over time, and the pace, for a league record", () => {
    const { container } = renderPage("/achievements?filter=hero-of-the-day&view=details", <AchievementsPage />);

    expect(screen.getByRole("heading", { name: "The record over time" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Games in the day" })).toBeInTheDocument();
    expect(screen.getByText("Can be earned again")).toBeInTheDocument();
    // The three days of play are 40 days apart, so the record spans months.
    expect(screen.getByRole("heading", { name: "Earned per month" })).toBeInTheDocument();
    expect(countBars(container)).toBeGreaterThan(0);
  });

  it("shows the league stats when the details view names no achievement", () => {
    const { container } = renderPage("/achievements?view=details", <AchievementsPage />);

    expect(screen.getByRole("heading", { name: "Achievements in the league" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rarest" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Never earned" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Most decorated players" })).toBeInTheDocument();
    expect(countBars(container)).toBeGreaterThan(0);
  });

  it("points a player in the progress list at their progress for that achievement", () => {
    renderPage("/achievements?view=progress&filter=first-game", <AchievementsPage />);

    expect(screen.getByRole("link", { name: "alice" })).toHaveAttribute(
      "href",
      "/player/alice?tab=achievements&achievementTab=progress&achievement=first-game",
    );
  });
});

describe("a player's achievements from a link", () => {
  beforeEach(() => scrollIntoView.mockClear());

  it("opens on the progress tab, searches the achievement and scrolls to it", () => {
    renderPage(
      "/player/alice?tab=achievements&achievementTab=progress&achievement=first-game",
      <PlayerAchievements playerId="alice" />,
    );

    // The progress tab, and not the earned tab, holds the search field.
    const search = screen.getByLabelText("Search achievements by name or description");
    expect(search).toHaveValue("first-game");
    // The search holds the list to the achievement the link names.
    expect(screen.getByText("First Game")).toBeInTheDocument();
    expect(screen.queryByText("Humiliation Streak")).not.toBeInTheDocument();

    const row = progressRow("first-game");
    expect(row).toBeInTheDocument();
    expect(row).toHaveClass("ring-4");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("opens the progress tab for a url that names an achievement and no tab", () => {
    renderPage("/player/alice?tab=achievements&achievement=streak-player-20", <PlayerAchievements playerId="alice" />);

    expect(screen.getByLabelText("Search achievements by name or description")).toHaveValue("streak-player-20");
    expect(screen.getByText("Humiliation Streak")).toBeInTheDocument();
    expect(progressRow("streak-player-20")).toHaveClass("ring-4");
  });

  it("matches the type of an achievement typed into the search", async () => {
    renderPage("/player/alice?tab=achievements&achievementTab=progress", <PlayerAchievements playerId="alice" />);

    // The type is the name the url and the links use, and it holds no words
    // of the title "Humiliation Streak".
    await userEvent.type(screen.getByLabelText("Search achievements by name or description"), "streak-player-20");

    expect(screen.getByText("Humiliation Streak")).toBeInTheDocument();
    expect(screen.queryByText("First Game")).not.toBeInTheDocument();
  });

  it("shows the whole list again when the search is cleared", async () => {
    renderPage(
      "/player/alice?tab=achievements&achievementTab=progress&achievement=first-game",
      <PlayerAchievements playerId="alice" />,
    );

    await userEvent.clear(screen.getByLabelText("Search achievements by name or description"));

    expect(screen.getByText("First Game")).toBeInTheDocument();
    expect(screen.getByText("Humiliation Streak")).toBeInTheDocument();
  });

  it("opens on the earned tab when the link names no achievement", () => {
    renderPage("/player/alice?tab=achievements", <PlayerAchievements playerId="alice" />);

    expect(screen.queryByLabelText("Search achievements by name or description")).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
