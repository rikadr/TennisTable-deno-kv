import React, { useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { classNames } from "../../common/class-names";
import { PlayerAchievements, ACHIEVEMENT_LABELS } from "../player/player-achievements";
import { PlayerEloGraph } from "../player/player-elo-graph";
import { PlayerGamesDistrubution } from "../player/player-games-distribution";
import { ContentCard } from "../player/player-page";

type TabType = "overview" | "honors" | "rivalries" | "history" | "raw" | "legacy";

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "honors", label: "Trophy Case", icon: "🏆" },
  { id: "legacy", label: "Legacy Breakdown", icon: "💎" },
  { id: "rivalries", label: "Rivalries", icon: "⚔️" },
  { id: "history", label: "History", icon: "📈" },
  { id: "raw", label: "Raw Stats", icon: "🔢" },
];

export const HallOfFamePlayerPage: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const context = useEventDbContext();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const hallOfFame = context.hallOfFame?.getHallOfFame() ?? [];
  const playerEntry = hallOfFame.find((p) => p.id === playerId);

  if (!playerId || !playerEntry) {
    return <Navigate to="/hall-of-fame" />;
  }

  const isGoat = hallOfFame[0]?.id === playerId;

  return (
    <div className="max-w-7xl mx-auto px-1 md:px-4 pb-12">
      {/* Navigation Breadcrumb */}
      <div className="py-4">
        <Link 
          to="/hall-of-fame" 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-background/10 hover:bg-secondary-background/20 text-secondary-text/80 hover:text-secondary-text transition-colors text-sm font-medium"
        >
          <span>&larr;</span> Back to Hall of Fame
        </Link>
      </div>

      {/* Header Section */}
      <div className={classNames(
        "relative rounded-t-2xl overflow-hidden p-8 text-primary-text shadow-xl z-10",
        isGoat 
          ? "bg-gradient-to-br from-yellow-600/90 via-yellow-900/80 to-primary-background border-b-4 border-yellow-500" 
          : "bg-gradient-to-br from-primary-background via-secondary-background/20 to-primary-background border-b border-primary-text/10"
      )}>
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl select-none pointer-events-none grayscale">
          🏆
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="relative group shrink-0">
            <div className={classNames(
                "absolute -inset-1 rounded-full blur opacity-75 transition duration-1000 group-hover:duration-200",
                isGoat ? "bg-gradient-to-r from-yellow-400 to-amber-600" : "bg-gradient-to-r from-secondary-background to-primary-background"
            )}></div>
            <div className="relative">
                <ProfilePicture playerId={playerId} size={160} border={isGoat ? 4 : 2} />
                {isGoat && (
                    <div className="absolute -top-4 -left-4 text-5xl rotate-[-20deg] drop-shadow-lg filter z-20">👑</div>
                )}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left min-w-0">
             <div className="flex flex-col md:flex-row items-center gap-3 mb-2 justify-center md:justify-start">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight truncate max-w-full">{playerEntry.name}</h1>
                {isGoat && (
                    <span className="shrink-0 px-3 py-1 bg-yellow-500 text-black border border-yellow-400 rounded text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                        The G.O.A.T
                    </span>
                )}
             </div>
             
             {/* Titles & Play Styles */}
             <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                {playerEntry.titles.map((title, i) => (
                    <span key={i} className="px-2 py-1 bg-primary-text/5 text-primary-text/90 text-sm rounded border border-primary-text/10 backdrop-blur-sm">
                        {title}
                    </span>
                ))}
                {playerEntry.playStyle?.map((style, i) => (
                    <span key={`style-${i}`} className="px-2 py-1 bg-indigo-500/20 text-indigo-200 text-sm rounded border border-indigo-500/30 backdrop-blur-sm font-medium">
                        {style}
                    </span>
                ))}
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-6 border-t border-primary-text/10 pt-6">
                <StatItem label="Peak Elo" value={playerEntry.honors.peakElo} highlight={isGoat} />
                <StatItem label="Win Rate" value={`${playerEntry.honors.winRate}%`} />
                
                <StatItem 
                  label="Legacy Score" 
                  value={playerEntry.honors.legacyScore} 
                  highlight
                  subtext="Composite Rating"
                />
                
                {playerEntry.honors.tournamentStats && playerEntry.honors.tournamentStats.participated > 0 && (
                   <StatItem 
                     label="Tournaments" 
                     value={playerEntry.honors.tournamentStats.won} 
                     subtext={`Wins / ${playerEntry.honors.tournamentStats.participated} Played`} 
                     highlight={playerEntry.honors.tournamentStats.won > 0}
                   />
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-secondary-background px-4 md:px-8 border-b border-primary-text/10">
        <div className="flex space-x-6 overflow-x-auto flex-nowrap scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                "flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors shrink-0 whitespace-nowrap",
                activeTab === tab.id
                  ? "text-primary-text border-primary-text"
                  : "text-secondary-text/60 border-transparent hover:text-secondary-text hover:border-secondary-text/30"
              )}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Container */}
      <div className="bg-secondary-background rounded-b-2xl shadow-sm p-4 md:p-8 min-h-[400px]">
        
        {/* Overview Tab */}
        {activeTab === "overview" && (
           <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Highlight Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailCard label="Total Games" value={playerEntry.honors.totalGames} icon="🎮" />
                  <DetailCard label="Days Active" value={playerEntry.honors.daysActive} icon="⏳" />
                  <DetailCard label="Longest Streak" value={playerEntry.honors.longestStreak} icon="🔥" />
                  {playerEntry.cleanSweeps && playerEntry.cleanSweeps > 0 ? (
                      <DetailCard label="Clean Sweeps" value={playerEntry.cleanSweeps} icon="🧹" />
                  ) : (
                      <DetailCard label="Avg Season Rank" value={`#${playerEntry.honors.averageSeasonRank || '-'}`} icon="📊" />
                  )}
              </div>

              {/* Career Milestones Teaser */}
              <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm">
                 <h3 className="font-semibold text-primary-text flex items-center gap-2 mb-6">
                    <span>✨</span> Career Highlights
                 </h3>
                 <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary-text/10" />
                    <div className="space-y-6">
                       {playerEntry.honors.milestones.slice(-3).toReversed().map((m, i) => (
                          <div key={i} className="relative pl-10">
                             <div className="absolute left-0 w-8 h-8 rounded-full bg-secondary-background border border-primary-text/20 flex items-center justify-center text-sm z-10">
                                {m.icon}
                             </div>
                             <div>
                                <div className="text-sm font-bold text-primary-text">{m.label}</div>
                                <div className="text-xs text-secondary-text/60">{new Date(m.date).toLocaleDateString()}</div>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Tournament Highlights */}
              {playerEntry.honors.tournamentStats && playerEntry.honors.tournamentStats.participated > 0 && (
                 <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm">
                    <h3 className="font-semibold text-primary-text flex items-center gap-2 mb-4">
                       <span>🏆</span> Tournament Career
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                       <div>
                          <div className="text-3xl font-bold text-yellow-500">{playerEntry.honors.tournamentStats.won}</div>
                          <div className="text-xs uppercase tracking-wide opacity-70">Wins</div>
                       </div>
                       <div>
                          <div className="text-3xl font-bold text-primary-text">{playerEntry.honors.tournamentStats.finals}</div>
                          <div className="text-xs uppercase tracking-wide opacity-70">Finals</div>
                       </div>
                       <div>
                          <div className="text-3xl font-bold text-primary-text">{playerEntry.honors.tournamentStats.participated}</div>
                          <div className="text-xs uppercase tracking-wide opacity-70">Played</div>
                       </div>
                    </div>
                 </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Trophy Cabinet Teaser */}
                  <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-primary-text flex items-center gap-2">
                           <span>🎖️</span> Trophy Cabinet
                        </h3>
                        <button onClick={() => setActiveTab("honors")} className="text-xs text-secondary-text hover:underline">Open Cabinet &rarr;</button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                         {context.achievements.getAchievements(playerId).slice(0, 8).map((ach, i) => (
                            <div key={i} className="aspect-square rounded-lg bg-secondary-background/10 flex items-center justify-center text-2xl" title={ach.type}>
                               {ACHIEVEMENT_LABELS[ach.type]?.icon || '🏅'}
                            </div>
                         ))}
                      </div>
                  </div>

                  {/* Legacy Curve Teaser */}
                  <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-primary-text flex items-center gap-2">
                           <span>📈</span> Legacy Curve
                        </h3>
                        <button onClick={() => setActiveTab("history")} className="text-xs text-secondary-text hover:underline">Full History &rarr;</button>
                      </div>
                      <div className="h-40 -mx-4">
                         <PlayerEloGraph playerId={playerId} isReadOnly />
                      </div>
                  </div>
              </div>
           </div>
        )}

        {/* Honors Tab */}
        {activeTab === "honors" && (
           <div className="animate-in fade-in duration-300">
               <h2 className="text-2xl font-bold mb-6 text-primary-text flex items-center gap-2">
                  <span>🏆</span> Trophy Case
               </h2>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {context.achievements.getAchievements(playerId).map((ach, index) => {
                     const label = ACHIEVEMENT_LABELS[ach.type] || { title: ach.type, description: "", icon: "🏅" };
                     return (
                        <div key={index} className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
                           <div className="text-5xl mb-4 p-4 bg-secondary-background/10 rounded-full">{label.icon}</div>
                           <h3 className="font-bold text-primary-text mb-1">{label.title}</h3>
                           <p className="text-xs text-secondary-text/80 leading-relaxed mb-3">{label.description}</p>
                           <div className="mt-auto text-[10px] uppercase tracking-wide opacity-50 bg-secondary-background/20 px-2 py-1 rounded">
                              {new Date(ach.earnedAt).toLocaleDateString()}
                           </div>
                        </div>
                     )
                  })}
                  
                  {context.achievements.getAchievements(playerId).length === 0 && (
                     <div className="col-span-full py-12 text-center text-secondary-text opacity-50 italic">
                        The trophy case is empty.
                     </div>
                  )}
               </div>
           </div>
        )}

        {/* Legacy Breakdown Tab */}
        {activeTab === "legacy" && playerEntry.honors.legacyBreakdown && (
           <div className="animate-in fade-in duration-300 space-y-8">
              <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5">
                 <h3 className="text-lg font-semibold text-primary-text mb-6 flex items-center gap-2">
                    <span>💎</span> Legacy Score Breakdown
                 </h3>
                 <p className="text-sm text-secondary-text mb-8 max-w-2xl">
                    The Legacy Score is a composite metric designed to honor both peak performance and long-term contribution. It weighs Peak Elo, tournament success, win rate, and longevity.
                 </p>
                 
                 <div className="space-y-6">
                    <BreakdownBar 
                       label="Peak Elo" 
                       value={playerEntry.honors.legacyBreakdown.eloScore} 
                       total={playerEntry.honors.legacyScore} 
                       description={`+${Math.round(playerEntry.honors.legacyBreakdown.eloScore)} points based on Peak Elo`}
                       icon="⚡"
                    />
                    <BreakdownBar 
                       label="Tournament Wins" 
                       value={playerEntry.honors.legacyBreakdown.tournamentScore} 
                       total={playerEntry.honors.legacyScore} 
                       description={`+${Math.round(playerEntry.honors.legacyBreakdown.tournamentScore)} points from Tournaments`}
                       icon="🏆"
                    />
                    <BreakdownBar 
                       label="Finals Appearances" 
                       value={playerEntry.honors.legacyBreakdown.finalsScore} 
                       total={playerEntry.honors.legacyScore} 
                       description={`+${Math.round(playerEntry.honors.legacyBreakdown.finalsScore)} points from Finals`}
                       icon="🥈"
                    />
                    <BreakdownBar 
                       label="Win Rate Bonus" 
                       value={playerEntry.honors.legacyBreakdown.winRateScore} 
                       total={playerEntry.honors.legacyScore} 
                       description={`+${Math.round(playerEntry.honors.legacyBreakdown.winRateScore)} points for >50% Win Rate`}
                       icon="📈"
                    />
                    <BreakdownBar 
                       label="Longevity" 
                       value={playerEntry.honors.legacyBreakdown.longevityScore} 
                       total={playerEntry.honors.legacyScore} 
                       description={`+${Math.round(playerEntry.honors.legacyBreakdown.longevityScore)} points (1 per active day)`}
                       icon="⏳"
                    />
                    <BreakdownBar 
                       label="Experience" 
                       value={playerEntry.honors.legacyBreakdown.experienceScore} 
                       total={playerEntry.honors.legacyScore} 
                       description={`+${Math.round(playerEntry.honors.legacyBreakdown.experienceScore)} points (1 per game played)`}
                       icon="🎮"
                    />
                 </div>

                 <div className="mt-8 pt-8 border-t border-primary-text/10 flex justify-end items-baseline gap-4">
                    <span className="text-sm uppercase tracking-wide text-secondary-text">Total Legacy Score</span>
                    <span className="text-4xl font-bold font-mono text-yellow-500">{playerEntry.honors.legacyScore}</span>
                 </div>
              </div>
           </div>
        )}

        {/* Rivalries Tab */}
        {activeTab === "rivalries" && (
           <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {playerEntry.honors.nemesis && (
                    <ContentCard title="Arch Nemesis" description="Most losses against">
                       <RivalryCard type="nemesis" opponentId={playerEntry.honors.nemesis.id} count={playerEntry.honors.nemesis.losses} context={context} full />
                    </ContentCard>
                 )}
                 {playerEntry.honors.favoriteVictim && (
                    <ContentCard title="Favorite Victim" description="Most wins against">
                       <RivalryCard type="victim" opponentId={playerEntry.honors.favoriteVictim.id} count={playerEntry.honors.favoriteVictim.wins} context={context} full />
                    </ContentCard>
                 )}
              </div>
              <ContentCard title="Opponent Frequency" description="Who you played the most">
                  <PlayerGamesDistrubution playerId={playerId} />
              </ContentCard>
           </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
           <div className="animate-in fade-in duration-300 space-y-8">
              {/* Activity Heatmap */}
              <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5">
                 <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center gap-2">
                    <span>🔥</span> Activity Heatmap
                 </h3>
                 <ActivityHeatmap data={playerEntry.honors.activityHeatmap} />
              </div>

              <ContentCard title="Elo History" description="Complete career rating progression">
                 <div className="bg-primary-background rounded-lg -mx-2 mt-4 p-2 h-[500px]">
                    <PlayerEloGraph playerId={playerId} isReadOnly />
                 </div>
              </ContentCard>
           </div>
        )}

        {/* Raw Stats Tab */}
        {activeTab === "raw" && (
           <div className="animate-in fade-in duration-300 space-y-8">
              <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5">
                 <h3 className="text-lg font-semibold text-primary-text mb-6 flex items-center gap-2">
                    <span>🔢</span> Aggregate Statistics
                 </h3>
                 {playerEntry.honors.rawStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Sets Stats */}
                        <div className="space-y-4">
                            <h4 className="text-sm uppercase tracking-wide text-primary-text/60 font-bold border-b border-primary-text/10 pb-2">Sets</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <DetailCard label="Sets Won" value={playerEntry.honors.rawStats.setsWon} icon="👍" />
                                <DetailCard label="Sets Lost" value={playerEntry.honors.rawStats.setsLost} icon="👎" />
                            </div>
                            <div className="text-xs text-center text-primary-text/50">
                               Set Win Rate: {Math.round((playerEntry.honors.rawStats.setsWon / (playerEntry.honors.rawStats.setsWon + playerEntry.honors.rawStats.setsLost)) * 100) || 0}%
                            </div>
                        </div>

                        {/* Points Stats */}
                        <div className="space-y-4">
                            <h4 className="text-sm uppercase tracking-wide text-primary-text/60 font-bold border-b border-primary-text/10 pb-2">Points</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <DetailCard label="Points Scored" value={playerEntry.honors.rawStats.pointsScored} icon="🟢" />
                                <DetailCard label="Points Conceded" value={playerEntry.honors.rawStats.pointsConceded} icon="🔴" />
                            </div>
                            <div className="text-xs text-center text-primary-text/50">
                               Point Ratio: {(playerEntry.honors.rawStats.pointsScored / (playerEntry.honors.rawStats.pointsConceded || 1)).toFixed(2)}
                            </div>
                        </div>
                    </div>
                 ) : (
                    <div className="text-center text-secondary-text py-12 italic">
                       No raw game data available.
                    </div>
                 )}
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

// Helper Components

const BreakdownBar = ({ label, value, total, description, icon }: { label: string; value: number; total: number; description: string; icon: string }) => {
    const percentage = Math.min((value / total) * 100, 100);
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-primary-text flex items-center gap-2">
                    <span>{icon}</span> {label}
                </span>
                <span className="text-sm font-bold text-primary-text">{Math.round(value)}</span>
            </div>
            <div className="w-full bg-secondary-background/20 rounded-full h-2 mb-1">
                <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="text-xs text-secondary-text/60 italic">{description}</div>
        </div>
    )
}

const StatItem = ({ label, value, subtext, highlight }: { label: string; value: string | number; subtext?: string; highlight?: boolean }) => (
    <div className="flex flex-col items-center md:items-start">
        <span className="text-xs text-primary-text/60 uppercase tracking-wide">{label}</span>
        <span className={classNames("text-2xl md:text-3xl font-mono font-bold", highlight ? "text-yellow-400" : "text-primary-text")}>
            {value}
        </span>
        {subtext && <span className="text-xs text-primary-text/50 truncate max-w-[150px]">{subtext}</span>}
    </div>
);

const DetailCard = ({ label, value, icon }: { label: string; value: string | number; icon: string }) => (
   <div className="bg-primary-background rounded-lg p-4 border border-primary-text/5 flex items-center gap-3">
      <div className="text-2xl opacity-80">{icon}</div>
      <div>
         <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
         <div className="font-bold text-lg">{value}</div>
      </div>
   </div>
);

const RivalryCard = ({ type, opponentId, count, context, full }: { type: "nemesis" | "victim", opponentId: string, count: number, context: any, full?: boolean }) => {
    const isNemesis = type === "nemesis";
    return (
        <Link to={`/player/${opponentId}`} className={classNames(
            "flex items-center gap-4 p-3 rounded-lg border transition-all hover:scale-[1.02]",
            isNemesis 
                ? "bg-red-500/10 border-red-500/20 hover:bg-red-500/20" 
                : "bg-green-500/10 border-green-500/20 hover:bg-green-500/20"
        )}>
            <div className="text-2xl">{isNemesis ? "😈" : "🎯"}</div>
            <div className="flex-1">
                <div className="text-xs opacity-70 uppercase tracking-wide">{isNemesis ? "Nemesis" : "Favorite Target"}</div>
                <div className="font-bold text-primary-text">{context.playerName(opponentId)}</div>
            </div>
            <div className="text-right">
                <div className={classNames("text-2xl font-bold font-mono", isNemesis ? "text-red-500" : "text-green-500")}>
                    {count}
                </div>
                <div className="text-xs opacity-60">{isNemesis ? "Losses" : "Wins"}</div>
            </div>
        </Link>
    )
}

const ActivityHeatmap = ({ data }: { data?: { [date: string]: number } }) => {
    if (!data) return <div className="text-sm text-secondary-text">No activity data available.</div>;

    const months: { [key: string]: number } = {};
    Object.entries(data).forEach(([date, count]) => {
        const month = date.substring(0, 7); // YYYY-MM
        months[month] = (months[month] || 0) + count;
    });

    const sortedMonths = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
    const maxCount = Math.max(...Object.values(months), 1);

    return (
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {sortedMonths.map(([month, count]) => {
                const height = Math.max(10, (count / maxCount) * 100);
                const [year, m] = month.split('-');
                return (
                    <div key={month} className="flex flex-col items-center gap-1 min-w-[40px]">
                        <div className="w-full bg-secondary-background/20 rounded-t-sm relative h-24 flex items-end justify-center group">
                            <div 
                                className="w-full bg-primary-text/50 hover:bg-primary-text/80 transition-all rounded-t-sm"
                                style={{ height: `${height}%` }}
                            ></div>
                            <div className="absolute -top-8 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                {new Date(year + '-' + m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: {count} games
                            </div>
                        </div>
                        <span className="text-[10px] text-secondary-text">{m}</span>
                        <span className="text-[8px] text-secondary-text/50">{year}</span>
                    </div>
                )
            })}
        </div>
    )
}
