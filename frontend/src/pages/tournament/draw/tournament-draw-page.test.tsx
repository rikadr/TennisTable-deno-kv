import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { EventDbContext } from "../../../wrappers/event-db-context";
import { ImageKitContext } from "../../../wrappers/image-kit-context";
import { TennisTable } from "../../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../../client/client-db/event-store/event-types";
import { TournamentDrawPage, formatCountdown } from "./tournament-draw-page";
import { DRAW_TIMING } from "./draw-timeline";

// jsdom has no scrollIntoView, which the show calls when the group in focus changes
Element.prototype.scrollIntoView = jest.fn();

// The confetti animates with the DOM. A marker is enough to check when it is spawned
jest.mock("react-confetti-explosion", () => ({
  __esModule: true,
  default: (props: { particleCount: number }) => <div data-testid="confetti" data-particles={props.particleCount} />,
}));

const TOURNAMENT_ID = "t1";
const START = new Date(2026, 8, 22, 18, 0).getTime();
const ANCHOR = START + DRAW_TIMING.START_DELAY;
const PLAYERS = ["P1", "P2", "P3", "P4", "P5", "P6"];
// Groups of 3: the draw puts P6 in the first slot of the first group
const DRAW = ["P6", "P3", "P1", "P5", "P4", "P2"];

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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
};

function renderPage(events: EventType[]) {
  return render(
    <MemoryRouter initialEntries={[`/tournament/draw?tournament=${TOURNAMENT_ID}`]}>
      <ImageKitContext>
        <EventDbContext.Provider value={new TennisTable({ events })}>
          <Routes>
            <Route path="/tournament/draw" element={<TournamentDrawPage />} />
            <Route path="/tournament" element={<div>Tournament page</div>} />
          </Routes>
          <LocationProbe />
        </EventDbContext.Provider>
      </ImageKitContext>
    </MemoryRouter>,
  );
}

function setNow(time: number) {
  jest.useFakeTimers().setSystemTime(time);
}

/** Advance the fake clock the way a real clock ticks: one render per tick, not one jump */
function advance(ms: number, tick = 200) {
  for (let passed = 0; passed < ms; passed += tick) {
    act(() => {
      jest.advanceTimersByTime(Math.min(tick, ms - passed));
    });
  }
}

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
});

/** An unsigned token. The client reads the role from the payload and does not verify the signature */
function loginAs(role: string) {
  const payload = { exp: Math.floor(Date.now() / 1000) + 3600, role, username: "tester" };
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  localStorage.setItem("jwt-token", `${encode({ alg: "none" })}.${encode(payload)}.sig`);
}

describe("TournamentDrawPage", () => {
  it("shows a countdown and the signed up players before the start", () => {
    setNow(START - 90_000);
    renderPage(buildEvents({ seeded: false }));

    expect(screen.getByText("The draw starts in")).toBeInTheDocument();
    expect(screen.getByText("1:30")).toBeInTheDocument();
    expect(screen.getByText("Name P1")).toBeInTheDocument();
    expect(screen.getByText("Name P6")).toBeInTheDocument();
  });

  it("waits between the start and the first reveal", () => {
    setNow(START + 2_000);
    renderPage(buildEvents());
    expect(screen.getByText(/Drawing/)).toBeInTheDocument();
  });

  it("waits when the seeding event has not arrived", () => {
    setNow(ANCHOR + 5_000);
    renderPage(buildEvents({ seeded: false }));
    expect(screen.getByText(/Drawing/)).toBeInTheDocument();
  });

  it("plays live: a page open before the anchor follows the clock, and the first draw is revealed", () => {
    setNow(START + 2_000);
    renderPage(buildEvents());
    expect(screen.getByText(/Drawing/)).toBeInTheDocument();

    advance(DRAW_TIMING.START_DELAY - 2_000 + DRAW_TIMING.PLAYER + 100);

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument();
    expect(screen.getByText("Name P6")).toBeInTheDocument(); // First in the draw for group 1
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.getByText("Group 2")).toBeInTheDocument();
    // The second slot waits for its cycle now, so no confetti this moment
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
  });

  it("spawns a few confetti at the moment of a draw, and a burst when a group is complete", () => {
    setNow(START + 2_000);
    renderPage(buildEvents());
    advance(DRAW_TIMING.START_DELAY - 2_000 + DRAW_TIMING.FOCUS + DRAW_TIMING.CYCLE + 100); // First player settled
    expect(screen.getByTestId("confetti")).toHaveAttribute("data-particles", "14");

    advance(DRAW_TIMING.PLAYER - DRAW_TIMING.CYCLE); // Second player cycles
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();

    advance(2 * DRAW_TIMING.PLAYER); // Group 1 complete, its sort runs
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();

    advance(DRAW_TIMING.SORT); // The sort is done
    expect(screen.getByTestId("confetti")).toHaveAttribute("data-particles", "80");
  });

  it("shows a complete group in the default order, best player first, during its pause", () => {
    setNow(START + 2_000);
    renderPage(buildEvents());
    advance(DRAW_TIMING.START_DELAY - 2_000 + 3 * DRAW_TIMING.PLAYER - 500); // Last player of group 1 is drawn

    // Group 1 is P6, P1 and P2 in the order of the draw. A row is positioned by its top, not by its DOM order
    const rowTop = (name: string) => screen.getByText(name).closest("div[style]")?.getAttribute("style");
    expect(rowTop("Name P6")).toContain("top: 0px");
    expect(rowTop("Name P1")).toContain("top: 64px");
    expect(rowTop("Name P2")).toContain("top: 128px");
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    advance(500); // The pause of group 1 starts with the sort
    expect(rowTop("Name P1")).toContain("top: 0px");
    expect(rowTop("Name P2")).toContain("top: 64px");
    expect(rowTop("Name P6")).toContain("top: 128px");
    expect(screen.getByText("1").closest("div[style]")).toBe(screen.getByText("Name P1").closest("div[style]"));
    expect(screen.getByText("3").closest("div[style]")).toBe(screen.getByText("Name P6").closest("div[style]"));
    // The DOM order is still the draw order, so no row was moved in the DOM
    const domOrder = screen.getAllByText(/^Name P[126]$/).map((node) => node.textContent);
    expect(domOrder).toEqual(["Name P6", "Name P1", "Name P2"]);
  });

  it("plays from the start with a Next button when the viewer joins late", () => {
    setNow(ANCHOR + 60_000);
    renderPage(buildEvents());

    expect(screen.getByRole("button", { name: /Next/ })).toBeInTheDocument();
    expect(screen.getByText(/behind live/)).toBeInTheDocument();
    expect(screen.getAllByText("0 / 3")).toHaveLength(2); // Both groups are still empty
  });

  it("plays from the start after the show has ended", () => {
    setNow(ANCHOR + 10 * 60_000);
    renderPage(buildEvents());
    expect(screen.getByRole("button", { name: /Next/ })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/tournament/draw");
  });

  it("navigates to the tournament page when the tournament has no random group seeding", () => {
    setNow(START - 1_000);
    renderPage(buildEvents({ randomGroupSeeding: false }));
    expect(screen.getByTestId("location")).toHaveTextContent(`/tournament?tournament=${TOURNAMENT_ID}`);
  });
});

describe("TournamentDrawPage preview", () => {
  it("hides the preview from players", () => {
    setNow(START - 90_000);
    renderPage(buildEvents({ seeded: false }));
    expect(screen.queryByRole("button", { name: /Preview the show/ })).not.toBeInTheDocument();
  });

  it("lets an admin run the show with a fresh random order, and returns to the countdown at the end", () => {
    setNow(START - 90_000);
    loginAs("admin");
    renderPage(buildEvents({ seeded: false }));

    fireEvent.click(screen.getByRole("button", { name: /Preview the show/ }));
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument();
    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.getByText("Group 2")).toBeInTheDocument();

    advance(DRAW_TIMING.PLAYER + 100);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exit preview" }));
    expect(screen.getByText("The draw starts in")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/tournament/draw");
  });

  it("returns to the countdown when the preview show ends", () => {
    setNow(START - 900_000);
    loginAs("admin");
    renderPage(buildEvents({ seeded: false }));
    fireEvent.click(screen.getByRole("button", { name: /Preview the show/ }));

    // 6 players in 2 groups: 6 reveals, 2 pauses and the end
    advance(6 * DRAW_TIMING.PLAYER + 2 * DRAW_TIMING.GROUP_PAUSE + DRAW_TIMING.END + 500, 1_000);
    expect(screen.getByText("The draw starts in")).toBeInTheDocument();
  });
});

describe("formatCountdown", () => {
  it("formats the remaining time with the units that are needed", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(65_000)).toBe("1:05");
    expect(formatCountdown(3_600_000 + 60_000 + 5_000)).toBe("1:01:05");
    expect(formatCountdown(2 * 86_400_000 + 3_600_000)).toBe("2d 01h 00m 00s");
  });
});
