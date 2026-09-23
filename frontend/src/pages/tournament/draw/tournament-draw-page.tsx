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
/** The height of a slot row and the gap between two rows, in pixels. The rows are positioned by hand so they can move */
const ROW_SIZE = { large: { rowHeight: 56, rowGap: 8 }, small: { rowHeight: 36, rowGap: 4 } } as const;

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

/** The hero at the top of the countdown and the wait: the tournament name, above what happens next */
const DrawHero: React.FC<{ tournament: Tournament; children: React.ReactNode }> = ({ tournament, children }) => (
  <section className="min-h-[70vh] flex flex-col items-center justify-center text-center py-10 md:py-16">
    <p className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-semibold uppercase tracking-[0.3em] text-primary-text/70">
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
      Live group draw
    </p>
    <h1 className="mt-3 max-w-5xl break-words text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
      {tournament.name}
    </h1>
    <div className="mt-10 md:mt-16 w-full">{children}</div>
  </section>
);

/** The countdown shows its last seconds with a tick animation on every change */
const FINAL_SECONDS = 10_000;

const DrawCountdown: React.FC<{ tournament: Tournament; now: number; onPreview: () => void }> = ({
  tournament,
  now,
  onPreview,
}) => {
  const context = useEventDbContext();
  const remaining = Math.max(0, tournament.startDate - now);
  const parts = countdownParts(remaining);
  const isFinal = remaining <= FINAL_SECONDS;
  const isAdmin = session.sessionData?.role === "admin";
  const canPreview = isAdmin && tournament.signedUp.length >= 2;
  // Four units need more width than three, so they get a smaller font. The xs breakpoint is not
  // used: it is sorted after lg in the generated CSS and would override the larger sizes
  const digitClass =
    parts.length > 3
      ? "text-5xl sm:text-7xl md:text-8xl xl:text-9xl 2xl:text-[10rem]"
      : "text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] xl:text-[12rem]";

  return (
    <div className="mx-4 md:mx-10 pb-10 text-primary-text">
      <DrawHero tournament={tournament}>
        <p className="text-center text-sm sm:text-base md:text-xl font-medium uppercase tracking-[0.2em] text-primary-text/70">
          The draw starts in
        </p>
        <div
          role="timer"
          aria-label={formatCountdown(remaining)}
          className="mt-4 md:mt-6 flex items-start justify-center gap-2 sm:gap-4 md:gap-6"
        >
          {parts.map((part) => (
            <div key={part.label} className="flex flex-col items-center">
              <div
                className={classNames(
                  "rounded-2xl bg-secondary-background text-secondary-text shadow-lg px-3 sm:px-5 lg:px-7 py-2 sm:py-4 lg:py-6",
                  isFinal && "ring-4 ring-red-500",
                )}
              >
                <span
                  key={isFinal ? part.value : undefined}
                  className={classNames(
                    "block tabular-nums font-black leading-none",
                    digitClass,
                    isFinal && "animate-draw-reveal",
                  )}
                >
                  {part.value}
                </span>
              </div>
              <span className="mt-2 md:mt-3 text-xs sm:text-sm md:text-base font-medium uppercase tracking-widest text-primary-text/60">
                {part.label}
              </span>
            </div>
          ))}
        </div>
      </DrawHero>

      <section className="mx-auto max-w-5xl text-center">
        <h2 className="text-lg md:text-2xl font-semibold">
          In the draw <span className="font-normal text-primary-text/60">({tournament.signedUp.length})</span>
        </h2>
        <div className="mt-4 md:mt-6 flex flex-wrap justify-center gap-2 md:gap-3">
          {tournament.signedUp.map((signup) => (
            <div
              key={signup.player}
              className="flex items-center gap-2 min-w-0 max-w-full rounded-full bg-primary-background ring-1 ring-secondary-background/60 py-1 pl-1 pr-4"
            >
              <ProfilePicture playerId={signup.player} size={36} border={2} />
              <p className="truncate text-sm md:text-base font-medium">{context.playerName(signup.player)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-12 md:mt-16 flex flex-col items-center gap-3 text-center">
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to={`/tournament?tournament=${tournament.id}`}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary-background text-secondary-text hover:opacity-80"
          >
            Tournament page
          </Link>
          {canPreview && (
            <button
              onClick={onPreview}
              className="px-4 py-2 rounded-lg text-sm font-semibold ring-1 ring-secondary-background text-primary-text hover:bg-secondary-background/30"
            >
              Preview the show 🎲
            </button>
          )}
        </div>
        {canPreview && (
          <p className="max-w-md text-center text-xs text-primary-text/50">
            Admin only. A test run with the signed up players in a new random order. It changes nothing.
          </p>
        )}
      </footer>
    </div>
  );
};

const DrawWaiting: React.FC<{ tournament: Tournament }> = ({ tournament }) => (
  <div className="mx-4 md:mx-10 text-primary-text">
    <DrawHero tournament={tournament}>
      <p className="text-center text-5xl sm:text-7xl md:text-8xl font-black">
        Drawing<span className="animate-pulse">...</span>
      </p>
      <p className="mt-6 text-center text-sm md:text-lg text-primary-text/70">The draw starts in a moment.</p>
    </DrawHero>
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
                drawOrder={drawGroups[groupIndex]}
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
  /** The slots in the order they are shown. In the draw order until the group sorts, then in the default order */
  slots: DrawSlot[];
  /** The players in the draw order: the order the rows are rendered in, so a row keeps its DOM node when the group sorts */
  drawOrder: string[];
  /** True when the group is complete and its players are in the default order, best player first */
  sorted: boolean;
  allPlayers: string[];
  /** Wall-clock time the local playback started. Turns a timeline offset into a wall-clock time */
  localStartAt: number;
  playerName: (id: string) => string;
  size: "large" | "small";
  celebrating: boolean;
}> = ({ groupIndex, slots, drawOrder, sorted, allPlayers, localStartAt, playerName, size, celebrating }) => {
  const revealedCount = slots.filter((slot) => slot.kind === "revealed").length;
  const isComplete = revealedCount === slots.length;
  const large = size === "large";
  const { rowHeight, rowGap } = large ? ROW_SIZE.large : ROW_SIZE.small;
  const rowPitch = rowHeight + rowGap;

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
      {/* The rows are rendered in the draw order, with a fixed height and an absolute top. When the group
          sorts, the DOM order does not change and only the top of each row does. A row that React moves in
          the DOM would lose its transition and jump, so the rows are never reordered */}
      <div className="relative" style={{ height: slots.length * rowPitch - rowGap }}>
        {drawOrder.map((player, drawIndex) => {
          const position = sorted
            ? slots.findIndex((slot) => slot.kind === "revealed" && slot.player === player)
            : drawIndex;
          return (
            <div
              key={drawIndex}
              className="absolute left-0 right-0 rounded-lg bg-primary-background"
              style={{ top: position * rowPitch, transition: `top ${DRAW_TIMING.SORT}ms ease-in-out` }}
            >
              <SlotRow
                slot={slots[position]}
                rank={sorted ? position + 1 : undefined}
                allPlayers={allPlayers}
                localStartAt={localStartAt}
                playerName={playerName}
                large={large}
              />
            </div>
          );
        })}
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

  // The open slot: it waits with no name first, so the viewer knows where to look, then the names cycle
  if (slot.kind === "cycling" || slot.kind === "waiting") {
    return (
      <div className={classNames(rowClass, "ring-2 ring-secondary-background")}>
        <div
          className="shrink-0 rounded-full bg-secondary-background/40 flex items-center justify-center font-bold"
          style={{ width: avatarSize, height: avatarSize }}
        >
          ?
        </div>
        {slot.kind === "cycling" && (
          <CyclingName
            pool={allPlayers}
            player={slot.player}
            cycleStartAt={localStartAt + slot.startsAt}
            playerName={playerName}
            large={large}
          />
        )}
      </div>
    );
  }

  return (
    <div className={classNames(rowClass, "border border-dashed border-primary-text/20")}>
      <div
        className="shrink-0 rounded-full border border-dashed border-primary-text/20"
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

type CountdownPart = { value: string; label: string };

/** The units of the countdown, with the largest units left out while they are zero. Minutes and seconds are always shown */
export function countdownParts(ms: number): CountdownPart[] {
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  const parts: CountdownPart[] = [];
  if (days > 0) parts.push({ value: days.toString(), label: days === 1 ? "day" : "days" });
  if (days > 0 || hours > 0) parts.push({ value: pad(hours), label: "hrs" });
  parts.push({ value: pad(minutes), label: "min" }, { value: pad(seconds), label: "sec" });
  return parts;
}

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
