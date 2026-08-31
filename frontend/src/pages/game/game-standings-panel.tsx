import { useNavigate } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { ProfilePicture } from "../player/profile-picture";
import { GameSeason, PlayerStandings, rankChange, scoreChange } from "../../client/client-db/game-standings";

type Row = {
  label: string;
  before: number | undefined;
  after: number | undefined;
  change: number | undefined;
  digits: number;
  /** The page that shows this number for this player. */
  link: string;
  /** True while the value is still being calculated. */
  pending?: boolean;
};

/** A value that the player does not have, or does not have yet. */
const Absent: React.FC<{ text?: string }> = ({ text = "–" }) => <span className="text-primary-text/40">{text}</span>;

const ChangeCell: React.FC<{ change: number | undefined; digits: number }> = ({ change, digits }) => {
  if (change === undefined) return <Absent />;
  if (Number(change.toFixed(digits)) === 0) return <span className="text-primary-text/60">0</span>;
  return (
    <span className={classNames(change > 0 ? "text-green-500" : "text-red-500")}>
      {fmtNum(change, { digits, signedPositive: true })}
    </span>
  );
};

/**
 * The places and the scores that the game moved for one player: the place on
 * the overall leaderboard, the score and the place on the season leaderboard,
 * and the Hall of Fame score. Each row opens the page that shows that number.
 */
export const StandingsChangeTable: React.FC<{
  playerId: string;
  name: string;
  marker: string;
  before: PlayerStandings;
  after: PlayerStandings;
  hallOfFame: { before: number | undefined; after: number | undefined; pending: boolean };
  season: GameSeason | undefined;
}> = ({ playerId, name, marker, before, after, hallOfFame, season }) => {
  const navigate = useNavigate();

  const rows: Row[] = [
    {
      label: "Leaderboard rank",
      before: before.leaderboardRank,
      after: after.leaderboardRank,
      change: rankChange(before.leaderboardRank, after.leaderboardRank),
      digits: 0,
      link: "/leader-board",
    },
  ];

  if (season) {
    const seasonLink = `/season/player?seasonStart=${season.start}&playerId=${playerId}`;
    rows.push(
      {
        label: `Season ${season.number} score`,
        before: before.seasonScore,
        after: after.seasonScore,
        // A player with no game in the season yet has a season score of 0.
        change: scoreChange(before.seasonScore, after.seasonScore, 0),
        digits: 1,
        link: seasonLink,
      },
      {
        label: `Season ${season.number} rank`,
        before: before.seasonRank,
        after: after.seasonRank,
        change: rankChange(before.seasonRank, after.seasonRank),
        digits: 0,
        link: seasonLink,
      },
    );
  }

  rows.push({
    label: "Hall of Fame score",
    before: hallOfFame.before,
    after: hallOfFame.after,
    change: scoreChange(hallOfFame.before, hallOfFame.after, 0),
    digits: 0,
    link: `/hall-of-fame/${playerId}`,
    pending: hallOfFame.pending,
  });

  return (
    <div className="bg-primary-background rounded-lg w-full max-w-md mx-auto overflow-hidden ring-1 ring-primary-text/20">
      <table className="w-full text-primary-text border-collapse">
        <thead className="border-b border-primary-text/50">
          <tr className="text-xs xs:text-sm md:text-base">
            <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-normal w-[40%] max-w-0">
              <div className="flex items-center gap-1 md:gap-2 min-w-0">
                <ProfilePicture playerId={playerId} size={24} border={2} />
                <span className="truncate">
                  {marker} {name}
                </span>
              </div>
            </th>
            <th className="py-1 px-1 xs:px-2 text-right font-light w-[1%] whitespace-nowrap">Before</th>
            <th className="py-1 px-1 xs:px-2 text-right font-light w-[1%] whitespace-nowrap">After</th>
            <th className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium w-[1%] whitespace-nowrap">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-text/50">
          {rows.map((row) => (
            <tr
              key={row.label}
              onClick={() => navigate(row.link)}
              className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors font-light text-xs xs:text-sm md:text-base"
            >
              <td className="py-1 px-1 xs:px-2 md:px-3 w-[40%] max-w-0">
                <div className="truncate">{row.label}</div>
              </td>
              <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">
                {row.pending ? <Absent text="…" /> : (fmtNum(row.before, { digits: row.digits }) ?? <Absent />)}
              </td>
              <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">
                {row.pending ? <Absent text="…" /> : (fmtNum(row.after, { digits: row.digits }) ?? <Absent />)}
              </td>
              <td className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-medium">
                {row.pending ? <Absent text="…" /> : <ChangeCell change={row.change} digits={row.digits} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
