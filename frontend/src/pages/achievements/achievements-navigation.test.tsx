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

const HOUR_MS = 60 * 60 * 1000;
const START = new Date(2024, 0, 1, 12, 0).getTime();

function buildEvents(): EventType[] {
  const players = ["alice", "bob", "carol"];
  const events: EventType[] = players.map((id, index) => ({
    time: index + 1,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id },
  }));

  for (let index = 0; index < 12; index++) {
    const playedAt = START + index * 5 * HOUR_MS;
    events.push({
      time: 1000 + index,
      stream: `game-${index}`,
      type: EventTypeEnum.GAME_CREATED,
      data: {
        playedAt,
        winner: players[index % players.length],
        loser: players[(index + 1) % players.length],
      },
    });
  }
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

  it("filters the list on the achievement whose name you click", async () => {
    renderPage("/achievements", <AchievementsPage />);

    // Every player earns First Game, so the unfiltered list holds more types.
    expect(screen.getAllByRole("link", { name: "First Game" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Ranked" }).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole("link", { name: "First Game" })[0]);

    expect(currentUrl()).toBe("/achievements?filter=first-game");
    expect(screen.getAllByRole("link", { name: "First Game" })).toHaveLength(3);
    expect(screen.queryByRole("link", { name: "Ranked" })).not.toBeInTheDocument();
  });

  it("keeps the filter in the history, so back returns to the unfiltered list", async () => {
    renderPage("/achievements", <AchievementsPage />);

    await userEvent.click(screen.getAllByRole("link", { name: "First Game" })[0]);
    expect(currentUrl()).toBe("/achievements?filter=first-game");

    await userEvent.click(screen.getByRole("button", { name: "history back" }));
    expect(currentUrl()).toBe("/achievements");
  });

  it("keeps a filter from the dropdown in the history too", async () => {
    renderPage("/achievements", <AchievementsPage />);

    await userEvent.selectOptions(screen.getByLabelText("Filter:"), "first-game");
    expect(currentUrl()).toBe("/achievements?filter=first-game");

    await userEvent.click(screen.getByRole("button", { name: "history back" }));
    expect(currentUrl()).toBe("/achievements");
  });

  it("keeps the view when the filter comes from a name in the list", async () => {
    renderPage("/achievements?view=progress&filter=first-game", <AchievementsPage />);

    // The progress view names the achievement it lists.
    expect(screen.getByText("👶 First Game")).toBeInTheDocument();
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

  it("opens on the progress tab and scrolls to the achievement", () => {
    renderPage(
      "/player/alice?tab=achievements&achievementTab=progress&achievement=first-game",
      <PlayerAchievements playerId="alice" />,
    );

    // The progress tab, and not the earned tab, holds the search field.
    expect(screen.getByLabelText("Search achievements by name or description")).toBeInTheDocument();

    const row = progressRow("first-game");
    expect(row).toBeInTheDocument();
    expect(row).toHaveClass("ring-2");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("opens on the earned tab when the link names no achievement", () => {
    renderPage("/player/alice?tab=achievements", <PlayerAchievements playerId="alice" />);

    expect(screen.queryByLabelText("Search achievements by name or description")).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
