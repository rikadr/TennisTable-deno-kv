import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  buildTournamentConnections,
  LONG_ABSENCE,
  PairMeeting,
  PlayerArrival,
} from "../../../client/client-db/tournaments/tournament-connections";
import { Tournament } from "../../../client/client-db/tournaments/tournament";
import { classNames } from "../../../common/class-names";
import { fmtNum } from "../../../common/number-utils";
import { ONE_DAY, ONE_MONTH, ONE_YEAR } from "../../../common/time-in-ms";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { ProfilePicture } from "../../player/profile-picture";

/**
 * Who the tournament brought together. Two ledgers: the pairs who had never met or had not met in
 * a long time, and the players who had not been playing at all
 */
export const TournamentConnectionsWidget: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const context = useEventDbContext();
  const connections = useMemo(() => buildTournamentConnections(tournament, context), [tournament, context]);

  if (!connections) {
    return (
      <WidgetFrame>
        <Header />
        <p className="text-sm font-light">No games have been played yet, so there is nothing to compare against.</p>
      </WidgetFrame>
    );
  }

  const { firstMeetings, reunions, longestGap, arrivals, pairs, playersPlayed, gamesPlayed } = connections;
  const debuts = arrivals.filter((arrival) => arrival.debut);
  const returning = arrivals.filter((arrival) => arrival.returning);
  const firstTimers = arrivals.filter((arrival) => arrival.firstTournament && !arrival.returning);
  const nothingNew = firstMeetings.length === 0 && reunions.length === 0 && arrivals.length === 0;

  return (
    <WidgetFrame>
      <Header>
        {fmtNum(playersPlayed)} players · {fmtNum(gamesPlayed)} games · {fmtNum(pairs.length)} pairings
      </Header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Tile value={firstMeetings.length} label="First-ever meetings" of={pairs.length} />
        <Tile value={reunions.length} label="Reunions" of={pairs.length} />
        <Tile value={debuts.length} label="First games ever" of={playersPlayed} />
        <Tile value={returning.length} label="Back after a break" of={playersPlayed} />
      </div>

      {nothingNew && (
        <p className="text-sm font-light mb-6">
          Everyone here already plays each other regularly.
          {longestGap && (
            <>
              {" "}
              The longest anyone had gone without meeting was{" "}
              <span className="font-medium">{formatGap(longestGap.gap ?? 0)}</span>, between{" "}
              {context.playerName(longestGap.players[0])} and {context.playerName(longestGap.players[1])}.
            </>
          )}
        </p>
      )}

      {firstMeetings.length > 0 && (
        <Section title="First-ever meetings" subtitle="They had never played each other before">
          {firstMeetings.map((pair) => (
            <PairRow key={pair.key} pair={pair} />
          ))}
        </Section>
      )}

      {reunions.length > 0 && (
        <Section title="Reunions" subtitle={`Pairs who had not met in ${formatGap(LONG_ABSENCE)} or more`}>
          {reunions.map((pair) => (
            <PairRow key={pair.key} pair={pair}>
              First meeting in <span className="font-medium">{formatGap(pair.gap ?? 0)}</span>
            </PairRow>
          ))}
        </Section>
      )}

      {debuts.length > 0 && (
        <Section title="First game ever" subtitle="The tournament was their first game in the club">
          {debuts.map((arrival) => (
            <PlayerRow key={arrival.playerId} arrival={arrival} />
          ))}
        </Section>
      )}

      {returning.length > 0 && (
        <Section title="Back after a break" subtitle={`They had not played in ${formatGap(LONG_ABSENCE)} or more`}>
          {returning.map((arrival) => (
            <PlayerRow key={arrival.playerId} arrival={arrival}>
              Away for <span className="font-medium">{formatGap(arrival.awayFor ?? 0)}</span>
            </PlayerRow>
          ))}
        </Section>
      )}

      {firstTimers.length > 0 && (
        <Section title="First tournament" subtitle="They had been playing, but never in a tournament">
          {firstTimers.map((arrival) => (
            <PlayerRow key={arrival.playerId} arrival={arrival} />
          ))}
        </Section>
      )}

      <p className="mt-6 text-xs font-light leading-relaxed">
        Measured against the club as it stood when the tournament started. Skipped games, byes and walkovers are left
        out: nobody met over them.
      </p>
    </WidgetFrame>
  );
};

const WidgetFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="ring-1 ring-secondary-background w-full max-w-4xl mx-auto px-4 md:px-6 py-6 text-primary-text bg-primary-background rounded-lg shadow-sm">
    {children}
  </div>
);

const Header: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-6">
    <h2 className="text-xl font-bold">New connections</h2>
    {children && <p className="text-sm">{children}</p>}
  </div>
);

const Tile: React.FC<{ value: number; label: string; of: number }> = ({ value, label, of }) => (
  <div
    className={classNames(
      "rounded-lg px-3 py-2 ring-1 ring-secondary-background",
      value === 0 && "opacity-50",
    )}
  >
    <p className="text-2xl font-bold leading-tight">{fmtNum(value)}</p>
    <p className="text-xs font-light leading-tight">{label}</p>
    <p className="text-[0.65rem] font-light mt-1">of {fmtNum(of)}</p>
  </div>
);

const Section: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="mb-6">
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="text-xs font-light mb-2">{subtitle}</p>
    <div className="space-y-1">{children}</div>
  </div>
);

const PairRow: React.FC<{ pair: PairMeeting; children?: React.ReactNode }> = ({ pair, children }) => {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-secondary-background">
      <div className="flex -space-x-2 shrink-0">
        <ProfilePicture playerId={pair.players[0]} size={28} border={2} linkToPlayer />
        <ProfilePicture playerId={pair.players[1]} size={28} border={2} linkToPlayer />
      </div>
      <div className="min-w-0 grow">
        <p className="text-sm truncate">
          <PlayerLink playerId={pair.players[0]} /> <span className="font-light">vs</span>{" "}
          <PlayerLink playerId={pair.players[1]} />
        </p>
        {children && <p className="text-xs font-light">{children}</p>}
      </div>
      {pair.gamesInTournament > 1 && (
        <p className="shrink-0 text-xs font-light" title={`They met ${pair.gamesInTournament} times in this tournament`}>
          met {fmtNum(pair.gamesInTournament)}×
        </p>
      )}
    </div>
  );
};

const PlayerRow: React.FC<{ arrival: PlayerArrival; children?: React.ReactNode }> = ({ arrival, children }) => {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-secondary-background">
      <div className="shrink-0">
        <ProfilePicture playerId={arrival.playerId} size={28} border={2} linkToPlayer />
      </div>
      <div className="min-w-0 grow">
        <p className="text-sm truncate">
          <PlayerLink playerId={arrival.playerId} />
        </p>
        {children && <p className="text-xs font-light">{children}</p>}
      </div>
    </div>
  );
};

const PlayerLink: React.FC<{ playerId: string }> = ({ playerId }) => {
  const context = useEventDbContext();
  return (
    <Link to={`/player/${playerId}`} className="font-medium hover:underline">
      {context.playerName(playerId)}
    </Link>
  );
};

/** Gaps are read in months and years. Anything shorter is a curiosity, not a reunion */
function formatGap(ms: number): string {
  if (ms < ONE_MONTH) return `${fmtNum(ms / ONE_DAY)} days`;
  if (ms < ONE_YEAR) return `${fmtNum(ms / ONE_MONTH)} months`;
  const years = ms / ONE_YEAR;
  return `${fmtNum(years, { digits: years < 10 ? 1 : 0 })} years`;
}
