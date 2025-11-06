import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";

type Props = {
  playerId?: string;
};

// Trophy badge configurations with emoji and colors
const TROPHY_CONFIG = {
  "donut-1": {
    emoji: "🍩",
    label: "Donut",
    color: "bg-orange-100 border-orange-300 text-orange-800",
    description: "Won a set without opponent scoring",
  },
  "donut-5": {
    emoji: "🍩✨",
    label: "Donut Master",
    color: "bg-yellow-100 border-yellow-400 text-yellow-900",
    description: "Achieved 5 donut sets",
  },
  "streak-all-10": {
    emoji: "🔥",
    label: "Win Streak",
    color: "bg-red-100 border-red-300 text-red-800",
    description: "Won 10 games in a row",
  },
  "streak-player-10": {
    emoji: "🎯",
    label: "Domination Streak",
    color: "bg-purple-100 border-purple-300 text-purple-800",
    description: "Won 10 games in a row against the same opponent",
  },
  "back-after-6-months": {
    emoji: "👋",
    label: "Welcome Back",
    color: "bg-blue-100 border-blue-300 text-blue-800",
    description: "Returned after 6+ months",
  },
  "back-after-1-year": {
    emoji: "🎊",
    label: "Long Return",
    color: "bg-indigo-100 border-indigo-300 text-indigo-800",
    description: "Returned after 1+ year",
  },
  "back-after-2-years": {
    emoji: "🎉",
    label: "Epic Return",
    color: "bg-pink-100 border-pink-300 text-pink-800",
    description: "Returned after 2+ years",
  },
  "active-6-months": {
    emoji: "⭐",
    label: "Regular Player",
    color: "bg-green-100 border-green-300 text-green-800",
    description: "Active for 6+ months",
  },
  "active-1-year": {
    emoji: "🌟",
    label: "Dedicated Player",
    color: "bg-teal-100 border-teal-300 text-teal-800",
    description: "Active for 1+ year",
  },
  "active-2-years": {
    emoji: "💎",
    label: "Veteran Player",
    color: "bg-cyan-100 border-cyan-300 text-cyan-800",
    description: "Active for 2+ years",
  },
} as const;

type TrophyType = keyof typeof TROPHY_CONFIG;

export const PlayerTrophies: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();
  context.playerTrophies.calculateTrophies();

  if (!playerId) {
    return <div className="p-8 text-center text-secondary-text/70">No player selected</div>;
  }

  const trophies = context.playerTrophies.getTrophies(playerId);

  // Group trophies by type for better display
  const trophiesByType = trophies.reduce((acc, trophy) => {
    if (!acc[trophy.type]) {
      acc[trophy.type] = [];
    }
    acc[trophy.type].push(trophy);
    return acc;
  }, {} as Record<string, typeof trophies>);

  return (
    <div className="p-6 text-primary-text max-w-6xl mx-auto">
      {trophies.length === 0 ? (
        <div className="text-center py-16 bg-secondary-background/10 rounded-lg">
          <div className="text-6xl mb-4">🎯</div>
          <p className="text-xl text-secondary-text/70">No trophies yet</p>
          <p className="text-sm text-secondary-text/50 mt-2">Keep playing to earn your first trophy!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Trophy type sections */}
          {Object.entries(trophiesByType).map(([type, typeTrophies]) => {
            const config = TROPHY_CONFIG[type as TrophyType];
            if (!config) return null;

            return (
              <div key={type} className="space-y-4">
                {/* Type Header */}
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{config.emoji}</div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary-text">{config.label}</h3>
                    <p className="text-sm text-secondary-text/60">
                      {config.description} • {typeTrophies.length} earned
                    </p>
                  </div>
                </div>

                {/* Trophy Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {typeTrophies.map((trophy, index) => (
                    <TrophyCard key={index} trophy={trophy} config={config} context={context} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Individual trophy card component
const TrophyCard: React.FC<{
  trophy: any;
  config: (typeof TROPHY_CONFIG)[TrophyType];
  context: any;
}> = ({ trophy, config, context }) => {
  return (
    <div className={`${config.color} rounded-lg p-4 border-2 shadow-sm hover:shadow-md transition-shadow`}>
      {/* Trophy Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="text-4xl">{config.emoji}</div>
        <div className="text-xs opacity-75 text-right">{relativeTimeString(new Date(trophy.earnedAt))}</div>
      </div>

      {/* Trophy Details */}
      <div className="space-y-0 text-sm">
        {/* Opponent (for relevant trophies) */}
        {trophy.data.opponent && (
          <div className="flex items-center gap-2">
            <span className="opacity-75">vs</span>
            <span className="font-semibold">{context.playerName(trophy.data.opponent)}</span>
          </div>
        )}

        {/* Started At (for streak trophies) */}
        {trophy.data.startedAt && (
          <div className="flex items-center gap-2">
            <span className="opacity-75">Started</span>
            <span className="font-medium">{dateString(trophy.data.startedAt)}</span>
          </div>
        )}

        {/* Last Game (for back after trophies) */}
        {trophy.data.lastGameAt && (
          <div className="flex items-center gap-2">
            <span className="opacity-75">Last played</span>
            <span className="font-medium">{dateString(trophy.data.lastGameAt)}</span>
          </div>
        )}

        {/* First Game in Period (for active trophies) */}
        {trophy.data.firstGameInPeriod && (
          <div className="flex items-center gap-2">
            <span className="opacity-75">Since</span>
            <span className="font-medium">{dateString(trophy.data.firstGameInPeriod)}</span>
          </div>
        )}

        {/* Earned Date (full format) */}
        <div className="flex items-center gap-2">
          <span className="opacity-75">Earned</span>
          <span className="font-medium">{dateString(trophy.earnedAt)}</span>
        </div>
      </div>
    </div>
  );
};

function dateString(time: number) {
  return new Date(time).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
