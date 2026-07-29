import { Link } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { stringToColor } from "../../common/string-to-color";
import { classNames } from "../../common/class-names";
import { readableTextColor } from "../../common/color-utils";
import { usePlayerLinkSearch } from "../../hooks/use-player-link-search";

type Props = {
  playerId: string;
};

/** A line drawn across one hop of a highlighted path, pointing towards the player. */
type PathLine = { key: string; x1: number; y1: number; x2: number; y2: number };

const ARROW_MARKER_ID = "player-pairings-arrow";

function columnTitle(degree: number): string {
  if (degree === 1) return "Played";
  if (degree === 2) return "1 in between";
  return `${degree - 1} in between`;
}

type TagProps = {
  playerId: string;
  title?: string;
  dimmed: boolean;
  /** Query string to keep, so clicking through lands on the tab you are already on. */
  search: string;
  onRef: (playerId: string, element: HTMLAnchorElement | null) => void;
  onHighlight: (playerId: string | undefined) => void;
};

const PlayerTag: React.FC<TagProps> = ({ playerId, title, dimmed, search, onRef, onHighlight }) => {
  const context = useEventDbContext();
  const background = stringToColor(playerId);
  return (
    <Link
      ref={(element) => onRef(playerId, element)}
      to={{ pathname: `/player/${playerId}`, search }}
      title={title}
      onMouseEnter={() => onHighlight(playerId)}
      onMouseLeave={() => onHighlight(undefined)}
      onFocus={() => onHighlight(playerId)}
      onBlur={() => onHighlight(undefined)}
      className={classNames(
        "block rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap hover:brightness-110 transition-all",
        dimmed && "opacity-25",
      )}
      style={{ backgroundColor: background, color: readableTextColor(background) }}
    >
      {context.playerName(playerId)}
    </Link>
  );
};

const PairingsColumn: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({
  title,
  count,
  children,
}) => (
  <div className="flex flex-col gap-1 shrink-0">
    <div className="mb-1">
      <h4 className="text-sm font-semibold whitespace-nowrap">{title}</h4>
      <p className="text-xs opacity-70">
        {count} player{count === 1 ? "" : "s"}
      </p>
    </div>
    {children}
  </div>
);

export const PlayerPairings: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();
  const search = usePlayerLinkSearch();

  const { columns, unreachable } = useMemo(
    () => context.playerPairings.get(playerId),
    [context.playerPairings, playerId],
  );

  const paths = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const column of columns) {
      for (const player of column.players) {
        map.set(player.playerId, player.path);
      }
    }
    return map;
  }, [columns]);

  const contentRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [highlighted, setHighlighted] = useState<string>();
  const [lines, setLines] = useState<PathLine[]>([]);

  const registerTag = useCallback((id: string, element: HTMLAnchorElement | null) => {
    if (element) tagRefs.current.set(id, element);
    else tagRefs.current.delete(id);
  }, []);

  // Clicking a tag keeps this widget mounted on the next player's page, where a highlight left
  // over from the tag under the cursor would belong to the wrong path.
  useEffect(() => setHighlighted(undefined), [playerId]);

  /** The hovered player and every player between them and you. Empty unless there is a hop to draw. */
  const path = useMemo(() => {
    const found = highlighted ? paths.get(highlighted) : undefined;
    return found && found.length > 1 ? found : [];
  }, [highlighted, paths]);

  useLayoutEffect(() => {
    if (path.length < 2) {
      setLines([]);
      return;
    }
    const measure = () => {
      const content = contentRef.current;
      if (!content) return;
      const origin = content.getBoundingClientRect();
      const drawn: PathLine[] = [];
      // Walk from the hovered player back towards you, one column at a time.
      for (let index = path.length - 1; index > 0; index--) {
        const from = tagRefs.current.get(path[index]);
        const towards = tagRefs.current.get(path[index - 1]);
        if (!from || !towards) continue;
        const fromRect = from.getBoundingClientRect();
        const towardsRect = towards.getBoundingClientRect();
        drawn.push({
          key: `${path[index - 1]}-${path[index]}`,
          x1: fromRect.left - origin.left,
          y1: fromRect.top - origin.top + fromRect.height / 2,
          x2: towardsRect.right - origin.left,
          y2: towardsRect.top - origin.top + towardsRect.height / 2,
        });
      }
      setLines(drawn);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [path]);

  if (columns.length === 0 && unreachable.length === 0) {
    return <p className="text-sm opacity-70">No other players to connect to.</p>;
  }

  const onPath = new Set(path);
  const dimmed = (id: string) => path.length > 0 && !onPath.has(id);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div ref={contentRef} className="relative flex gap-6 items-start w-max">
        {columns.map((column) => (
          <PairingsColumn key={column.degree} title={columnTitle(column.degree)} count={column.players.length}>
            {column.players.map((player) => (
              <PlayerTag
                key={player.playerId}
                playerId={player.playerId}
                dimmed={dimmed(player.playerId)}
                search={search}
                onRef={registerTag}
                onHighlight={setHighlighted}
                title={
                  column.degree === 1
                    ? `${player.games} game${player.games === 1 ? "" : "s"} together`
                    : `Via ${player.path
                        .slice(0, -1)
                        .map((id) => context.playerName(id))
                        .join(" → ")}`
                }
              />
            ))}
          </PairingsColumn>
        ))}
        {unreachable.length > 0 && (
          <PairingsColumn title="No connection" count={unreachable.length}>
            {unreachable.map((id) => (
              <PlayerTag
                key={id}
                playerId={id}
                dimmed={dimmed(id)}
                search={search}
                onRef={registerTag}
                onHighlight={setHighlighted}
              />
            ))}
          </PairingsColumn>
        )}
        {lines.length > 0 && (
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
            <defs>
              <marker
                id={ARROW_MARKER_ID}
                markerWidth={5}
                markerHeight={5}
                refX={4}
                refY={2}
                orient="auto"
                fill="rgb(var(--color-primary-text))"
              >
                <path d="M 0 0 L 4 2 L 0 4 z" />
              </marker>
            </defs>
            {lines.map((line) => (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="rgb(var(--color-primary-text))"
                strokeWidth={2}
                strokeLinecap="round"
                markerEnd={`url(#${ARROW_MARKER_ID})`}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
};
