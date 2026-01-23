import React, { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Season } from "../../client/client-db/seasons/season";
import { stringToColor } from "../../common/string-to-color";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";

export const SeasonPlayerScoreGraph: React.FC<{ playerId: string; season: Season }> = ({
  playerId,
  season,
}) => {
  const { width = 0 } = useWindowSize();

  const graphData = useMemo(() => {
    const { timeline } = season.getTimeline();
    
    // Start with 0 score at the beginning of the season
    const data = [
      {
        time: season.start,
        score: 0,
        improvement: 0,
        opponentId: undefined as string | undefined,
        game: undefined,
      },
    ];

    let currentScore = 0;

    for (const entry of timeline) {
      // Check if this player had an improvement in this entry
      const playerImprovement = entry.improvements.find((imp) => imp.playerId === playerId);

      // If we use the 'scores' map, we can get the score at this point in time.
      const newScore = entry.scores[playerId];

      if (newScore !== undefined && newScore !== currentScore) {
         // This entry affected the player
         currentScore = newScore;
         
         data.push({
           time: entry.time,
           score: newScore,
           improvement: playerImprovement?.improvement || 0,
           opponentId: playerImprovement?.opponentId,
           game: playerImprovement?.game,
         });
      }
    }
    
    // Add "now" point to extend the line to the current time (or season end)
    const endTime = Math.min(Date.now(), season.end);
    if (data[data.length - 1].time < endTime) {
        data.push({
            time: endTime,
            score: currentScore,
            improvement: 0,
            opponentId: undefined,
            game: undefined,
        });
    }

    // If the player hasn't played yet, data will just be the initial 0 and potentially the end 0.
    
    return data;
  }, [season, playerId]);

  if (graphData.length <= 1) {
    // If only one point (start), or just start and end with 0 score, we might still want to show it if they have 0 score?
    // But usually graphs with 1 point don't render well or look weird.
    // If we have start and end (2 points), it will draw a flat line.
    if (graphData.length === 2 && graphData[1].score === 0) {
        return null; 
    }
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height={width > 768 ? 350 : 300}>
      <LineChart data={graphData} margin={{ top: 5, right: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="rgb(var(--color-primary-text))" opacity={0.1} />
        <YAxis
          type="number"
          domain={["auto", "auto"]}
          tickFormatter={(value) => value.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
          stroke="rgb(var(--color-primary-text))"
          opacity={0.5}
        />
        <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} hide />
        <Tooltip
          cursor={{ stroke: "rgb(var(--color-primary-text))", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.5 }}
          content={<CustomTooltip />}
        />
        {["stroke", "main"].map((type) => (
          <Line
            key={type}
            type="stepAfter"
            dataKey="score"
            stroke={type === "main" ? "white" : stringToColor(playerId)}
            dot={false}
            strokeWidth={type === "main" ? 0.5 : 5}
            activeDot={{ r: 6, strokeWidth: 0 }}
            animationDuration={500}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

const CustomTooltip: React.FC = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  const context = useEventDbContext();
  
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isInitial = data.time === 0 || data.game === undefined;

    return (
      <div className="p-3 bg-primary-background/95 backdrop-blur-sm ring-1 ring-primary-text/20 rounded-lg text-primary-text shadow-lg">
        <div className="font-bold text-lg mb-1">{fmtNum(data.score, { digits: 0 })} pts</div>
        
        {!isInitial && data.opponentId && (
          <div className="text-sm opacity-90 mb-1">
            vs {context.playerName(data.opponentId)}
          </div>
        )}
        
        {!isInitial && data.improvement > 0 && (
          <div className="text-sm text-green-500 font-medium mb-1">
            +{fmtNum(data.improvement, { digits: 1 })} improvement
          </div>
        )}

        <div className="text-xs opacity-60">
           {relativeTimeString(new Date(data.time))}
        </div>
      </div>
    );
  }

  return null;
};
