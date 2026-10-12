import { ReactNode } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { stringToColor } from "../../common/string-to-color";
import { PredictionDetails, RATING_POINTS_PER_STRENGTH } from "../../client/client-db/player-strengths";

type Props = {
  playerId: string;
  opponentId: string;
};

const points = (strength: number) => strength * RATING_POINTS_PER_STRENGTH;
const signed = (value: number) => (value >= 0 ? "+" : "−") + fmtNum(Math.abs(Math.round(value)));
const percent = (fraction: number, digits = 1) => fmtNum(fraction * 100, { digits }) + "%";

/** The steps from all games to the prediction for 1 pair, for the expanded card of the predictions list */
export const PredictionExplanation = ({ playerId, opponentId }: Props) => {
  const context = useEventDbContext();
  const details = context.predictions.getPredictionDetails(playerId, opponentId);
  const name = (id: string) => context.playerName(id);

  if (!details) {
    return (
      <p className="text-sm opacity-80">
        No prediction. {name(playerId)} and {name(opponentId)} have no chain of opponents between them.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <HeadToHead playerId={playerId} opponentId={opponentId} name={name} />
      </div>
      <Step
        number={1}
        title="1 strength for each player"
        text="The app fits 1 strength to each player from all games. Each strength starts at 0, an average player. The first games move it far."
      >
        <StrengthLine details={details} playerId={playerId} opponentId={opponentId} name={name} />
      </Step>
      <Step
        number={2}
        title="From strength gap to win chance"
        text="The gap between the 2 strengths gives the win chance. The uncertainty of the gap moves the chance toward 50%."
      >
        <GapCurve details={details} />
      </Step>
      <Step
        number={3}
        title="Where the evidence comes from"
        text="Games against other players also count. They fix the strengths of the common opponents. Each strength starts at 0, an average player, before the games move it."
      >
        <Evidence details={details} playerId={playerId} opponentId={opponentId} name={name} />
      </Step>
      <Step
        number={4}
        title="Confidence"
        text="The evidence for the gap, counted as games between 2 even players. 10 such games give 50% confidence."
      >
        <Confidence details={details} />
      </Step>
    </div>
  );
};

const Step = ({
  number,
  title,
  text,
  children,
}: {
  number: number;
  title: string;
  text: string;
  children: ReactNode;
}) => (
  <section className="rounded-lg border border-primary-text/15 p-3 space-y-2 min-w-0">
    <h4 className="text-sm font-semibold flex items-center gap-2">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-text/15 text-xs">
        {number}
      </span>
      {title}
    </h4>
    {children}
    <p className="text-xs opacity-70">{text}</p>
  </section>
);

const StrengthLine = ({
  details,
  playerId,
  opponentId,
  name,
}: {
  details: PredictionDetails;
  playerId: string;
  opponentId: string;
  name: (id: string) => string;
}) => {
  const W = 320;
  const H = 86;
  const all = details.strengths.map((s) => points(s.strength));
  const ends = [
    ...all,
    points(details.p1.strength - details.p1.sd),
    points(details.p1.strength + details.p1.sd),
    points(details.p2.strength - details.p2.sd),
    points(details.p2.strength + details.p2.sd),
  ];
  const limit = Math.ceil(Math.max(...ends.map(Math.abs)) / 200) * 200;
  const x = (value: number) => 22 + ((value + limit) / (2 * limit)) * (W - 44);
  const axisY = 58;
  const players = [
    { id: playerId, side: details.p1, y: 36 },
    { id: opponentId, side: details.p2, y: 46 },
  ];
  const ticks = [-limit, -limit / 2, 0, limit / 2, limit];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Strengths of all players">
        {all.map((value, i) => (
          <circle key={i} cx={x(value)} cy={axisY} r={2.2} fill="currentColor" opacity={0.25} />
        ))}
        <line x1={22} x2={W - 22} y1={axisY + 6} y2={axisY + 6} stroke="currentColor" opacity={0.3} />
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={axisY + 20} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.6}>
            {t === 0 ? "0" : signed(t)}
          </text>
        ))}
        {players.map(({ id, side, y }) => {
          const color = stringToColor(id);
          const center = x(points(side.strength));
          return (
            <g key={id}>
              <line
                x1={x(points(side.strength - side.sd))}
                x2={x(points(side.strength + side.sd))}
                y1={y}
                y2={y}
                stroke={color}
                strokeWidth={2}
              />
              <line x1={center} x2={center} y1={y} y2={axisY} stroke={color} strokeWidth={1} opacity={0.6} />
              <circle cx={center} cy={y} r={4} fill={color} />
            </g>
          );
        })}
        <text x={12} y={12} fontSize={10} fill="currentColor">
          <tspan fill={stringToColor(playerId)} fontWeight={700}>
            ●
          </tspan>{" "}
          {name(playerId)} {signed(points(details.p1.strength))} ± {fmtNum(Math.round(points(details.p1.sd)))}
        </text>
        <text x={W - 12} y={12} fontSize={10} fill="currentColor" textAnchor="end">
          <tspan fill={stringToColor(opponentId)} fontWeight={700}>
            ●
          </tspan>{" "}
          {name(opponentId)} {signed(points(details.p2.strength))} ± {fmtNum(Math.round(points(details.p2.sd)))}
        </text>
      </svg>
      <p className="text-xs">
        Gap: <span className="font-semibold">{signed(points(details.gap))}</span> ±{" "}
        {fmtNum(Math.round(points(details.gapSd)))} rating points
      </p>
    </div>
  );
};

const GapCurve = ({ details }: { details: PredictionDetails }) => {
  const W = 320;
  const H = 110;
  const gap = points(details.gap);
  const sd = points(details.gapSd);
  const limit = Math.max(600, Math.ceil((Math.abs(gap) + sd + 100) / 200) * 200);
  const x = (value: number) => 28 + ((value + limit) / (2 * limit)) * (W - 36);
  const y = (fraction: number) => 8 + (1 - fraction) * (H - 30);
  const shrink = Math.sqrt(1 + (Math.PI * details.gapSd * details.gapSd) / 8);
  const curve = (scale: number) =>
    Array.from({ length: 81 }, (_, k) => {
      const value = -limit + (2 * limit * k) / 80;
      const fraction = 1 / (1 + Math.exp(-value / RATING_POINTS_PER_STRENGTH / scale));
      return `${k === 0 ? "M" : "L"}${x(value).toFixed(1)} ${y(fraction).toFixed(1)}`;
    }).join("");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Win chance from the strength gap">
        <rect
          x={x(Math.max(-limit, gap - sd))}
          y={y(1)}
          width={Math.max(0, x(Math.min(limit, gap + sd)) - x(Math.max(-limit, gap - sd)))}
          height={y(0) - y(1)}
          fill="currentColor"
          opacity={0.08}
        />
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={28} x2={W - 8} y1={y(f)} y2={y(f)} stroke="currentColor" opacity={0.15} />
            <text x={24} y={y(f) + 3} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.6}>
              {f * 100}%
            </text>
          </g>
        ))}
        <path d={curve(1)} fill="none" stroke="currentColor" strokeWidth={1.2} opacity={0.35} strokeDasharray="3 3" />
        <path d={curve(shrink)} fill="none" stroke="currentColor" strokeWidth={2} />
        <line x1={x(gap)} x2={x(gap)} y1={y(1)} y2={y(0)} stroke="currentColor" opacity={0.5} />
        <circle cx={x(gap)} cy={y(details.fraction)} r={4} fill="currentColor" />
        <text x={(28 + W - 8) / 2} y={H - 4} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.6}>
          Strength gap, rating points
        </text>
      </svg>
      <p className="text-xs">
        Without uncertainty: {percent(details.fractionWithoutUncertainty)}. With the uncertainty:{" "}
        <span className="font-semibold">{percent(details.fraction)}</span>
      </p>
    </div>
  );
};

const Evidence = ({
  details,
  playerId,
  opponentId,
  name,
}: {
  details: PredictionDetails;
  playerId: string;
  opponentId: string;
  name: (id: string) => string;
}) => {
  const groupOf = (pair: { p1: string; p2: string }) => {
    const hasPlayer = pair.p1 === playerId || pair.p2 === playerId;
    const hasOpponent = pair.p1 === opponentId || pair.p2 === opponentId;
    return hasPlayer && hasOpponent ? 0 : hasPlayer || hasOpponent ? 1 : 2;
  };
  const totals = [0, 0, 0, details.evidence.prior];
  for (const pair of details.evidence.pairs) totals[groupOf(pair)] += pair.share;
  const groups = [
    { label: "Their games against each other", opacity: 1 },
    { label: `Games of ${name(playerId)} or ${name(opponentId)} against others`, opacity: 0.6 },
    { label: "Games between other players", opacity: 0.32 },
    { label: "Start value: an average player", opacity: 0.12 },
  ];
  const top = details.evidence.pairs.slice(0, 5);
  const largest = Math.max(...top.map((p) => p.share), 1e-9);

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded">
        {totals.map((share, i) => (
          <div
            key={i}
            className="h-full bg-primary-text"
            style={{ width: `${share * 100}%`, opacity: groups[i].opacity }}
          />
        ))}
      </div>
      <ul className="space-y-1 text-xs">
        {groups.map((group, i) => (
          <li key={group.label} className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-primary-text" style={{ opacity: group.opacity }} />
            <span className="truncate">{group.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{percent(totals[i], 0)}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-1">
        <p className="text-xs opacity-70">The pairs with the most evidence</p>
        {top.map((pair) => (
          <div
            key={pair.p1 + pair.p2}
            className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-xs"
          >
            <span className={"truncate " + (groupOf(pair) === 0 ? "font-semibold" : "")}>
              {name(pair.p1)} – {name(pair.p2)}
            </span>
            <div
              className="h-2 rounded-r bg-primary-text"
              style={{ width: `${(pair.share / largest) * 100}%`, opacity: groups[groupOf(pair)].opacity }}
            />
            <span className="text-right tabular-nums">{percent(pair.share, 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Confidence = ({ details }: { details: PredictionDetails }) => (
  <div className="space-y-2">
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold">{percent(details.confidence, 0)}</span>
      <span className="text-xs opacity-80">
        from evidence equal to {fmtNum(details.evidenceGames, { digits: 1 })} even games
      </span>
    </div>
    <div className="h-2 w-full rounded bg-primary-text/15">
      <div className="h-full rounded bg-primary-text" style={{ width: `${details.confidence * 100}%` }} />
    </div>
  </div>
);

const HeadToHead = ({
  playerId,
  opponentId,
  name,
}: {
  playerId: string;
  opponentId: string;
  name: (id: string) => string;
}) => {
  const context = useEventDbContext();
  const rows = [
    { label: "Games", stats: context.predictions.getDirectGameStats(playerId, opponentId) },
    { label: "Sets", stats: context.predictions.getDirectSetStats(playerId, opponentId) },
    { label: "Points", stats: context.predictions.getDirectPointStats(playerId, opponentId) },
  ];
  const hasGames = rows[0].stats.won + rows[0].stats.lost > 0;

  return (
    <section className="rounded-lg border border-primary-text/15 p-3 space-y-3">
      <h4 className="text-sm font-semibold">
        {name(playerId)} against {name(opponentId)}
      </h4>
      {hasGames ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {rows.map(({ label, stats }) => {
            const total = stats.won + stats.lost;
            const share = total === 0 ? 0 : stats.won / total;
            return (
              <div key={label} className={"min-w-0 space-y-1" + (total === 0 ? " opacity-40" : "")}>
                <div className="text-xs opacity-70">{label}</div>
                <div className="text-base sm:text-xl font-semibold tabular-nums whitespace-nowrap">
                  {fmtNum(stats.won)} : {fmtNum(stats.lost)}
                </div>
                <div className="flex h-1.5 w-full overflow-hidden rounded bg-primary-text/15">
                  <div className="h-full" style={{ width: `${share * 100}%`, background: stringToColor(playerId) }} />
                  <div
                    className="h-full"
                    style={{ width: `${(1 - share) * 100}%`, background: stringToColor(opponentId) }}
                  />
                </div>
                <div className="text-xs tabular-nums">{total === 0 ? "No scores" : `${percent(share, 0)} won`}</div>
                {total > 0 && (
                  <div className="text-xs opacity-60 tabular-nums">
                    Age-weighted {fmtNum(stats.weightedWins, { digits: 1 })} :{" "}
                    {fmtNum(stats.weightedLost, { digits: 1 })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs opacity-80">They never played each other. The prediction comes from other games only.</p>
      )}
      <p className="text-xs opacity-70">
        The fit counts a game result most, then the sets, then the points. A game counts half as much after 120 days.
      </p>
    </section>
  );
};
