import { useState, useMemo } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { EventType } from "../../client/client-db/event-store/event-types";
import { relativeTimeString } from "../../common/date-utils";
import { session } from "../../services/auth";

export const Events = () => {
  const context = useEventDbContext();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Filter and search
  const filteredEvents = useMemo(() => {
    if (!searchTerm) return context.events.toReversed();

    const lower = searchTerm.toLowerCase();
    return context.events
      .toReversed()
      .filter(
        (event) =>
          event.type.toLowerCase().includes(lower) ||
          event.stream.toLowerCase().includes(lower) ||
          JSON.stringify(event.data).toLowerCase().includes(lower) ||
          event.time.toString().includes(lower),
      );
  }, [context.events, searchTerm]);

  // Paginate
  const paginatedEvents = useMemo(() => {
    const start = page * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, page, pageSize]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize);

  const toggleExpanded = (time: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(time)) {
        next.delete(time);
      } else {
        next.add(time);
      }
      return next;
    });
  };

  const handleEdit = (event: EventType) => {
    setEditingId(event.time);
    setEditForm({ ...event });
  };

  const handleSave = () => {
    if (editForm && editingId) {
      // context.updateEvent(editingId, editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleDelete = (eventTime: number) => {
    if (
      window.confirm(
        "⚠️ WARNING ⚠️ Are you sure you want to delete this event? It can NEVER be recovered. - aka DESTRUCTIVE delete. Also, if you are not carefull you can break business logic that depends on events to exist.",
      )
    ) {
      // context.deleteEvent(eventTime);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  };

  if (session.sessionData?.role !== "admin") {
    return <div>Not authorized</div>;
  }

  return (
    <div className="p-6">
      {/* Search and Controls */}
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(0); // Reset to first page on search
          }}
          className="border rounded px-3 py-2 flex-1 min-w-[200px] bg-primary-background"
        />

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          className="border rounded px-3 py-2 bg-primary-background"
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
          <option value={200}>200 per page</option>
        </select>
      </div>

      {/* Pagination Controls */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setPage(0)}
          disabled={page === 0}
          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          First
        </button>
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          Previous
        </button>
        <span className="px-3 py-1">
          Page {page + 1} of {totalPages || 1}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          Next
        </button>
        <button
          onClick={() => setPage(totalPages - 1)}
          disabled={page >= totalPages - 1}
          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          Last
        </button>
        <h1 className="text-xl font-normal ml-6">
          <span className="text-2xl font-semibold">{filteredEvents.length}</span>
          {" of "}
          <span className="text-2xl font-semibold">{context.events.length}</span> total events
        </h1>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-secondary-background text-secondary-text">
              <th className="border border-gray-300 px-4 py-2 text-left w-32">Time</th>
              <th className="border border-gray-300 px-4 py-2 text-left w-32">Type</th>
              <th className="border border-gray-300 px-4 py-2 text-left w-32">Stream</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Data</th>
              <th className="border border-gray-300 px-4 py-2 text-left w-48">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.map((event) => (
              <tr key={event.time} className="hover:bg-primary-text/10">
                {editingId === event.time ? (
                  // Edit mode
                  <>
                    <td className="border border-gray-300 px-4 py-2">
                      <input
                        type="number"
                        value={editForm.time}
                        onChange={(e) => handleFieldChange("time", Number(e.target.value))}
                        className="w-full border rounded px-2 py-1 bg-primary-background"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <input
                        type="text"
                        value={editForm.type}
                        onChange={(e) => handleFieldChange("type", e.target.value)}
                        className="w-full border rounded px-2 py-1 bg-primary-background"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <input
                        type="text"
                        value={editForm.stream}
                        onChange={(e) => handleFieldChange("stream", e.target.value)}
                        className="w-full border rounded px-2 py-1 bg-primary-background"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <textarea
                        value={JSON.stringify(editForm.data, null, 2)}
                        onChange={(e) => {
                          try {
                            handleFieldChange("data", JSON.parse(e.target.value));
                          } catch (err) {
                            // Allow invalid JSON while typing
                          }
                        }}
                        className="w-full border rounded px-2 py-1 font-mono text-sm bg-primary-background"
                        rows={5}
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <button
                        onClick={handleSave}
                        className="bg-green-500 text-white px-3 py-1 rounded mr-2 hover:bg-green-600 mb-2"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  // View mode
                  <>
                    <td className="border border-gray-300 px-4 py-2 font-mono w-96">
                      {event.time}
                      <p>{relativeTimeString(new Date(event.time))}</p>
                      <p>
                        {new Date(event.time).toLocaleDateString("nb-NO", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                    </td>
                    <td className="border border-gray-300 px-4 py-2">{event.type}</td>
                    <td className="border border-gray-300 px-4 py-2">{event.stream}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      {expandedRows.has(event.time) ? (
                        <div className="space-y-2">
                          <pre className="text-xs overflow-auto max-h-96 p-2 bg-primary-background text-primary-text rounded">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                          <button
                            onClick={() => toggleExpanded(event.time)}
                            className="text-blue-500 hover:underline text-sm"
                          >
                            Show less
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-xs truncate max-w-md text-primary-text">
                            {JSON.stringify(event.data)}
                          </div>
                          <button
                            onClick={() => toggleExpanded(event.time)}
                            className="text-blue-500 hover:underline text-sm"
                          >
                            Show more
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleEdit(event)}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 w-full"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(event.time)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 w-full"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginatedEvents.length === 0 && <div className="text-center py-8 text-gray-500">No events found</div>}
    </div>
  );
};
