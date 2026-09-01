import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  buildTournamentConnections,
  GameLocation,
  PairMeeting,
  PlayerArrival,
} from "../../../client/client-db/tournaments/tournament-connections";
import { Tournament } from "../../../client/client-db/tournaments/tournament";
import { fmtNum } from "../../../common/number-utils";
import { ONE_DAY, ONE_MONTH, ONE_YEAR } from "../../../common/time-in-ms";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { ProfilePicture } from "../../player/profile-picture";
import { tournamentGameLink } from "../tournament-game-location";

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
  // The three player lists answer different questions, so the same player can turn up in more than
  // one of them: a debut is also a first tournament, and so is a return from a long break
  const debuts = arrivals.filter((arrival) => arrival.debut);
  const returning = arrivals.filter((arrival) => arrival.returning);
  const firstTimers = arrivals.filter((arrival) => arrival.firstTournament);
  const nothingNew = firstMeetings.length === 0 && reunions.length === 0 && arrivals.length === 0;

  return (
    <WidgetFrame>
      <Header>
        {fmtNum(playersPlayed)} players · {fmtNum(gamesPlayed)} games · {fmtNum(pairs.length)} pairings
      </Header>

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
        <Section title="First-ever meetings" count={firstMeetings.length}>
          {firstMeetings.map((pair) => (
            <PairRow key={pair.key} pair={pair} tournamentId={tournament.id} />
          ))}
        </Section>
      )}

      {reunions.length > 0 && (
        <Section title="Reunions" count={reunions.length}>
          {reunions.map((pair) => (
            <PairRow key={pair.key} pair={pair} tournamentId={tournament.id}>
              First meeting in <span className="font-medium">{formatGap(pair.gap ?? 0)}</span>
            </PairRow>
          ))}
        </Section>
      )}

      {debuts.length > 0 && (
        <Section title="First game ever" count={debuts.length}>
          {debuts.map((arrival) => (
            <PlayerRow key={arrival.playerId} arrival={arrival} tournamentId={tournament.id} />
          ))}
        </Section>
      )}

      {returning.length > 0 && (
        <Section title="Back after a break" count={returning.length}>
          {returning.map((arrival) => (
            <PlayerRow key={arrival.playerId} arrival={arrival} tournamentId={tournament.id}>
              Away for <span className="font-medium">{formatGap(arrival.awayFor ?? 0)}</span>
            </PlayerRow>
          ))}
        </Section>
      )}

      {firstTimers.length > 0 && (
        <Section title="First tournament" count={firstTimers.length}>
          {firstTimers.map((arrival) => (
            <PlayerRow key={arrival.playerId} arrival={arrival} tournamentId={tournament.id} />
          ))}
        </Section>
      )}
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

/** Two columns from tablet up: the entries are short, and one column left most of the width empty */
const Section: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <div className="mb-6">
    <h3 className="text-sm font-semibold mb-2">
      {title} <span className="font-thin italic">({fmtNum(count)})</span>
    </h3>
    <div className="grid gap-1 md:grid-cols-2">{children}</div>
  </div>
);

/** min-w-0 keeps the card inside its grid column, so long names truncate instead of pushing it wider */
const EntryCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 bg-secondary-background text-secondary-text">
    {children}
  </div>
);

const PairRow: React.FC<{ pair: PairMeeting; tournamentId: string; children?: React.ReactNode }> = ({
  pair,
  tournamentId,
  children,
}) => {
  const metAgain = pair.gamesInTournament > 1;
  return (
    <EntryCard>
      <div className="flex -space-x-2 shrink-0">
        <ProfilePicture playerId={pair.players[0]} size={28} border={2} linkToPlayer />
        <ProfilePicture playerId={pair.players[1]} size={28} border={2} linkToPlayer />
      </div>
      <div className="min-w-0 grow">
        <p className="text-sm truncate">
          <PlayerLink playerId={pair.players[0]} /> <span className="font-light">vs</span>{" "}
          <PlayerLink playerId={pair.players[1]} />
        </p>
        {(children || metAgain) && (
          <p className="text-xs font-light truncate">
            {children}
            {children && metAgain && " · "}
            {metAgain && `met ${fmtNum(pair.gamesInTournament)}×`}
          </p>
        )}
      </div>
      <ViewMatch tournamentId={tournamentId} game={pair.firstGame} />
    </EntryCard>
  );
};

const PlayerRow: React.FC<{ arrival: PlayerArrival; tournamentId: string; children?: React.ReactNode }> = ({
  arrival,
  tournamentId,
  children,
}) => {
  return (
    <EntryCard>
      <div className="shrink-0">
        <ProfilePicture playerId={arrival.playerId} size={28} border={2} linkToPlayer />
      </div>
      <div className="min-w-0 grow">
        <p className="text-sm truncate">
          <PlayerLink playerId={arrival.playerId} />
        </p>
        {children && <p className="text-xs font-light truncate">{children}</p>}
      </div>
      <ViewMatch tournamentId={tournamentId} game={arrival.firstGame} />
    </EntryCard>
  );
};

/**
 * Every entry in every section came out of a game, so every entry can be followed back to it. The
 * tournament page scrolls the game's card into view and wiggles it once it is there
 */
const ViewMatch: React.FC<{ tournamentId: string; game: GameLocation }> = ({ tournamentId, game }) => (
  <Link
    to={tournamentGameLink(tournamentId, game)}
    className="shrink-0 rounded-md px-2 py-1 text-xs font-light whitespace-nowrap bg-tertiary-background text-tertiary-text hover:opacity-80 transition-opacity"
  >
    View match
  </Link>
);

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
