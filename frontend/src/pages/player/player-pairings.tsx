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

const MIN_GAMES_PER_LINK = 1;
const MAX_GAMES_PER_LINK = 10;

const CogIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

type SettingsProps = {
  includeRetired: boolean;
  onIncludeRetiredChange: (value: boolean) => void;
  minGamesPerLink: number;
  onMinGamesPerLinkChange: (value: number) => void;
};

const PairingsSettings: React.FC<SettingsProps> = ({
  includeRetired,
  onIncludeRetiredChange,
  minGamesPerLink,
  onMinGamesPerLinkChange,
}) => (
  <div className="w-full sm:w-72 bg-secondary-background text-secondary-text rounded-lg p-3 space-y-3">
    <label className="flex items-center gap-2 py-1 text-sm cursor-pointer">
      <input
        type="checkbox"
        className="w-4 h-4 cursor-pointer accent-secondary-text"
        checked={includeRetired}
        onChange={(event) => onIncludeRetiredChange(event.target.checked)}
      />
      Include retired players
    </label>
    <div>
      <label className="flex items-baseline justify-between gap-2 text-sm" htmlFor="pairings-min-games">
        Games per link
        <span className="font-semibold">
          {minGamesPerLink} game{minGamesPerLink === 1 ? "" : "s"}
        </span>
      </label>
      <input
        id="pairings-min-games"
        type="range"
        min={MIN_GAMES_PER_LINK}
        max={MAX_GAMES_PER_LINK}
        value={minGamesPerLink}
        onChange={(event) => onMinGamesPerLinkChange(Number(event.target.value))}
        className="w-full mt-1 cursor-pointer accent-secondary-text"
      />
      <p className="text-xs opacity-70">
        Two players are only linked once they have played each other this many times.
      </p>
    </div>
  </div>
);

export const PlayerPairings: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();
  const search = usePlayerLinkSearch();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [includeRetired, setIncludeRetired] = useState(false);
  const [minGamesPerLink, setMinGamesPerLink] = useState(MIN_GAMES_PER_LINK);

  const { columns, unreachable } = useMemo(
    () => context.playerPairings.get(playerId, { includeRetired, minGamesPerLink }),
    [context.playerPairings, playerId, includeRetired, minGamesPerLink],
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

  const onPath = new Set(path);
  const dimmed = (id: string) => path.length > 0 && !onPath.has(id);
  const isEmpty = columns.length === 0 && unreachable.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          aria-label="Pairing settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
          className={classNames(
            "rounded-full p-2 hover:bg-secondary-background hover:text-secondary-text transition-colors",
            settingsOpen && "bg-secondary-background text-secondary-text",
          )}
        >
          <CogIcon />
        </button>
        {settingsOpen && (
          <PairingsSettings
            includeRetired={includeRetired}
            onIncludeRetiredChange={setIncludeRetired}
            minGamesPerLink={minGamesPerLink}
            onMinGamesPerLinkChange={setMinGamesPerLink}
          />
        )}
      </div>
      {isEmpty ? (
        <p className="text-sm opacity-70">No other players to connect to.</p>
      ) : (
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
      )}
    </div>
  );
};
