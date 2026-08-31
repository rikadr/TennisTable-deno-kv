import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventDbContext } from "../../wrappers/event-db-context";
import { ImageKitContext } from "../../wrappers/image-kit-context";
import { ToastProvider } from "../../wrappers/toast-provider";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { AddPlayerPage } from "./add-player-page";

// The confetti of the created player measures the window and animates, which
// says nothing about the flow.
jest.mock("react-confetti-explosion", () => ({
  __esModule: true,
  default: () => null,
}));

const events: EventType[] = [
  { time: 1, stream: "alice-id", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
  { time: 2, stream: "bob-id", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
];

const fetchMock = jest.fn();

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

function renderFlow() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/add-player"]}>
      <QueryClientProvider client={client}>
        <ImageKitContext>
          <ToastProvider>
            <EventDbContext.Provider value={new TennisTable({ events })}>
              <AddPlayerPage />
              <LocationProbe />
            </EventDbContext.Provider>
          </ToastProvider>
        </ImageKitContext>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function currentUrl(): string {
  return screen.getByTestId("location").textContent ?? "";
}

/** The color of a player is the background of the preview of the color. */
function previewColor(): string | undefined {
  // eslint-disable-next-line testing-library/no-node-access
  return screen.getByText("The color of Cecilie").previousElementSibling?.getAttribute("style") ?? undefined;
}

/** Walks step 1 with a valid name, and stops on the color step. */
async function goToColorStep(name = "Cecilie") {
  renderFlow();
  await userEvent.type(screen.getByLabelText("Player name"), name);
  await userEvent.click(screen.getByRole("button", { name: "Next →" }));
}

function postedEvents(): EventType[] {
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).endsWith("/event"))
    .map((call) => JSON.parse(call[1].body));
}

describe("the new player flow", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: "OK", json: async () => ({}) });
    global.fetch = fetchMock;
  });

  it("keeps the name step until the name is valid", async () => {
    renderFlow();

    expect(screen.getByRole("heading", { name: "What is the name of the player?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Player name"), "cecilie");
    expect(screen.getByText("First letter must be uppercase")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("Player name"));
    await userEvent.type(screen.getByLabelText("Player name"), "Alice");
    expect(screen.getByText("Player name already exists")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("Player name"));
    await userEvent.type(screen.getByLabelText("Player name"), "Cecilie");
    expect(screen.getByRole("button", { name: "Next →" })).toBeEnabled();
  });

  it("tells you that the color is permanent, and creates no player before you confirm it", async () => {
    await goToColorStep();

    expect(screen.getByRole("heading", { name: "Select the color of Cecilie" })).toBeInTheDocument();
    expect(screen.getByText("⚠️ The color is permanent")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You select the color of a player 1 time. After you create the player, you cannot change the color.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "✓ Create Cecilie" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /I understand that the color of Cecilie is permanent/ }));
    expect(screen.getByRole("button", { name: "✓ Create Cecilie" })).toBeEnabled();
    expect(postedEvents()).toHaveLength(0);
  });

  it("uses the color you select", async () => {
    await goToColorStep();
    const before = previewColor();

    await userEvent.click(screen.getAllByRole("button", { name: "Select this color" })[0]);

    expect(previewColor()).not.toBe(before);
  });

  it("creates the player and asks for a photo instead of opening the player page", async () => {
    await goToColorStep();
    await userEvent.click(screen.getByRole("button", { name: /I understand that the color of Cecilie is permanent/ }));
    await userEvent.click(screen.getByRole("button", { name: "✓ Create Cecilie" }));

    expect(await screen.findByRole("heading", { name: /Cecilie is on the leaderboard/ })).toBeInTheDocument();

    const created = postedEvents();
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe(EventTypeEnum.PLAYER_CREATED);
    expect(created[0].data).toEqual({ name: "Cecilie" });

    expect(currentUrl()).toBe("/add-player");
    expect(screen.getByRole("button", { name: "📸 Take the photo now" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add the photo later" }));
    expect(currentUrl()).toBe(`/player/${created[0].stream}`);
  });
});
