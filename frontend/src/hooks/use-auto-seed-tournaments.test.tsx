import { Component, ReactNode, useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../common/query-client";
import { EventType, EventTypeEnum } from "../client/client-db/event-store/event-types";
import { TennisTable } from "../client/client-db/tennis-table";
import { ToastProvider } from "../wrappers/toast-provider";
import { useAutoSeedTournaments } from "./use-auto-seed-tournaments";
import { useEventMutation } from "./use-event-mutation";

const TOURNAMENT_ID = "tournament-1";
const PLAYERS = ["alice", "bob", "carol", "dave"];

/** A random draw tournament that has started and has no seeding yet */
function startedTournamentEvents(): EventType[] {
  const events: EventType[] = [];
  let time = 1_000;
  for (const player of PLAYERS) {
    events.push({ time: time++, stream: player, type: EventTypeEnum.PLAYER_CREATED, data: { name: player } });
  }
  events.push({
    time: time++,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_CREATED,
    data: { name: "Draw test", startDate: 10_000, groupPlay: true, randomGroupSeeding: true },
  });
  for (const player of PLAYERS) {
    events.push({ time: time++, stream: TOURNAMENT_ID, type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player } });
  }
  return events;
}

class CatchError extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <p>crashed</p> : this.props.children;
  }
}

function renderWithProductionClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <CatchError>{children}</CatchError>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const SeedingApp: React.FC<{ tennisTable: TennisTable }> = ({ tennisTable }) => {
  useAutoSeedTournaments(tennisTable);
  return <p>app is alive</p>;
};

const PlainPoster: React.FC = () => {
  const mutation = useEventMutation();
  useEffect(() => {
    mutation.mutate({
      time: 1,
      stream: TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
      data: { playerOrder: PLAYERS },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p>app is alive</p>;
};

describe("useAutoSeedTournaments", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    // The server rejects the post because another browser stored the seeding first
    fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });
    global.fetch = fetchMock;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("keeps the app alive and shows no error when another browser posted the seeding first", async () => {
    renderWithProductionClient(<SeedingApp tennisTable={new TennisTable({ events: startedTournamentEvents() })} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const posted = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(posted.type).toBe(EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER);
    expect(posted.time).toBe(10_000 - 1);

    // Give the failed mutation time to settle before the checks
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("app is alive")).toBeTruthy();
    expect(screen.queryByText("crashed")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the default for other posts: a failure is still thrown", async () => {
    renderWithProductionClient(<PlainPoster />);

    expect(await screen.findByText("crashed")).toBeTruthy();
  });
});
