import { render, screen } from "@testing-library/react";
import { EventType, EventTypeEnum } from "../client/client-db/event-store/event-types";
import { createModernWorker } from "./create-modern-worker";
import { useAchievementsSnapshot } from "./use-achievements-snapshot";

jest.mock("./create-modern-worker", () => ({ createModernWorker: jest.fn() }));

/** A worker that fails to load: it fires an error event and never sends a message */
class FailingWorker extends EventTarget {
  terminate = jest.fn();
  postMessage() {
    setTimeout(() => this.dispatchEvent(new Event("error")));
  }
}

const events: EventType[] = [
  { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
  { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
  { time: 3, stream: "g1", type: EventTypeEnum.GAME_CREATED, data: { playedAt: 3, winner: "a", loser: "b" } },
];

const Probe: React.FC = () => {
  const { snapshot, isCurrent } = useAchievementsSnapshot(events);
  return <p>{snapshot && isCurrent ? `achievements of ${snapshot.achievements.size} players` : "waiting"}</p>;
};

describe("useAchievementsSnapshot", () => {
  it("calculates on the main thread when the worker fails", async () => {
    const worker = new FailingWorker();
    jest.mocked(createModernWorker).mockReturnValue(worker as unknown as Worker);

    render(<Probe />);

    expect(await screen.findByText("achievements of 2 players")).toBeInTheDocument();
    expect(worker.terminate).toHaveBeenCalled();
  });
});
