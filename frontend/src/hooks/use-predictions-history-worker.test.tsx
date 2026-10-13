import { render, screen } from "@testing-library/react";
import { EventType, EventTypeEnum } from "../client/client-db/event-store/event-types";
import { PredictionHistoryEntry } from "../client/client-db/predictions-history";
import { TennisTable } from "../client/client-db/tennis-table";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { EventDbContext } from "../wrappers/event-db-context";
import { createModernWorker } from "./create-modern-worker";
import { usePredictionsHistoryWorker } from "./use-predictions-history-worker";

jest.mock("./create-modern-worker", () => ({ createModernWorker: jest.fn() }));

/** A worker that answers each start message with 1 result */
class FakeWorker extends EventTarget {
  terminate = jest.fn();
  received: WorkerMessage[] = [];
  constructor(private entries: PredictionHistoryEntry[]) {
    super();
  }
  postMessage(message: WorkerMessage) {
    this.received.push(message);
    const result: WorkerMessage = { type: "predictions-history-result", data: { entries: this.entries } };
    setTimeout(() => this.dispatchEvent(new MessageEvent("message", { data: result })));
  }
}

const events: EventType[] = [
  { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
  { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
  { time: 3, stream: "g1", type: EventTypeEnum.GAME_CREATED, data: { playedAt: 3, winner: "a", loser: "b" } },
];

const entry = (time: number): PredictionHistoryEntry => ({
  time,
  overAllWinChance: 0.5,
  overAllConfidence: 0.1,
  oponents: {},
  gamesPlayed: 0,
});

const Probe: React.FC<{ playerId: string }> = ({ playerId }) => {
  const entries = usePredictionsHistoryWorker(playerId);
  return <p>{entries ? `${entries.length} entries` : "waiting"}</p>;
};

const renderProbe = () =>
  render(
    <EventDbContext.Provider value={new TennisTable({ events })}>
      <Probe playerId="a" />
    </EventDbContext.Provider>,
  );

describe("usePredictionsHistoryWorker", () => {
  it("shows the whole history from 1 message of the worker", async () => {
    const worker = new FakeWorker([entry(1), entry(2), entry(3)]);
    jest.mocked(createModernWorker).mockReturnValue(worker as unknown as Worker);

    renderProbe();

    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(await screen.findByText("3 entries")).toBeInTheDocument();
    expect(worker.received).toHaveLength(1);
    expect(worker.received[0]).toMatchObject({ type: "start-predictions-history", data: { playerId: "a" } });
    expect(worker.terminate).toHaveBeenCalled();
  });

  it("calculates on the main thread when there is no worker", () => {
    jest.mocked(createModernWorker).mockReturnValue(null);

    renderProbe();

    expect(screen.getByText(/^\d+ entries$/)).toBeInTheDocument();
    expect(screen.queryByText("0 entries")).not.toBeInTheDocument();
  });
});
