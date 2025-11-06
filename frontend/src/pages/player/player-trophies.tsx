import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { Shimmer } from "../../common/shimmer";
import { classNames } from "../../common/class-names";

type Props = {
  playerId?: string;
};

// Trophy badge configurations with emoji and colors
const TROPHY_CONFIG = {
  "donut-1": {
    emoji: "🍩",
    label: "Donut",
    bgGradient: "from-orange-400 to-orange-600",
    cardColor: "bg-orange-50 border-orange-300 text-orange-900",
    shimmer: true,
    description: "Won a set without opponent scoring",
  },
  "donut-5": {
    emoji: "🍩",
    label: "Donut Master",
    bgGradient: "from-yellow-400 via-amber-500 to-orange-500",
    cardColor: "bg-yellow-50 border-yellow-400 text-yellow-900",
    shimmer: true,
    description: "Achieved 5 donut sets",
  },
  "streak-all-10": {
    emoji: "🔥",
    label: "Win Streak",
    bgGradient: "from-red-500 to-orange-600",
    cardColor: "bg-red-50 border-red-400 text-red-900",
    shimmer: true,
    description: "Won 10 games in a row",
  },
  "streak-player-10": {
    emoji: "🎯",
    label: "Domination Streak",
    bgGradient: "from-purple-500 to-pink-600",
    cardColor: "bg-purple-50 border-purple-400 text-purple-900",
    shimmer: true,
    description: "Won 10 games in a row against the same opponent",
  },
  "back-after-6-months": {
    emoji: "👋",
    label: "Welcome Back",
    bgGradient: "from-blue-400 to-cyan-500",
    cardColor: "bg-blue-50 border-blue-300 text-blue-900",
    shimmer: false,
    description: "Returned after 6+ months",
  },
  "back-after-1-year": {
    emoji: "🎊",
    label: "Long Return",
    bgGradient: "from-indigo-500 to-purple-600",
    cardColor: "bg-indigo-50 border-indigo-400 text-indigo-900",
    shimmer: true,
    description: "Returned after 1+ year",
  },
  "back-after-2-years": {
    emoji: "🎉",
    label: "Epic Return",
    bgGradient: "from-pink-500 via-rose-500 to-red-500",
    cardColor: "bg-pink-50 border-pink-400 text-pink-900",
    shimmer: true,
    description: "Returned after 2+ years",
  },
  "active-6-months": {
    emoji: "⭐",
    label: "Regular Player",
    bgGradient: "from-green-400 to-emerald-600",
    cardColor: "bg-green-50 border-green-300 text-green-900",
    shimmer: false,
    description: "Active for 6+ months",
  },
  "active-1-year": {
    emoji: "🌟",
    label: "Dedicated Player",
    bgGradient: "from-teal-500 to-cyan-600",
    cardColor: "bg-teal-50 border-teal-400 text-teal-900",
    shimmer: true,
    description: "Active for 1+ year",
  },
  "active-2-years": {
    emoji: "💎",
    label: "Veteran Player",
    bgGradient: "from-cyan-500 via-blue-500 to-indigo-600",
    cardColor: "bg-cyan-50 border-cyan-400 text-cyan-900",
    shimmer: true,
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
                  <div className="relative">
                    <div
                      className={`w-16 h-16 rounded-full bg-gradient-to-br ${config.bgGradient} flex items-center justify-center text-3xl shadow-lg`}
                    >
                      {config.emoji}
                    </div>
                  </div>
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
  const BadgeContent = () => (
    <div className="relative overflow-visible">
      <div
        className={`w-20 h-20 rounded-full bg-gradient-to-br ${config.bgGradient} flex items-center justify-center shadow-lg relative overflow-hidden`}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-white/20 rounded-full blur-sm" />

        {/* Emoji */}
        <span className="text-4xl relative z-10 drop-shadow-lg">{config.emoji}</span>
      </div>
    </div>
  );

  return (
    <div
      className={classNames(
        "rounded-lg p-4 border-2 shadow-md hover:shadow-xl transition-all hover:scale-105 duration-300",
        config.cardColor,
      )}
    >
      {/* Horizontal Layout: Badge on left, content on right */}
      <div className="flex gap-4">
        {/* Trophy Badge */}
        <div className="flex-shrink-0">
          {config.shimmer ? (
            <Shimmer>
              <BadgeContent />
            </Shimmer>
          ) : (
            <BadgeContent />
          )}
        </div>

        {/* Trophy Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Top section: relative time */}
          <div className="text-right mb-2">
            <div className="text-xs opacity-75 bg-white/40 px-2 py-1 rounded-full inline-block">
              {relativeTimeString(new Date(trophy.earnedAt))}
            </div>
          </div>

          {/* Middle section: trophy data */}
          <div className="space-y-1 text-sm flex-1">
            {/* Opponent (for relevant trophies) */}
            {trophy.data.opponent && (
              <div className="flex items-center gap-2">
                <span className="opacity-75">vs</span>
                <span className="font-semibold truncate">{context.playerName(trophy.data.opponent)}</span>
              </div>
            )}

            {/* Started At (for streak trophies) */}
            {trophy.data.startedAt && (
              <div className="flex items-center gap-2">
                <span className="opacity-75">Started</span>
                <span className="font-medium text-xs">{dateString(trophy.data.startedAt)}</span>
              </div>
            )}

            {/* Last Game (for back after trophies) */}
            {trophy.data.lastGameAt && (
              <div className="flex items-center gap-2">
                <span className="opacity-75">Last played</span>
                <span className="font-medium text-xs">{dateString(trophy.data.lastGameAt)}</span>
              </div>
            )}

            {/* First Game in Period (for active trophies) */}
            {trophy.data.firstGameInPeriod && (
              <div className="flex items-center gap-2">
                <span className="opacity-75">Since</span>
                <span className="font-medium text-xs">{dateString(trophy.data.firstGameInPeriod)}</span>
              </div>
            )}
          </div>

          {/* Bottom section: Earned date */}
          <div className="flex items-center gap-2 pt-2 border-t border-current/20 mt-2">
            <span className="opacity-75 text-sm">Earned</span>
            <span className="font-medium text-xs">{dateString(trophy.earnedAt)}</span>
          </div>
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
