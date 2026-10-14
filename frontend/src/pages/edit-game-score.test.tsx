import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventDbContext } from "../wrappers/event-db-context";
import { ImageKitContext } from "../wrappers/image-kit-context";
import { ToastProvider } from "../wrappers/toast-provider";
import { TennisTable } from "../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../client/client-db/event-store/event-types";
import { EditGameSore } from "./edit-game-score";

jest.mock("react-confetti-explosion", () => ({
  __esModule: true,
  default: () => null,
}));

const events: EventType[] = [
  { time: 1, stream: "ada-id", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Ada" } },
  { time: 2, stream: "bo-id", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bo" } },
  {
    time: 3,
    stream: "game-1",
    type: EventTypeEnum.GAME_CREATED,
    data: { winner: "bo-id", loser: "ada-id", playedAt: 3 },
  },
  {
    time: 4,
    stream: "game-1",
    type: EventTypeEnum.GAME_SCORE,
    data: {
      setsWon: { gameWinner: 2, gameLoser: 1 },
      setPoints: [
        { gameWinner: 8, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 5 },
        { gameWinner: 11, gameLoser: 9 },
      ],
    },
  },
];

const fetchMock = jest.fn();

function renderPage() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/game/edit/score?gameId=game-1"]}>
      <QueryClientProvider client={client}>
        <ImageKitContext>
          <ToastProvider>
            <EventDbContext.Provider value={new TennisTable({ events })}>
              <EditGameSore />
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

const saveButton = () => screen.getByRole("button", { name: "✓ Edit score" });

describe("the edit score page", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: "OK", json: async () => ({}) });
    global.fetch = fetchMock;
  });

  it("shows the saved score, and saves a change to the bad sides", async () => {
    renderPage();

    expect(screen.getByRole("button", { name: "2–1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("tab", { name: /Set 1/ })).toHaveTextContent("8–11");
    expect(screen.getByRole("tab", { name: /Set 3/ })).toHaveTextContent("11–9");
    // Nothing changed yet.
    expect(saveButton()).toBeDisabled();

    await userEvent.click(screen.getByRole("tab", { name: /Set 1/ }));
    const badSide = screen.getByRole("group", { name: "Bad side in set 1" });
    await userEvent.click(within(badSide).getByRole("button", { name: "Bo" }));
    await userEvent.click(saveButton());

    await waitFor(() => expect(postedEvents()).toHaveLength(1));
    expect(postedEvents()[0]).toMatchObject({
      type: EventTypeEnum.GAME_SCORE,
      stream: "game-1",
      data: {
        setsWon: { gameWinner: 2, gameLoser: 1 },
        setPoints: [
          { gameWinner: 8, gameLoser: 11 },
          { gameWinner: 11, gameLoser: 5 },
          { gameWinner: 11, gameLoser: 9 },
        ],
        gameWinnerSides: ["B", "G", "B"],
      },
    });
  });

  it("needs the sets won", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });
});
