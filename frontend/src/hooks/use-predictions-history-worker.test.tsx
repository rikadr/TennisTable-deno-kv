import { render, screen } from "@testing-library/react";
import { EventType, EventTypeEnum } from "../client/client-db/event-store/event-types";
import { PredictionHistoryEntry } from "../client/client-db/predictions-history";
import { TennisTable } from "../client/client-db/tennis-table";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { EventDbContext } from "../wrappers/event-db-context";
import { createModernWorker } from "./create-modern-worker";
import { usePredictionsHistoryWorker } from "./use-predictions-history-worker";

jest.mock("./create-modern-worker", () => ({ createModernWorker: jest.fn() }));

/** A worker that answers a start message with the times, then 2 batches of entries */
class FakeWorker extends EventTarget {
  terminate = jest.fn();
  received: WorkerMessage[] = [];
  postMessage(message: WorkerMessage) {
    this.received.push(message);
    const replies: WorkerMessage[] = [
      { type: "predictions-history-times", data: { times: [1, 2, 3] } },
      { type: "predictions-history-entries", data: { entries: [entry(3)], done: false } },
      { type: "predictions-history-entries", data: { entries: [entry(2), entry(1)], done: true } },
    ];
    replies.forEach((reply, i) =>
      setTimeout(() => this.dispatchEvent(new MessageEvent("message", { data: reply })), 20 * (i + 1)),
    );
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
  const history = usePredictionsHistoryWorker(playerId);
  if (!history) return <p>waiting</p>;
  return <p>{`${history.entryByTime.size} of ${history.times.length}${history.isDone ? " done" : ""}`}</p>;
};

const renderProbe = () =>
  render(
    <EventDbContext.Provider value={new TennisTable({ events })}>
      <Probe playerId="a" />
    </EventDbContext.Provider>,
  );

describe("usePredictionsHistoryWorker", () => {
  it("gives the times first, then the entries batch by batch", async () => {
    const worker = new FakeWorker();
    jest.mocked(createModernWorker).mockReturnValue(worker as unknown as Worker);

    renderProbe();

    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(await screen.findByText("0 of 3")).toBeInTheDocument();
    expect(await screen.findByText("1 of 3")).toBeInTheDocument();
    expect(await screen.findByText("3 of 3 done")).toBeInTheDocument();
    expect(worker.received).toHaveLength(1);
    expect(worker.received[0]).toMatchObject({ type: "start-predictions-history", data: { playerId: "a" } });
    expect(worker.terminate).toHaveBeenCalled();
  });

  it("calculates on the main thread when there is no worker", () => {
    jest.mocked(createModernWorker).mockReturnValue(null);

    renderProbe();

    const text = screen.getByText(/^\d+ of \d+ done$/).textContent ?? "";
    const [ready, total] = text.split(" of ").map((part) => parseInt(part, 10));
    expect(ready).toBeGreaterThan(0);
    expect(ready).toBe(total);
  });
});
