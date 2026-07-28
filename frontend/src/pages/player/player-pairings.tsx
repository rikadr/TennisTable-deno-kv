import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { stringToColor } from "../../common/string-to-color";

type Props = {
  playerId: string;
};

function columnTitle(degree: number): string {
  if (degree === 1) return "Played";
  if (degree === 2) return "1 in between";
  return `${degree - 1} in between`;
}

/**
 * Reads a `#rrggbb` colour and picks black or white text for it, so names stay legible on both
 * the dark and the light player colours.
 */
function textColor(background: string): string {
  const hex = background.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
}

const PlayerTag: React.FC<{ playerId: string; title?: string }> = ({ playerId, title }) => {
  const context = useEventDbContext();
  const background = stringToColor(playerId);
  return (
    <Link
      to={`/player/${playerId}`}
      title={title}
      className="block rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap hover:brightness-110 transition-all"
      style={{ backgroundColor: background, color: textColor(background) }}
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
  const { columns, unreachable } = useMemo(
    () => context.playerPairings.get(playerId),
    [context.playerPairings, playerId],
  );

  if (columns.length === 0 && unreachable.length === 0) {
    return <p className="text-sm opacity-70">No other players to connect to.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-4 items-start w-max">
        {columns.map((column) => (
          <PairingsColumn key={column.degree} title={columnTitle(column.degree)} count={column.players.length}>
            {column.players.map((player) => (
              <PlayerTag
                key={player.playerId}
                playerId={player.playerId}
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
              <PlayerTag key={id} playerId={id} />
            ))}
          </PairingsColumn>
        )}
      </div>
    </div>
  );
};
