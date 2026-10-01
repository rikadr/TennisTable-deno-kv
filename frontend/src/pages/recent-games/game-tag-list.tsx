import React from "react";
import { GameTag } from "../../client/client-db/game-tags";
import { TennisTable } from "../../client/client-db/tennis-table";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { getAchievementLabel } from "../player/player-achievements";
import { tournamentPlacementLabels } from "../tournament/tournament-game-location";

type TagLabel = { icon: string; label: string; title: string };

/** One label per tag. An achievement that the game earned for more than 1 player is 1 label that names them all */
function tagLabels(tags: GameTag[], context: TennisTable): TagLabel[] {
  const labels: TagLabel[] = [];
  const achievementEarners = new Map<string, string[]>();

  for (const tag of tags) {
    switch (tag.type) {
      case "tournament": {
        const { stage, round } = tournamentPlacementLabels(tag.placement);
        const place = stage === round ? round : `${stage}, ${round}`;
        labels.push({ icon: "🏆", label: round, title: `${tag.placement.tournament.name}: ${place}` });
        break;
      }
      case "first-meeting":
        labels.push({ icon: "🆕", label: "First meeting", title: "The first game between these 2 players" });
        break;
      case "achievement": {
        const earners = achievementEarners.get(tag.achievement.type);
        const name = context.playerName(tag.achievement.earnedBy);
        if (earners) earners.push(name);
        else achievementEarners.set(tag.achievement.type, [name]);
        break;
      }
    }
  }

  achievementEarners.forEach((earners, type) => {
    const { icon, title } = getAchievementLabel(type, context.client.gameLimitForRanked);
    labels.push({ icon, label: title, title: `${title}: ${earners.join(", ")}` });
  });
  return labels;
}

/** The tags of a game, each as an icon with a short label. The title gives the full text */
export const GameTagList: React.FC<{ tags: GameTag[] }> = ({ tags }) => {
  const context = useEventDbContext();
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tagLabels(tags, context).map(({ icon, label, title }) => (
        <span
          key={title}
          title={title}
          className="inline-flex items-center gap-1 max-w-full rounded-full bg-primary-text/10 px-1.5 py-0.5 text-xs whitespace-nowrap"
        >
          <span className="shrink-0">{icon}</span>
          <span className="font-normal truncate">{label}</span>
        </span>
      ))}
    </div>
  );
};
