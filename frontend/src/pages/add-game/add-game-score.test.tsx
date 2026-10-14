import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventDbContext } from "../../wrappers/event-db-context";
import { ImageKitContext } from "../../wrappers/image-kit-context";
import { ToastProvider } from "../../wrappers/toast-provider";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { AddGamePageV2 } from "./add-game-page";

jest.mock("react-confetti-explosion", () => ({
  __esModule: true,
  default: () => null,
}));

const events: EventType[] = [
  { time: 1, stream: "ada-id", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Ada" } },
  { time: 2, stream: "bo-id", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bo" } },
];

const fetchMock = jest.fn();

function renderPage() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/add-game-add?player1=ada-id&player2=bo-id"]}>
      <QueryClientProvider client={client}>
        <ImageKitContext>
          <ToastProvider>
            <EventDbContext.Provider value={new TennisTable({ events })}>
              <AddGamePageV2 />
            </EventDbContext.Provider>
          </ToastProvider>
        </ImageKitContext>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function postedEvents(): EventType[] {
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).endsWith("/event"))
    .map((call) => JSON.parse(call[1].body));
}

/** The players are in the URL, so the page opens on the winner step. Bo wins. */
async function goToScoreStep() {
  renderPage();
  await userEvent.click(screen.getByRole("button", { name: /Bo/ }));
  await userEvent.click(screen.getByRole("button", { name: "Next →" }));
}

const addGameButton = () => screen.getByRole("button", { name: "✓ Add Game" });
const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

describe("the score step of the add game page", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: "OK", json: async () => ({}) });
    global.fetch = fetchMock;
  });

  it("saves only the game when the players add no score", async () => {
    await goToScoreStep();
    expect(screen.getByText("Select the sets won to add the points and the bad side of each set.")).toBeVisible();

    await userEvent.click(addGameButton());

    await waitFor(() => expect(postedEvents()).toHaveLength(1));
    expect(postedEvents()[0]).toMatchObject({
      type: EventTypeEnum.GAME_CREATED,
      data: { winner: "bo-id", loser: "ada-id" },
    });
  });

  it("saves the sets won with 1 press", async () => {
    await goToScoreStep();
    await click("2–1");
    await userEvent.click(addGameButton());

    await waitFor(() => expect(postedEvents()).toHaveLength(2));
    expect(postedEvents()[1]).toMatchObject({
      type: EventTypeEnum.GAME_SCORE,
      data: { setsWon: { gameWinner: 2, gameLoser: 1 } },
    });
    expect(postedEvents()[1].data).not.toHaveProperty("setPoints");
    expect(postedEvents()[1].data).not.toHaveProperty("gameWinnerSides");
  });

  it("saves the points and the bad side of each set", async () => {
    await goToScoreStep();
    await click("2–1");

    // The first bad side fills every set, alternating.
    const badSide = screen.getByRole("group", { name: "Bad side in set 1" });
    await userEvent.click(within(badSide).getByRole("button", { name: "Ada" }));

    await click("Ada won set 1");
    await click("8");
    // Ada has 1 set, so Bo won set 2 without a press. The form moved on to set 2.
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Set 2");
    expect(screen.getByRole("button", { name: "Bo won set 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Add the points of sets 2 and 3, or clear the points of all sets.")).toBeVisible();
    expect(addGameButton()).toBeDisabled();

    await click("5");
    await click("10");
    await click("1 point more for Ada");
    expect(screen.getByRole("tab", { name: /Set 3/ })).toHaveTextContent("13–11");
    expect(addGameButton()).toBeEnabled();

    await userEvent.click(addGameButton());

    await waitFor(() => expect(postedEvents()).toHaveLength(2));
    expect(postedEvents()[1].data).toEqual({
      setsWon: { gameWinner: 2, gameLoser: 1 },
      setPoints: [
        { gameWinner: 8, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 5 },
        { gameWinner: 13, gameLoser: 11 },
      ],
      gameWinnerSides: ["G", "B", "G"],
    });
  });

  it("swaps the points when the players change the winner of a set", async () => {
    await goToScoreStep();
    await click("2–0");
    await click("7");
    expect(screen.getByRole("tab", { name: /Set 1/ })).toHaveTextContent("11–7");

    await userEvent.click(screen.getByRole("tab", { name: /Set 1/ }));
    await click("Ada won set 1");

    expect(screen.getByRole("tab", { name: /Set 1/ })).toHaveTextContent("7–11");
    expect(screen.getByText("Ada won 1 set below, but the result gives Ada 0 sets.")).toBeVisible();
    expect(addGameButton()).toBeDisabled();
  });

  it("blocks a result where the game winner has fewer sets", async () => {
    await goToScoreStep();
    await click("Other");
    await click("1 set more for Ada");

    expect(screen.getByText("Bo won the game, so Bo must win more sets than Ada.")).toBeVisible();
    expect(addGameButton()).toBeDisabled();

    await click("1 set more for Bo");
    await click("1 set more for Bo");
    expect(addGameButton()).toBeEnabled();
  });
});
