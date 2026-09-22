import { useEffect, useMemo, useRef, useState } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Tournament } from "../../../client/client-db/tournaments/tournament";
import { TournamentGroupPlay } from "../../../client/client-db/tournaments/group-play";
import { shuffleArray } from "../../../common/array-utils";
import { classNames } from "../../../common/class-names";
import { session } from "../../../services/auth";
import { useNow } from "../../../hooks/use-now";
import { useTennisParams } from "../../../hooks/use-tennis-params";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { ProfilePicture } from "../../player/profile-picture";
import {
  DRAW_TIMING,
  DrawSlot,
  advanceOneStep,
  boardStateAt,
  buildDrawTimeline,
  cycleTickIndexAt,
  cycleTickOffsets,
  getDrawGroups,
  stepIndexAt,
} from "./draw-timeline";

/** How often the clock ticks. Fast enough for a smooth countdown and step changes */
const CLOCK_INTERVAL = 200;
/** A few particles when one player is drawn */
const REVEAL_CONFETTI = { particleCount: 14, force: 0.4, duration: 1_800, width: 400, particleSize: 8 } as const;
/** A bigger burst when a group is complete */
const GROUP_CONFETTI = { particleCount: 80, force: 0.6, duration: 2_800, width: 900 } as const;
/** When the name changes inside a cycle. The same for every slot, so it is built one time */
const CYCLE_TICKS = cycleTickOffsets();
/** A page that mounts this close after the anchor is a live viewer, not a late joiner */
const LIVE_TOLERANCE = 1_000;

export function tournamentDrawUrl(tournamentId: string): string {
  return `/tournament/draw?tournament=${tournamentId}`;
}

function groupPlayUrl(tournamentId: string): string {
  return `/tournament?tournament=${tournamentId}&tab=group-play`;
}

/** An admin's test run of the show: the signed up players in a fresh random order, shown as if they were the draw */
type Preview = { groupPlay: TournamentGroupPlay; anchor: number };

export const TournamentDrawPage: React.FC = () => {
  const { tournament: tournamentId } = useTennisParams();
  const context = useEventDbContext();
  const now = useNow(CLOCK_INTERVAL);
  const tournament = context.tournaments.getTournament(tournamentId);
  const [preview, setPreview] = useState<Preview>();

  if (!tournament) {
    return (
      <div className="max-w-96 mx-4 md:mx-10 space-y-4 text-primary-text">
        <h1>Live draw</h1>
        <p>Tournament not found.</p>
        <Link to="/tournament/list" className="inline-block mt-4 text-sm text-primary-text hover:underline">
          &larr; Back to tournaments
        </Link>
      </div>
    );
  }

  const config = tournament.tournamentConfig;
  if (!config.groupPlay || !config.randomGroupSeeding) {
    return <Navigate to={`/tournament?tournament=${tournament.id}`} replace />;
  }

  if (preview) {
    return (
      <DrawShow
        key={preview.anchor}
        tournament={tournament}
        groupPlay={preview.groupPlay}
        anchor={preview.anchor}
        now={now}
        onPreviewExit={() => setPreview(undefined)}
      />
    );
  }

  if (now < tournament.startDate) {
    const startPreview = () => {
      const anchor = Date.now();
      const playerOrder = context.tournaments.buildPlayerOrder(tournament.id);
      const previewTournament = new Tournament(
        { ...config, startDate: anchor - 1, playerOrder, groupSeeding: shuffleArray([...playerOrder]) },
        [],
        [],
        tournament.signedUp,
        anchor,
      );
      if (previewTournament.groupPlay) setPreview({ groupPlay: previewTournament.groupPlay, anchor });
    };
    return <DrawCountdown tournament={tournament} now={now} onPreview={startPreview} />;
  }

  const anchor = tournament.startDate + DRAW_TIMING.START_DELAY;
  const groupPlay = tournament.groupPlay;
  if (now < anchor || groupPlay === undefined || !groupPlay.hasRandomGroupSeeding) {
    return <DrawWaiting tournament={tournament} />;
  }

  return <DrawShow tournament={tournament} groupPlay={groupPlay} anchor={anchor} now={now} />;
};

const DrawHeader: React.FC<{ tournament: Tournament; children?: React.ReactNode }> = ({ tournament, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-primary-text/60">Live group draw</p>
      <h1 className="text-2xl md:text-3xl font-bold">{tournament.name}</h1>
    </div>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

const DrawCountdown: React.FC<{ tournament: Tournament; now: number; onPreview: () => void }> = ({
  tournament,
  now,
  onPreview,
}) => {
  const context = useEventDbContext();
  const remaining = Math.max(0, tournament.startDate - now);
  const isAdmin = session.sessionData?.role === "admin";
  const canPreview = isAdmin && tournament.signedUp.length >= 2;

  return (
    <div className="mx-4 md:mx-10 space-y-8 text-primary-text">
      <DrawHeader tournament={tournament}>
        <Link
          to={`/tournament?tournament=${tournament.id}`}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary-background text-secondary-text hover:opacity-80"
        >
          Tournament page
        </Link>
      </DrawHeader>

      <div className="text-center space-y-3 py-6">
        <p className="text-sm uppercase tracking-wide text-primary-text/70">The draw starts in</p>
        <p className="text-5xl md:text-7xl font-bold tabular-nums">{formatCountdown(remaining)}</p>
        <p className="text-xs text-primary-text/60">
          The app draws the groups at random when the tournament starts. The show starts{" "}
          {DRAW_TIMING.START_DELAY / 1000} seconds after that.
        </p>
        {canPreview && (
          <div className="pt-4 space-y-1">
            <button
              onClick={onPreview}
              className="px-4 py-2 rounded-lg text-sm font-semibold ring-1 ring-secondary-background text-primary-text hover:bg-secondary-background/30"
            >
              Preview the show 🎲
            </button>
            <p className="text-xs text-primary-text/50">
              Admin only. A test run with the signed up players in a new random order. It changes nothing.
            </p>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto ring-1 ring-secondary-background rounded-lg bg-primary-background p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-primary-text/70 mb-3">
          In the draw <span className="normal-case font-thin italic">({tournament.signedUp.length})</span>
        </h2>
        <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 gap-2">
          {tournament.signedUp.map((signup) => (
            <div key={signup.player} className="flex items-center gap-2 min-w-0">
              <ProfilePicture playerId={signup.player} size={28} border={2} />
              <p className="truncate text-sm">{context.playerName(signup.player)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DrawWaiting: React.FC<{ tournament: Tournament }> = ({ tournament }) => (
  <div className="mx-4 md:mx-10 space-y-8 text-primary-text">
    <DrawHeader tournament={tournament} />
    <div className="text-center space-y-3 py-16">
      <p className="text-3xl md:text-5xl font-bold">
        Drawing<span className="animate-pulse">...</span>
      </p>
      <p className="text-sm text-primary-text/70">The tournament has started. The show starts in a moment.</p>
    </div>
  </div>
);

const DrawShow: React.FC<{
  tournament: Tournament;
  groupPlay: TournamentGroupPlay;
  anchor: number;
  now: number;
  /** Set on a preview. The show then returns here at the end instead of opening the tournament page */
  onPreviewExit?: () => void;
}> = ({ tournament, groupPlay, anchor, now, onPreviewExit }) => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const isPreview = onPreviewExit !== undefined;

  const drawGroups = useMemo(
    () =>
      getDrawGroups(
        groupPlay.groups.map((group) => group.players),
        groupPlay.groupSeeding,
      ),
    [groupPlay],
  );
  // The default order: the tie breaker of the group play leaderboard, best player first
  const sortedGroups = useMemo(() => groupPlay.groups.map((group) => group.players), [groupPlay]);
  const steps = useMemo(() => buildDrawTimeline(drawGroups), [drawGroups]);
  const allPlayers = useMemo(() => drawGroups.flat(), [drawGroups]);

  // The wall-clock time the local playback started. Equal to the anchor when in sync with the live
  // show. Later than the anchor when the viewer joined late: the show then plays from the start,
  // and "Next" moves this back one step at a time until it reaches the anchor.
  const [localStartAt, setLocalStartAt] = useState(() => (Date.now() <= anchor + LIVE_TOLERANCE ? anchor : Date.now()));
  const elapsed = now - localStartAt;
  const board = boardStateAt(drawGroups, steps, elapsed, sortedGroups);
  const isBehind = localStartAt > anchor;
  const stepsBehind = isBehind ? Math.max(0, stepIndexAt(steps, now - anchor) - stepIndexAt(steps, elapsed)) : 0;

  useEffect(() => {
    if (!board.done) return;
    if (onPreviewExit) onPreviewExit();
    else navigate(groupPlayUrl(tournament.id), { replace: true });
  }, [board.done, navigate, tournament.id, onPreviewExit]);

  const currentGroupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    currentGroupRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [board.currentGroupIndex]);

  return (
    <div className="mx-4 md:mx-10 space-y-6 text-primary-text">
      <DrawHeader tournament={tournament}>
        {isPreview && (
          <>
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium ring-1 ring-secondary-background">Preview</span>
            <button
              onClick={onPreviewExit}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary-background text-secondary-text hover:opacity-80"
            >
              Exit preview
            </button>
          </>
        )}
        {isBehind ? (
          <>
            <span className="text-xs text-primary-text/70">
              {stepsBehind} {stepsBehind === 1 ? "step" : "steps"} behind live
            </span>
            <button
              onClick={() => setLocalStartAt((prev) => advanceOneStep(steps, prev, anchor, Date.now()))}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-secondary-background text-secondary-text hover:opacity-80"
            >
              Next &rarr;
            </button>
          </>
        ) : (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ring-1 ring-secondary-background">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live
          </span>
        )}
      </DrawHeader>

      {/* One list with stable keys, so a group keeps its DOM nodes when it changes size and its reveals do not replay */}
      <div className="flex flex-wrap justify-center gap-3">
        {drawGroups.map((_, groupIndex) => {
          const isCurrent = groupIndex === board.currentGroupIndex;
          return (
            <div
              key={groupIndex}
              ref={isCurrent ? currentGroupRef : undefined}
              className={classNames(isCurrent ? "basis-full max-w-lg scroll-mt-4" : "w-full xs:w-64")}
            >
              <GroupCard
                groupIndex={groupIndex}
                slots={board.groups[groupIndex]}
                sorted={board.sorted[groupIndex]}
                allPlayers={allPlayers}
                localStartAt={localStartAt}
                playerName={context.playerName.bind(context)}
                size={isCurrent ? "large" : "small"}
                celebrating={board.celebratingGroupIndex === groupIndex}
              />
            </div>
          );
        })}
      </div>

      {!isPreview && (
        <div className="text-center pb-6">
          <Link to={groupPlayUrl(tournament.id)} className="text-xs text-primary-text/60 hover:underline">
            Skip the show and open the tournament page
          </Link>
        </div>
      )}
    </div>
  );
};

const GroupCard: React.FC<{
  groupIndex: number;
  slots: DrawSlot[];
  /** True when the group is complete and its players are in the default order, best player first */
  sorted: boolean;
  allPlayers: string[];
  /** Wall-clock time the local playback started. Turns a timeline offset into a wall-clock time */
  localStartAt: number;
  playerName: (id: string) => string;
  size: "large" | "small";
  celebrating: boolean;
}> = ({ groupIndex, slots, sorted, allPlayers, localStartAt, playerName, size, celebrating }) => {
  const revealedCount = slots.filter((slot) => slot.kind === "revealed").length;
  const isComplete = revealedCount === slots.length;
  const large = size === "large";

  return (
    <div
      className={classNames(
        "rounded-lg bg-primary-background text-primary-text",
        large ? "ring-2 ring-secondary-background p-4 md:p-6" : "ring-1 ring-secondary-background/60 p-3",
        !large && revealedCount === 0 && "opacity-60",
      )}
    >
      <div className="relative flex justify-between items-baseline mb-3">
        {celebrating && (
          <div className="absolute left-1/2 top-0">
            <ConfettiExplosion {...GROUP_CONFETTI} />
          </div>
        )}
        <h2 className={classNames("font-semibold", large ? "text-2xl" : "text-base")}>Group {groupIndex + 1}</h2>
        <span className="text-xs text-primary-text/60">
          {isComplete ? "Complete" : `${revealedCount} / ${slots.length}`}
        </span>
      </div>
      <div className={classNames(large ? "space-y-2" : "space-y-1")}>
        {/* The key changes when the group sorts, so every row plays the reveal animation one time in its new place */}
        {slots.map((slot, slotIndex) => (
          <SlotRow
            key={`${sorted ? "sorted" : "draw"}-${slotIndex}`}
            slot={slot}
            rank={sorted ? slotIndex + 1 : undefined}
            allPlayers={allPlayers}
            localStartAt={localStartAt}
            playerName={playerName}
            large={large}
          />
        ))}
      </div>
    </div>
  );
};

const SlotRow: React.FC<{
  slot: DrawSlot;
  /** The position in the default order. Set when the group is sorted */
  rank?: number;
  allPlayers: string[];
  localStartAt: number;
  playerName: (id: string) => string;
  large: boolean;
}> = ({ slot, rank, allPlayers, localStartAt, playerName, large }) => {
  const avatarSize = large ? 44 : 24;
  const rowClass = classNames("flex items-center gap-3 rounded-lg", large ? "h-14 px-3" : "h-9 px-2");

  if (slot.kind === "revealed") {
    return (
      <div className={classNames(rowClass, "relative bg-secondary-background/20 animate-draw-reveal")}>
        {slot.fresh && (
          <div className="absolute left-1/2 top-1/2">
            <ConfettiExplosion {...REVEAL_CONFETTI} />
          </div>
        )}
        {rank !== undefined && (
          <span
            className={classNames(
              "shrink-0 w-5 text-right tabular-nums text-primary-text/60",
              large ? "text-base" : "text-xs",
            )}
          >
            {rank}
          </span>
        )}
        <ProfilePicture playerId={slot.player} size={avatarSize} border={2} />
        <p className={classNames("truncate font-medium", large ? "text-xl" : "text-sm")}>{playerName(slot.player)}</p>
      </div>
    );
  }

  if (slot.kind === "cycling") {
    return (
      <div className={classNames(rowClass, "ring-2 ring-secondary-background")}>
        <div
          className="shrink-0 rounded-full bg-secondary-background/40 flex items-center justify-center font-bold"
          style={{ width: avatarSize, height: avatarSize }}
        >
          ?
        </div>
        <CyclingName
          pool={allPlayers}
          player={slot.player}
          cycleStartAt={localStartAt + slot.startsAt}
          playerName={playerName}
          large={large}
        />
      </div>
    );
  }

  // An empty slot. The waiting slot is the next to be drawn: it pulses, so the viewer knows where to look
  const waiting = slot.kind === "waiting";
  return (
    <div
      className={classNames(
        rowClass,
        "border border-dashed",
        waiting ? "border-primary-text/70 animate-pulse" : "border-primary-text/20",
      )}
    >
      <div
        className={classNames(
          "shrink-0 rounded-full border border-dashed",
          waiting ? "border-primary-text/70" : "border-primary-text/20",
        )}
        style={{ width: avatarSize, height: avatarSize }}
      />
    </div>
  );
};

/**
 * Shows one name after another from the pool on the tick schedule of the cycle: fast at first,
 * slow towards the end. Every tick but the last shows a random other name, never the same name
 * twice in a row. The last tick shows the drawn player, so the cycle lands on the player.
 */
const CyclingName: React.FC<{
  pool: string[];
  /** The player the cycle lands on */
  player: string;
  /** Wall-clock time the cycle started */
  cycleStartAt: number;
  playerName: (id: string) => string;
  large: boolean;
}> = ({ pool, player, cycleStartAt, playerName, large }) => {
  const others = useMemo(() => pool.filter((p) => p !== player), [pool, player]);
  // A counter, not the tick index: a timer that fires a hair early must still re-run the effect
  const [beat, setBeat] = useState(0);
  const [shown, setShown] = useState<string>(player);
  const shownTickRef = useRef<number>();

  useEffect(() => {
    const index = cycleTickIndexAt(CYCLE_TICKS, Date.now() - cycleStartAt);
    const isLast = index >= CYCLE_TICKS.length - 1;
    if (isLast || others.length === 0) {
      setShown(player);
      return;
    }
    if (shownTickRef.current !== index) {
      shownTickRef.current = index;
      setShown((prev) => {
        const candidates = others.length > 1 ? others.filter((p) => p !== prev) : others;
        return candidates[Math.floor(Math.random() * candidates.length)];
      });
    }
    const timer = setTimeout(
      () => setBeat((prev) => prev + 1),
      Math.max(1, cycleStartAt + CYCLE_TICKS[index + 1] - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [beat, cycleStartAt, others, player]);

  return (
    <p className={classNames("truncate font-medium text-primary-text/70", large ? "text-xl" : "text-sm")}>
      {playerName(shown)}
    </p>
  );
};

/** d h m s, with the largest units left out while they are zero */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}
