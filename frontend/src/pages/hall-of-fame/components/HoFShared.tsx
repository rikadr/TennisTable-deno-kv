import React from "react";
import { Link } from "react-router-dom";
import { classNames } from "../../../common/class-names";

export const StatItem = ({ label, value, subtext, highlight }: { label: string; value: string | number; subtext?: string; highlight?: boolean }) => (
   <div className="flex flex-col items-center md:items-start">
      <span className="text-xs text-primary-text/60 uppercase tracking-wide">{label}</span>
      <span className={classNames("text-2xl md:text-3xl font-mono font-bold", highlight ? "text-yellow-400" : "text-primary-text")}>
         {value}
      </span>
      {subtext && <span className="text-xs text-primary-text/50 truncate max-w-[150px]">{subtext}</span>}
   </div>
);

export const DetailCard = ({ label, value, icon }: { label: string; value: string | number; icon: string }) => (
   <div className="bg-primary-background rounded-lg p-4 border border-primary-text/5 flex items-center gap-3">
      <div className="text-2xl opacity-80">{icon}</div>
      <div>
         <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
         <div className="font-bold text-lg">{value}</div>
      </div>
   </div>
);

export const RivalryCard = ({ type, opponentId, count, context, full }: { type: "nemesis" | "victim", opponentId: string, count: number, context: any, full?: boolean }) => {
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

export const BreakdownBar = ({ label, value, offset, width, description, icon }: { label: string; value: number; offset: number; width: number; description: React.ReactNode; icon: string }) => {
   return (
      <div>
         <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-primary-text flex items-center gap-2">
               <span>{icon}</span> {label}
            </span>
            <span className="text-sm font-bold text-primary-text">{Math.round(value)}</span>
         </div>
         <div className="w-full bg-secondary-background/10 rounded-full h-4 mb-1 relative overflow-hidden">
            <div
               className="bg-yellow-500 h-4 rounded-full transition-all duration-700 absolute"
               style={{ left: `${offset}%`, width: `${width}%` }}
            />
         </div>
         <div className="text-xs text-secondary-text/60 italic">{description}</div>
      </div>
   )
}

export const ActivityHeatmap = ({ data }: { data?: { [date: string]: number } }) => {
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
