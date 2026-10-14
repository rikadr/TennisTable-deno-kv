import { useEffect, useRef, useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { stringToColor } from "../../common/string-to-color";
import { classNames } from "../../common/class-names";
import { fill } from "../../common/player-color-styles";
import { BadSide } from "../../common/table-sides";
import {
  describeScoreDraftIssue,
  DraftSet,
  DraftSlot,
  hasResult,
  hasSetPoints,
  MAX_SETS_PER_PLAYER,
  RESULT_PRESETS,
  ScoreDraft,
  scoreDraftIssues,
  setWinners,
  withBadSide,
  withLoserPoints,
  withoutAllSetPoints,
  withoutSetPoints,
  withPointsStep,
  withResult,
  withSetWinner,
} from "../../common/score-draft";

type Player = { id: string; name: string; color: string };

/**
 * Every input is a large button: the on-screen keyboard covers most of a phone
 * and must not open. The game winner is always on the left.
 */
export const StepAddScore: React.FC<{
  winner: string;
  loser: string;
  draft: ScoreDraft;
  onChange: (draft: ScoreDraft) => void;
  /** False on the edit score page, where a score must have the sets won. */
  optional?: boolean;
}> = ({ winner, loser, draft, onChange, optional = true }) => {
  const context = useEventDbContext();
  const players: Record<DraftSlot, Player> = {
    1: { id: winner, name: context.playerName(winner), color: stringToColor(winner) },
    2: { id: loser, name: context.playerName(loser), color: stringToColor(loser) },
  };

  return (
    <div className="max-w-xl md:max-w-4xl mx-auto space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 md:items-start">
      <div className="space-y-3 md:sticky md:top-0">
        <Scoreboard players={players} draft={draft} />
        <ResultPicker players={players} draft={draft} onChange={onChange} optional={optional} />
      </div>
      {hasResult(draft) ? (
        <SetsEditor players={players} draft={draft} onChange={onChange} />
      ) : (
        <p className="rounded-xl border-2 border-dashed border-secondary-background px-4 py-6 text-center text-sm text-primary-text">
          Select the sets won to add the points and the bad side of each set.
        </p>
      )}
    </div>
  );
};

const Scoreboard: React.FC<{ players: Record<DraftSlot, Player>; draft: ScoreDraft }> = ({ players, draft }) => (
  <div className="bg-secondary-background text-secondary-text rounded-xl p-3 flex items-center gap-2">
    <ScoreboardPlayer player={players[1]} isGameWinner />
    <div className="shrink-0 text-center px-1">
      {hasResult(draft) ? (
        <div className="text-4xl xs:text-5xl font-black tabular-nums leading-none">
          {draft.winnerSets}
          <span className="mx-1.5 opacity-60">–</span>
          {draft.loserSets}
        </div>
      ) : (
        <div className="text-3xl font-black leading-none opacity-50">–</div>
      )}
      <div className="text-xs mt-1 opacity-80">{hasResult(draft) ? "Sets" : "No score"}</div>
    </div>
    <ScoreboardPlayer player={players[2]} />
  </div>
);

const ScoreboardPlayer: React.FC<{ player: Player; isGameWinner?: boolean }> = ({ player, isGameWinner }) => (
  <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
    <div className="relative">
      <ProfilePicture playerId={player.id} size={52} border={3} />
      {isGameWinner && (
        <span className="absolute -bottom-1 -right-2 text-xl leading-none" title="Game winner">
          🏆
        </span>
      )}
    </div>
    <span className="max-w-full truncate text-sm font-semibold">{player.name}</span>
  </div>
);

const SectionTitle: React.FC<{ title: string; hint?: string; action?: React.ReactNode }> = ({
  title,
  hint,
  action,
}) => (
  <div className="flex items-baseline justify-between gap-2 mb-2">
    <h2 className="text-lg font-semibold">
      {title}
      {hint && <span className="ml-2 text-xs font-normal opacity-75">{hint}</span>}
    </h2>
    {action}
  </div>
);

const TextButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} className="shrink-0 text-sm underline underline-offset-2 opacity-90 active:opacity-60 py-1">
    {children}
  </button>
);

// Press feedback uses active:, not hover:. On a touch screen a hover style
// stays on the last button pressed, and looks like a selection.
const CHIP = "h-11 rounded-lg font-semibold tabular-nums transition active:scale-95";
const CHIP_SELECTED = "bg-tertiary-background text-tertiary-text ring-2 ring-tertiary-text";
const CHIP_UNSELECTED = "bg-primary-background text-primary-text";

const ResultPicker: React.FC<{
  players: Record<DraftSlot, Player>;
  draft: ScoreDraft;
  onChange: (draft: ScoreDraft) => void;
  optional: boolean;
}> = ({ players, draft, onChange, optional }) => {
  const isPreset = RESULT_PRESETS.some(([w, l]) => w === draft.winnerSets && l === draft.loserSets);
  const [otherOpen, setOtherOpen] = useState(hasResult(draft) && isPreset === false);
  const showOther = otherOpen || (hasResult(draft) && isPreset === false);
  const resultIssue = scoreDraftIssues(draft).find((issue) => issue.kind === "result");

  function selectPreset(winnerSets: number, loserSets: number) {
    setOtherOpen(false);
    const isSelected = showOther === false && draft.winnerSets === winnerSets && draft.loserSets === loserSets;
    onChange(isSelected ? withResult(draft, 0, 0) : withResult(draft, winnerSets, loserSets));
  }

  return (
    <section className="bg-secondary-background text-secondary-text rounded-xl p-3">
      <SectionTitle
        title="Sets won"
        hint={optional ? "Optional" : undefined}
        action={
          hasResult(draft) && (
            <TextButton
              onClick={() => {
                setOtherOpen(false);
                onChange(withResult(draft, 0, 0));
              }}
            >
              Clear
            </TextButton>
          )
        }
      />
      <p className="text-xs opacity-80 mb-2 truncate">
        {players[1].name} – {players[2].name}
      </p>
      {/* The custom screens turn off max-md, and xs comes after md in the CSS,
          so only a plain media query keeps 4 columns in the narrow md column. */}
      <div className="grid grid-cols-4 [@media(min-width:470px)_and_(max-width:767.98px)]:grid-cols-7 lg:grid-cols-7 gap-2">
        {RESULT_PRESETS.map(([winnerSets, loserSets]) => {
          const selected = showOther === false && draft.winnerSets === winnerSets && draft.loserSets === loserSets;
          return (
            <button
              key={`${winnerSets}-${loserSets}`}
              onClick={() => selectPreset(winnerSets, loserSets)}
              aria-pressed={selected}
              className={classNames(CHIP, "text-lg", selected ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {winnerSets}–{loserSets}
            </button>
          );
        })}
        <button
          onClick={() => setOtherOpen(true)}
          aria-pressed={showOther}
          className={classNames(CHIP, "text-sm", showOther ? CHIP_SELECTED : CHIP_UNSELECTED)}
        >
          Other
        </button>
      </div>
      {showOther && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <SetsStepper
            player={players[1]}
            value={draft.winnerSets}
            onChange={(sets) => onChange(withResult(draft, sets, draft.loserSets))}
          />
          <SetsStepper
            player={players[2]}
            value={draft.loserSets}
            onChange={(sets) => onChange(withResult(draft, draft.winnerSets, sets))}
          />
        </div>
      )}
      {resultIssue && (
        <p className="mt-3 rounded-lg px-3 py-2 text-sm bg-red-100 text-red-800">
          {describeScoreDraftIssue(resultIssue, players[1].name, players[2].name)}
        </p>
      )}
    </section>
  );
};

const STEP_BUTTON =
  "w-11 h-11 shrink-0 rounded-full text-2xl font-bold leading-none transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed";

const SetsStepper: React.FC<{ player: Player; value: number; onChange: (sets: number) => void }> = ({
  player,
  value,
  onChange,
}) => (
  <div className="rounded-lg bg-primary-background text-primary-text px-2 py-2">
    <div className="text-xs text-center truncate mb-1">{player.name}</div>
    <div className="flex items-center justify-between gap-1">
      <button
        onClick={() => onChange(value - 1)}
        disabled={value === 0}
        aria-label={`1 set less for ${player.name}`}
        className={classNames(STEP_BUTTON, "bg-secondary-background text-secondary-text")}
      >
        −
      </button>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={value === MAX_SETS_PER_PLAYER}
        aria-label={`1 set more for ${player.name}`}
        className={classNames(STEP_BUTTON, "bg-secondary-background text-secondary-text")}
      >
        +
      </button>
    </div>
  </div>
);

const REGULAR_LOSER_POINTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const DEUCE_LOSER_POINTS = [10, 11, 12, 13, 14];

function firstSetToEdit(draft: ScoreDraft): number {
  const index = draft.sets.findIndex((set) => hasSetPoints(set) === false);
  return index === -1 ? 0 : index;
}

const SetsEditor: React.FC<{
  players: Record<DraftSlot, Player>;
  draft: ScoreDraft;
  onChange: (draft: ScoreDraft) => void;
}> = ({ players, draft, onChange }) => {
  const [selectedSet, setSelectedSet] = useState(() => firstSetToEdit(draft));
  const activeSet = Math.min(selectedSet, draft.sets.length - 1);
  const winners = setWinners(draft);
  const issues = scoreDraftIssues(draft).filter((issue) => issue.kind !== "result");
  const missingPoints = issues.find((issue) => issue.kind === "missing-points");

  const stripRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Not scrollIntoView: it also scrolls the page, and moves the points away from the finger.
  useEffect(() => {
    const strip = stripRef.current;
    const tab = tabRefs.current[activeSet];
    if (!strip || !tab) return;
    strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2;
  }, [activeSet]);

  function selectLoserPoints(setIndex: number, points: number) {
    const next = withLoserPoints(draft, setIndex, points);
    onChange(next);
    const nextSet = next.sets.findIndex((set, index) => index > setIndex && hasSetPoints(set) === false);
    if (nextSet !== -1) setSelectedSet(nextSet);
  }

  return (
    <section className="bg-secondary-background text-secondary-text rounded-xl p-3">
      <SectionTitle title="Sets" hint="Optional: points and bad side" />
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Sets"
        className="flex gap-2 overflow-x-auto scroll-smooth p-1 -m-1"
      >
        {draft.sets.map((set, index) => (
          <SetTab
            key={index}
            tabRef={(element) => {
              tabRefs.current[index] = element;
            }}
            index={index}
            set={set}
            winner={winners[index]}
            players={players}
            selected={index === activeSet}
            missingPoints={missingPoints?.kind === "missing-points" && missingPoints.setIndexes.includes(index)}
            onSelect={() => setSelectedSet(index)}
          />
        ))}
      </div>
      <SetDetails
        key={activeSet}
        setIndex={activeSet}
        set={draft.sets[activeSet]}
        winner={winners[activeSet]}
        players={players}
        noSidesYet={draft.sets.every((set) => set.badSide === null)}
        onBadSide={(badSide) => onChange(withBadSide(draft, activeSet, badSide))}
        onWinner={(slot) => onChange(withSetWinner(draft, activeSet, slot))}
        onLoserPoints={(points) => selectLoserPoints(activeSet, points)}
        onStep={(slot, delta) => onChange(withPointsStep(draft, activeSet, slot, delta))}
        onClear={() => onChange(withoutSetPoints(draft, activeSet))}
      />
      {issues.length > 0 && (
        <div className="mt-3 space-y-2">
          {issues.map((issue) => (
            <div
              key={issue.kind + ("setIndex" in issue ? issue.setIndex : "") + ("slot" in issue ? issue.slot : "")}
              className={classNames(
                "rounded-lg px-3 py-2 text-sm",
                issue.kind === "missing-points" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800",
              )}
            >
              <p>{describeScoreDraftIssue(issue, players[1].name, players[2].name)}</p>
              {issue.kind === "missing-points" && (
                <button onClick={() => onChange(withoutAllSetPoints(draft))} className="mt-1 underline font-semibold">
                  Clear the points of all sets
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const SetTab: React.FC<{
  tabRef: React.Ref<HTMLButtonElement>;
  index: number;
  set: DraftSet;
  winner: DraftSlot | null;
  players: Record<DraftSlot, Player>;
  selected: boolean;
  missingPoints: boolean;
  onSelect: () => void;
}> = ({ tabRef, index, set, winner, players, selected, missingPoints, onSelect }) => {
  const badSideName =
    set.badSide === 1
      ? players[1].name
      : set.badSide === 2
        ? players[2].name
        : set.badSide === "neutral"
          ? "Equal"
          : null;
  return (
    <button
      ref={tabRef}
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={classNames(
        "flex-1 min-w-[4.5rem] rounded-lg px-1.5 pt-1.5 pb-1 flex flex-col items-center transition",
        selected ? "bg-tertiary-background text-tertiary-text ring-2 ring-tertiary-text" : CHIP_UNSELECTED,
        missingPoints && selected === false && "ring-2 ring-amber-400",
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-75">Set {index + 1}</span>
      {hasSetPoints(set) ? (
        <span className="text-base font-bold tabular-nums leading-tight">
          {set.player1}–{set.player2}
        </span>
      ) : (
        <span className="text-xs font-semibold leading-6 max-w-full truncate">
          {winner === null ? "–" : players[winner].name}
        </span>
      )}
      <span
        className="h-1 w-full rounded-full mt-0.5"
        style={{ backgroundColor: winner === null ? "transparent" : players[winner].color }}
      />
      <span className="text-[11px] h-5 leading-5 max-w-full truncate">{badSideName && `😵 ${badSideName}`}</span>
    </button>
  );
};

const SetDetails: React.FC<{
  setIndex: number;
  set: DraftSet;
  winner: DraftSlot | null;
  players: Record<DraftSlot, Player>;
  noSidesYet: boolean;
  onBadSide: (badSide: BadSide) => void;
  onWinner: (slot: DraftSlot) => void;
  onLoserPoints: (points: number) => void;
  onStep: (slot: DraftSlot, delta: number) => void;
  onClear: () => void;
}> = ({ setIndex, set, winner, players, noSidesYet, onBadSide, onWinner, onLoserPoints, onStep, onClear }) => {
  const setNumber = setIndex + 1;
  const loser: DraftSlot | null = winner === null ? null : winner === 1 ? 2 : 1;
  const loserPoints =
    loser === null || hasSetPoints(set) === false ? undefined : set[loser === 1 ? "player1" : "player2"];
  const hasData = set.player1 !== undefined || set.player2 !== undefined || set.pickedWinner !== undefined;

  return (
    <div role="tabpanel" aria-label={`Set ${setNumber}`} className="mt-4 space-y-4">
      <div>
        <FieldLabel>😵 Bad side in set {setNumber}</FieldLabel>
        <BadSideControl setNumber={setNumber} badSide={set.badSide} players={players} onSelect={onBadSide} />
        {noSidesYet && (
          <p className="mt-1.5 text-xs opacity-80">
            The first choice fills all sets. The players change sides after each set.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel>🏆 Winner of set {setNumber}</FieldLabel>
          {hasData && <TextButton onClick={onClear}>Clear points</TextButton>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([1, 2] as const).map((slot) => (
            <SetPlayerTile
              key={slot}
              player={players[slot]}
              setNumber={setNumber}
              points={hasSetPoints(set) ? set[slot === 1 ? "player1" : "player2"] : undefined}
              isSetWinner={winner === slot}
              onPick={() => onWinner(slot)}
              onStep={(delta) => onStep(slot, delta)}
            />
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>
          {loser === null ? `Select the winner of set ${setNumber} first` : `Points of ${players[loser].name}`}
        </FieldLabel>
        <div className="grid grid-cols-5 gap-2">
          {REGULAR_LOSER_POINTS.map((points) => (
            <PointsChip
              key={points}
              points={points}
              selected={loserPoints === points}
              disabled={loser === null}
              onSelect={() => onLoserPoints(points)}
            />
          ))}
        </div>
        <div className="text-xs opacity-80 mt-2 mb-1">After 10–10</div>
        <div className="grid grid-cols-5 gap-2">
          {DEUCE_LOSER_POINTS.map((points) => (
            <PointsChip
              key={points}
              points={points}
              selected={loserPoints === points}
              disabled={loser === null}
              onSelect={() => onLoserPoints(points)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm font-semibold mb-1.5">{children}</div>
);

const PointsChip: React.FC<{ points: number; selected: boolean; disabled: boolean; onSelect: () => void }> = ({
  points,
  selected,
  disabled,
  onSelect,
}) => (
  <button
    onClick={onSelect}
    disabled={disabled}
    aria-pressed={selected}
    className={classNames(
      CHIP,
      "text-lg",
      selected ? CHIP_SELECTED : CHIP_UNSELECTED,
      disabled && "opacity-40 cursor-not-allowed active:scale-100",
    )}
  >
    {points}
  </button>
);

const SetPlayerTile: React.FC<{
  player: Player;
  setNumber: number;
  points: number | undefined;
  isSetWinner: boolean;
  onPick: () => void;
  onStep: (delta: number) => void;
}> = ({ player, setNumber, points, isSetWinner, onPick, onStep }) => (
  <div
    className={classNames(
      "rounded-xl overflow-hidden flex flex-col transition",
      isSetWinner ? "shadow-md" : "bg-primary-background text-primary-text",
    )}
    style={isSetWinner ? fill(player.color) : undefined}
  >
    <button
      onClick={onPick}
      aria-pressed={isSetWinner}
      aria-label={`${player.name} won set ${setNumber}`}
      className="flex-1 min-h-[6rem] px-2 pt-2 pb-1.5 flex flex-col items-center justify-between gap-1"
    >
      <span className="flex items-center gap-1.5 max-w-full">
        <span className="shrink-0">
          <ProfilePicture playerId={player.id} size={28} border={2} />
        </span>
        <span className="truncate text-sm font-semibold">{player.name}</span>
      </span>
      <span
        className={classNames("text-4xl font-black tabular-nums leading-none", points === undefined && "opacity-30")}
      >
        {points ?? "–"}
      </span>
      <span className="text-xs leading-4 h-4">{isSetWinner ? "🏆 Set winner" : ""}</span>
    </button>
    {points !== undefined && (
      <div className="grid grid-cols-2 bg-black/10">
        <button
          onClick={() => onStep(-1)}
          disabled={points === 0}
          aria-label={`1 point less for ${player.name}`}
          className="h-10 text-xl font-bold active:bg-black/20 disabled:opacity-30"
        >
          −
        </button>
        <button
          onClick={() => onStep(1)}
          aria-label={`1 point more for ${player.name}`}
          className="h-10 text-xl font-bold active:bg-black/20"
        >
          +
        </button>
      </div>
    )}
  </div>
);

const BadSideControl: React.FC<{
  setNumber: number;
  badSide: BadSide;
  players: Record<DraftSlot, Player>;
  onSelect: (badSide: BadSide) => void;
}> = ({ setNumber, badSide, players, onSelect }) => {
  const toggle = (option: BadSide) => onSelect(badSide === option ? null : option);
  const option = (value: BadSide) =>
    classNames(
      "h-11 min-w-0 rounded-lg px-2 text-sm font-semibold truncate transition",
      badSide === value ? "shadow" : "active:bg-black/20",
    );
  return (
    <div
      role="group"
      aria-label={`Bad side in set ${setNumber}`}
      className="grid grid-cols-[1fr_auto_1fr] gap-1 p-1 rounded-xl bg-primary-background text-primary-text"
    >
      <button
        onClick={() => toggle(1)}
        aria-pressed={badSide === 1}
        className={option(1)}
        style={badSide === 1 ? fill(players[1].color) : undefined}
      >
        {players[1].name}
      </button>
      <button
        onClick={() => toggle("neutral")}
        aria-pressed={badSide === "neutral"}
        className={classNames(option("neutral"), "px-3", badSide === "neutral" && "bg-gray-700 text-white")}
      >
        Equal
      </button>
      <button
        onClick={() => toggle(2)}
        aria-pressed={badSide === 2}
        className={option(2)}
        style={badSide === 2 ? fill(players[2].color) : undefined}
      >
        {players[2].name}
      </button>
    </div>
  );
};
