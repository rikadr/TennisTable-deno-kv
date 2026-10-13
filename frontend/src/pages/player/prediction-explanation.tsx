import { PointerEvent, ReactNode, RefObject, useLayoutEffect, useRef, useState } from "react";
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
      <div className="md:col-span-2">
        <Step number={1} title="Relative skill of all players">
          <StrengthLine details={details} playerId={playerId} opponentId={opponentId} name={name} />
        </Step>
      </div>
      <Step number={2} title="Skill gap → win chance">
        <GapCurve details={details} />
      </Step>
      <Step number={3} title="Where the evidence comes from">
        <Evidence details={details} playerId={playerId} opponentId={opponentId} name={name} />
      </Step>
    </div>
  );
};

const Step = ({ number, title, children }: { number: number; title: string; children: ReactNode }) => (
  <section className="rounded-lg border border-primary-text/15 p-3 space-y-2 min-w-0">
    <h4 className="text-sm font-semibold flex items-center gap-2">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-text/15 text-xs">
        {number}
      </span>
      {title}
    </h4>
    {children}
  </section>
);

const DIVIDER_WIDTH_PX = 4;

/** A bar split between the 2 player colours. A white pill marks the split, because 2 player colours can look alike */
const SplitBar = ({ share, playerId, opponentId }: { share: number; playerId: string; opponentId: string }) => {
  const split = `calc(${DIVIDER_WIDTH_PX / 2}px + ${share} * (100% - ${DIVIDER_WIDTH_PX}px))`;
  return (
    <div className="relative">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        <div style={{ width: split, backgroundColor: stringToColor(playerId) }} />
        <div className="flex-1" style={{ backgroundColor: stringToColor(opponentId) }} />
      </div>
      <div
        className="pointer-events-none absolute -top-0.5 -bottom-0.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
        style={{ left: split, width: DIVIDER_WIDTH_PX }}
      />
    </div>
  );
};

/** The width of the element, so a chart can draw at its real size with readable text */
function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

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
  const [ref, measured] = useWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number>();
  const W = Math.max(measured, 280);
  const H = 104;
  const pad = 16;
  const all = details.strengths.map((s) => ({ playerId: s.playerId, value: points(s.strength) }));
  const ends = [
    ...all.map((s) => s.value),
    points(details.p1.strength - details.p1.sd),
    points(details.p1.strength + details.p1.sd),
    points(details.p2.strength - details.p2.sd),
    points(details.p2.strength + details.p2.sd),
  ];
  const limit = Math.ceil(Math.max(...ends.map(Math.abs)) / 200) * 200;
  const x = (value: number) => pad + ((value + limit) / (2 * limit)) * (W - 2 * pad);
  const axisY = 66;
  const players = [
    { id: playerId, side: details.p1, y: 32 },
    { id: opponentId, side: details.p2, y: 46 },
  ];
  const tickCount = W < 500 ? 4 : 8;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => -limit + (2 * limit * i) / tickCount);

  // The nearest dot to the pointer, so a quick move along the line shows each name at once
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const pointerX = event.clientX - left;
    let nearest = 0;
    all.forEach((s, i) => {
      if (Math.abs(x(s.value) - pointerX) < Math.abs(x(all[nearest].value) - pointerX)) nearest = i;
    });
    setHovered(Math.abs(x(all[nearest].value) - pointerX) <= 12 ? nearest : undefined);
  };
  const tip = hovered === undefined ? undefined : all[hovered];
  const tipText = tip && `${name(tip.playerId)} ${signed(tip.value)}`;
  const tipWidth = tipText ? tipText.length * 6.2 + 12 : 0;
  const tipX = tip ? Math.min(Math.max(x(tip.value) - tipWidth / 2, 2), W - tipWidth - 2) : 0;

  return (
    <div ref={ref} className="w-full">
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="Relative skill of all players"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHovered(undefined)}
        style={{ touchAction: "pan-y" }}
      >
        <line x1={pad} x2={W - pad} y1={axisY + 6} y2={axisY + 6} stroke="currentColor" opacity={0.3} />
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={axisY + 20} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.6}>
            {Math.round(t) === 0 ? "0" : signed(t)}
          </text>
        ))}
        {all.map((s, i) => (
          <circle
            key={s.playerId}
            cx={x(s.value)}
            cy={axisY}
            r={i === hovered ? 4 : 2.6}
            fill="currentColor"
            opacity={i === hovered ? 0.9 : 0.25}
          />
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
                strokeWidth={2.5}
              />
              <line x1={center} x2={center} y1={y} y2={axisY} stroke={color} strokeWidth={1} opacity={0.6} />
              <circle cx={center} cy={y} r={5} fill={color} stroke="white" strokeWidth={1} />
            </g>
          );
        })}
        <text x={pad} y={13} fontSize={12} fill="currentColor">
          <tspan fill={stringToColor(playerId)}>●</tspan> {name(playerId)} {signed(points(details.p1.strength))} ±{" "}
          {fmtNum(Math.round(points(details.p1.sd)))}
        </text>
        <text x={W - pad} y={13} fontSize={12} fill="currentColor" textAnchor="end">
          <tspan fill={stringToColor(opponentId)}>●</tspan> {name(opponentId)} {signed(points(details.p2.strength))} ±{" "}
          {fmtNum(Math.round(points(details.p2.sd)))}
        </text>
        {tip && (
          <g pointerEvents="none">
            <rect x={tipX} y={axisY - 26} width={tipWidth} height={18} rx={4} className="fill-primary-text" />
            <text
              x={tipX + tipWidth / 2}
              y={axisY - 13}
              fontSize={11}
              textAnchor="middle"
              className="fill-primary-background"
            >
              {tipText}
            </text>
          </g>
        )}
      </svg>
      <p className="text-xs">
        Skill gap: <span className="font-semibold">{signed(points(details.gap))}</span> ±{" "}
        {fmtNum(Math.round(points(details.gapSd)))}. 0 is an average player.
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
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Win chance from the skill gap">
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
          Skill gap
        </text>
      </svg>
      <p className="text-xs">
        Win chance <span className="font-semibold">{percent(details.fraction)}</span>. The uncertainty of the skill gap
        moves it from {percent(details.fractionWithoutUncertainty)} toward 50%.
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span>Confidence</span>
        <div className="h-2 flex-1 rounded bg-primary-text/15">
          <div className="h-full rounded bg-primary-text" style={{ width: `${details.confidence * 100}%` }} />
        </div>
        <span className="font-semibold tabular-nums">{percent(details.confidence, 0)}</span>
      </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {rows.map(({ label, stats }) => {
            const total = stats.won + stats.lost;
            const weightedTotal = stats.weightedWins + stats.weightedLost;
            if (total === 0) {
              return (
                <div key={label} className="min-w-0 opacity-40 text-xs">
                  {label}: no scores
                </div>
              );
            }
            const share = stats.won / total;
            const weightedShare = stats.weightedWins / weightedTotal;
            return (
              <div key={label} className="min-w-0 space-y-1.5">
                <div className="flex items-baseline gap-2 whitespace-nowrap tabular-nums">
                  <span className="text-xs opacity-70 w-12 sm:w-auto">{label}</span>
                  <span className="text-lg font-semibold">
                    {fmtNum(stats.won)} : {fmtNum(stats.lost)}
                  </span>
                  <span className="text-xs opacity-80">({percent(share, 0)})</span>
                </div>
                <SplitBar share={share} playerId={playerId} opponentId={opponentId} />
                <div className="flex items-baseline gap-2 whitespace-nowrap text-xs opacity-70 tabular-nums">
                  <span>Age-weighted</span>
                  <span className="font-semibold">
                    {fmtNum(stats.weightedWins, { digits: 1 })} : {fmtNum(stats.weightedLost, { digits: 1 })}
                  </span>
                  <span>({percent(weightedShare, 0)})</span>
                </div>
                <div className="opacity-70">
                  <SplitBar share={weightedShare} playerId={playerId} opponentId={opponentId} />
                </div>
                {label !== "Games" && (
                  <div className="text-xs opacity-70">
                    Should equal a game win % of{" "}
                    <span className="font-semibold">{percent(stats.fraction.fraction, 0)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs opacity-80">They never played each other.</p>
      )}
    </section>
  );
};
