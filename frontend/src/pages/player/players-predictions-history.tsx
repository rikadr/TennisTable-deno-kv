import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { useSearchParams } from "react-router-dom";

import { ProfilePicture } from "./profile-picture";

type Props = {
  playerId: string;
};

export const PlayerPredictionsHistory = ({ playerId }: Props) => {
  const context = useEventDbContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTargetId = searchParams.get("compareWith") || "overall";

  const setSelectedTargetId = (targetId: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("compareWith", targetId);
      return newParams;
    });
  };

  const history = useMemo(
    () => context.predictionsHistory.getHistoryForPlayer(playerId),
    [context.predictionsHistory, playerId],
  );

  const leaderboard = context.leaderboard.getLeaderboard();

  const availableOpponents = useMemo(() => {
    const opponentIds = new Set<string>();
    history.forEach((entry) => {
      Object.keys(entry.oponents).forEach((opId) => {
        leaderboard.rankedPlayers.find((r) => r.id === opId) && opponentIds.add(opId);
      });
    });
    return Array.from(opponentIds).sort((a, b) => context.playerName(a).localeCompare(context.playerName(b)));
  }, [history, context, leaderboard.rankedPlayers]);

  const historicalData = useMemo(() => {
    return history.map((entry) => {
      let winChance = 0;
      let confidence = 0;
      let gamesCount = 0;

      if (selectedTargetId === "overall") {
        winChance = entry.overAllWinChance;
        confidence = entry.overAllConfidence;
        gamesCount = entry.gamesPlayed;
      } else {
        const prediction = entry.oponents[selectedTargetId];
        if (prediction) {
          winChance = prediction.winChance;
          confidence = prediction.confidence;
          gamesCount = prediction.gamesPlayedAgainst;
        }
      }

      const date = new Date(entry.time);
      const isToday = date.toDateString() === new Date().toDateString();
      const timeStr = date.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
      const dateStr = date.toLocaleDateString("no-NO", { month: "short", day: "numeric" });

      return {
        time: entry.time,
        name: isToday ? `Today ${timeStr}` : `${dateStr} ${timeStr}`,
        winChance: winChance * 100,
        confidence: confidence * 100,
        gamesCount,
      };
    });
  }, [history, selectedTargetId]);

  if (history.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-primary-background/50 rounded-xl border border-white/10 text-primary-text/50 italic">
        No prediction history available for this player.
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden bg-primary-background rounded-2xl border border-white/10 p-4 md:p-6 backdrop-blur-sm shadow-2xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between mb-4 md:mb-5">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <h2 className="text-lg md:text-xl font-bold text-primary-text flex items-center gap-2 whitespace-nowrap">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
            Win Predictions
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="bg-primary-background border border-primary-text/10 text-primary-text text-xs font-semibold rounded-lg focus:ring-blue-500/50 focus:border-blue-500/50 block w-full md:w-auto min-w-[160px] p-1.5 outline-none transition-all hover:bg-white/5 cursor-pointer shadow-sm"
            >
              <option value="overall">Overall ({context.playerName(playerId)})</option>
              <optgroup label="Specific Opponents">
                {availableOpponents.map((opId) => (
                  <option key={opId} value={opId}>
                    vs {context.playerName(opId)}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] md:text-[11px] font-semibold self-end md:self-auto border-t border-white/5 pt-2 md:pt-0 md:border-t-0">
          {selectedTargetId !== "overall" && (
            <div className="flex items-center gap-2 mr-2">
              <ProfilePicture playerId={playerId} size={26} border={2} />
              <span className="text-primary-text/50 text-[10px]">VS</span>
              <ProfilePicture playerId={selectedTargetId} size={26} border={2} linkToPlayer />
            </div>
          )}
          <div className="flex items-center gap-1.5 text-blue-400/90 whitespace-nowrap">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Win Chance
          </div>
          <div className="flex items-center gap-1.5 text-orange-400/90 whitespace-nowrap">
            <div className="w-2 h-2 rounded-full border border-orange-500 border-dashed" />
            Confidence
          </div>
        </div>
      </div>

      <div className="w-full h-[350px] md:h-[450px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={historicalData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="1 4"
              vertical={false}
              stroke="rgb(var(--color-primary-text))"
              opacity={0.1}
            />
            <XAxis
              dataKey="name"
              stroke="rgb(var(--color-primary-text))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
              opacity={0.6}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              stroke="rgb(var(--color-primary-text))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dx={-5}
              opacity={0.6}
            />
            <Tooltip content={<CustomTooltip selectedTargetId={selectedTargetId} />} />
            <span id="recharts-tooltip-cursor" style={{ visibility: "hidden" }} />
            <ReferenceLine y={50} stroke="rgb(var(--color-primary-text))" strokeDasharray="3 3" opacity={0.2} />
            <Line
              type="monotone"
              dataKey="winChance"
              stroke="rgb(var(--color-primary-text))"
              strokeWidth={3}
              animationDuration={300}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.gamesCount > 0) {
                  return (
                    <circle
                      key={`win-dot-${payload.time}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="rgb(var(--color-primary-background))"
                      stroke="rgb(var(--color-primary-text))"
                      strokeWidth={2}
                    />
                  );
                }
                return <></>;
              }}
            />
            <Line
              type="monotone"
              dataKey="confidence"
              stroke="#fb8c00"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.gamesCount > 0) {
                  return (
                    <circle
                      key={`conf-dot-${payload.time}`}
                      cx={cx}
                      cy={cy}
                      r={2.5}
                      fill="rgb(var(--color-primary-background))"
                      stroke="#fb8c00"
                      strokeWidth={1.5}
                    />
                  );
                }
                return <></>;
              }}
              animationDuration={300}
              opacity={0.6}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const CustomTooltip = ({
  active,
  payload,
  selectedTargetId,
}: TooltipProps<ValueType, NameType> & { selectedTargetId: string }) => {
  const context = useEventDbContext();
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const winChance = payload.find((p) => p.dataKey === "winChance")?.value as number;
    const confidence = payload.find((p) => p.dataKey === "confidence")?.value as number;
    const gamesCount = data.gamesCount as number;

    const targetName = selectedTargetId === "overall" ? "Overall" : `vs ${context.playerName(selectedTargetId)}`;

    return (
      <div className="bg-primary-background/95 border border-primary-text/20 p-2 rounded-lg shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <div className="flex items-center justify-between border-b border-primary-text/10 pb-1 mb-0.5">
            <span className="text-primary-text font-bold text-[11px] truncate pr-2">{targetName}</span>
            <span className="text-primary-text/40 text-[9px] whitespace-nowrap">
              {relativeTimeString(new Date(data.time))}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-primary-text/80 text-[11px]">Win Chance</span>
            </div>
            <span className="text-primary-text font-bold text-[11px]">{winChance.toFixed(1)}%</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full border border-orange-500 border-dashed" />
              <span className="text-primary-text/80 text-[11px]">Confidence</span>
            </div>
            <span className="text-primary-text/80 font-semibold text-[11px]">{confidence.toFixed(1)}%</span>
          </div>

          {gamesCount > 0 && (
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-primary-text/5 mt-0.5">
              <span className="text-primary-text/50 text-[10px]">Games played</span>
              <span className="text-primary-text font-bold text-[10px] bg-white/10 px-1.5 rounded-full">
                {gamesCount}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};
