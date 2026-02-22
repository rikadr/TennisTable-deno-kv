import { useState } from "react";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { newId } from "../../common/nani-id";
import { useEventMutation } from "../../hooks/use-event-mutation";

type CreateEventFormProps = {
  onClose: () => void;
};

export const CreateEventForm = ({ onClose }: CreateEventFormProps) => {
  const createEvent = useEventMutation();
  const [form, setForm] = useState({
    time: Date.now(),
    type: "",
    stream: "",
    data: "{}",
  });
  const [error, setError] = useState<string>();

  return (
    <div className="mb-4 border rounded p-4 bg-primary-background">
      <h2 className="text-lg font-semibold mb-3">New Event</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-sm font-medium mb-1">Time</label>
          <div className="flex gap-1">
            <input
              type="number"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: Number(e.target.value) }))}
              className="flex-1 border rounded px-3 py-2 bg-primary-background"
            />
            <input
              type="datetime-local"
              onChange={(e) => {
                const ms = new Date(e.target.value).getTime();
                if (!isNaN(ms)) setForm((f) => ({ ...f, time: ms }));
              }}
              className="border rounded px-2 py-2 bg-primary-background text-sm w-[2.5rem] cursor-pointer"
              title="Pick a date/time to fill the timestamp"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => {
              const type = e.target.value;
              const template = eventDataTemplate(type);
              const data = JSON.stringify(template, null, 2)?.replace(/"TODO"/g, "TODO") ?? "null";
              setForm((f) => ({ ...f, type, data }));
            }}
            className="w-full border rounded px-3 py-2 bg-primary-background"
          >
            <option value="">-- Select type --</option>
            {Object.values(EventTypeEnum).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Stream</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={form.stream}
              onChange={(e) => setForm((f) => ({ ...f, stream: e.target.value }))}
              placeholder="Stream ID"
              className="flex-1 border rounded px-3 py-2 bg-primary-background"
            />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, stream: newId() }))}
              className="border rounded px-2 py-2 hover:bg-primary-text/20 text-sm"
              title="Generate random ID"
            >
              ID
            </button>
          </div>
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Data (JSON)</label>
        <textarea
          value={form.data}
          onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
          className="w-full border rounded px-3 py-2 font-mono text-sm bg-primary-background"
          rows={5}
        />
      </div>
      {error && (
        <div className="mb-3 bg-red-500/20 text-red-300 border border-red-500/50 rounded px-4 py-2 text-sm">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setError(undefined);
            let parsed;
            try {
              parsed = JSON.parse(form.data);
            } catch {
              setError("Invalid JSON in data field");
              return;
            }
            createEvent.mutate(
              {
                time: form.time,
                type: form.type as EventType["type"],
                stream: form.stream,
                data: parsed,
              },
              {
                onSuccess: () => onClose(),
                onError: (err) => setError(err.message || "Failed to create event"),
              },
            );
          }}
          disabled={createEvent.isPending}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {createEvent.isPending ? "Submitting..." : "Submit"}
        </button>
        <button
          onClick={onClose}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

function eventDataTemplate(type: string): unknown {
  switch (type) {
    case EventTypeEnum.PLAYER_CREATED: return { name: "TODO" };
    case EventTypeEnum.PLAYER_DEACTIVATED: return null;
    case EventTypeEnum.PLAYER_REACTIVATED: return null;
    case EventTypeEnum.PLAYER_NAME_UPDATED: return { updatedName: "TODO" };
    case EventTypeEnum.GAME_CREATED: return { playedAt: "TODO", winner: "TODO", loser: "TODO" };
    case EventTypeEnum.GAME_DELETED: return null;
    case EventTypeEnum.GAME_SCORE: return { setsWon: { gameWinner: "TODO", gameLoser: "TODO" }, setPoints: [{ gameWinner: "TODO", gameLoser: "TODO" }] };
    case EventTypeEnum.TOURNAMENT_CREATED: return { name: "TODO", description: "TODO", startDate: "TODO", groupPlay: "TODO", overridePreferredGroupSize: "TODO" };
    case EventTypeEnum.TOURNAMENT_UPDATED: return { name: "TODO", description: "TODO", startDate: "TODO", groupPlay: "TODO", overridePreferredGroupSize: "TODO" };
    case EventTypeEnum.TOURNAMENT_DELETED: return null;
    case EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER: return { playerOrder: ["TODO"] };
    case EventTypeEnum.TOURNAMENT_SIGNUP: return { player: "TODO" };
    case EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP: return { player: "TODO" };
    case EventTypeEnum.TOURNAMENT_SKIP_GAME: return { skipId: "TODO", winner: "TODO", loser: "TODO" };
    case EventTypeEnum.TOURNAMENT_UNDO_SKIP_GAME: return { skipId: "TODO" };
    default: return {};
  }
}
