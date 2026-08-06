import React from "react";
import { Link } from "react-router-dom";
import { Achievement } from "../../client/client-db/achievements";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { getAchievementLabel, dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";

interface AchievementsListProps {
  achievements: Achievement[];
}

export const AchievementsList: React.FC<AchievementsListProps> = ({ achievements }) => {
  const context = useEventDbContext();

  if (achievements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🏆</div>
        <p>No achievements yet</p>
        <p className="text-sm/70 mt-2">Keep playing to unlock achievements!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {achievements.map((achievement, index) => {
        const label = getAchievementLabel(achievement.type, context.client.gameLimitForRanked);

        return (
          <div
            key={`${achievement.type}-${achievement.earnedBy}-${achievement.earnedAt}-${index}`}
            className="rounded-lg p-3 max-w-2xl border bg-background-secondary border-primary-text/30 hover:border-accent/50 transition-colors text-primary-text"
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl shrink-0">{label.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 overflow-hidden">
                    <h3 className="font-semibold text-primary-text whitespace-nowrap">{label.title}</h3>
                    <p className="text-xs opacity-70 truncate hidden sm:block">{label.description}</p>
                  </div>
                  <div className="text-[10px] whitespace-nowrap opacity-60 text-right shrink-0">
                    <p>{dateString(achievement.earnedAt)}</p>
                    <p>{relativeTimeString(new Date(achievement.earnedAt))}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <div
                    className="rounded-full w-fit flex items-center bg-primary-background/50 ring-1 ring-primary-text/10"
                  >
                    <Link
                      to={"/player/" + achievement.earnedBy}
                      className="flex gap-2 items-center pr-3 p-0.5 "
                    >
                      <ProfilePicture playerId={achievement.earnedBy} size={18} border={1} />
                      <span className="text-xs font-medium">
                        {context.playerName(achievement.earnedBy)}
                      </span>
                    </Link>
                  </div>

                  {achievement.data && "opponent" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      vs {context.playerName(achievement.data.opponent)}
                    </span>
                  )}
                  {achievement.data && "time" in achievement.data && (
                    <span className="text-[11px] opacity-80">🕒 {achievement.data.time}</span>
                  )}
                  {achievement.data && "tournamentId" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      🏆 {context.tournaments.getTournament(
                        achievement.data.tournamentId
                      )?.tournamentConfig.name || "Tournament"}
                    </span>
                  )}
                  {achievement.data &&
                    "opponents" in achievement.data &&
                    achievement.data.opponents && (
                      <div className="text-[11px] opacity-80">
                        Welcomed:{" "}
                        {achievement.data.opponents
                          .map((player: string) => context.playerName(player))
                          .join(", ")}
                      </div>
                    )}
                  {achievement.data && "firstGameInPeriod" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {dateString(achievement.data.firstGameInPeriod)} – {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.data && "startedAt" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {dateString(achievement.data.startedAt)} – {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.data && "seasonStart" in achievement.data && achievement.type !== "season-opener" && (
                    <span className="text-[11px] opacity-80">
                      Season: {dateString(achievement.data.seasonStart)} – {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.type === "season-opener" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Season starting {dateString(achievement.data.seasonStart)}
                    </span>
                  )}
                  {achievement.type === "milestone-game" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      League game #{fmtNum(achievement.data.milestone)}
                    </span>
                  )}
                  {achievement.data && "lastGameAt" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {dateString(achievement.data.lastGameAt)} – {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.data &&
                    "firstWinAt" in achievement.data &&
                    "thirdWinAt" in achievement.data && (
                      <span className="text-[11px] opacity-80">
                        {Math.round((achievement.data.thirdWinAt - achievement.data.firstWinAt) / (60 * 1000))}m interval
                      </span>
                    )}
                  {achievement.type === "david" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {fmtNum(achievement.data.eloGain, { digits: 1, signedPositive: true })} Score
                      {achievement.data.previousRecord !== undefined
                        ? ` (prev record ${fmtNum(achievement.data.previousRecord, { digits: 1 })})`
                        : " (first league record!)"}
                    </span>
                  )}
                  {achievement.type === "goliath" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {fmtNum(-achievement.data.eloLoss, { digits: 1 })} Score
                      {achievement.data.previousRecord !== undefined
                        ? ` (prev record ${fmtNum(-achievement.data.previousRecord, { digits: 1 })})`
                        : " (first league record!)"}
                    </span>
                  )}
                  {achievement.type === "best-friends" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      50 games in{" "}
                      {Math.round(
                        (achievement.earnedAt - achievement.data.firstGame) / (24 * 60 * 60 * 1000),
                      )}{" "}
                      days ({dateString(achievement.data.firstGame)} – {dateString(achievement.earnedAt)})
                    </span>
                  )}
                  {achievement.type === "photo-finish" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Score {fmtNum(achievement.data.playerElo, { digits: 1 })} vs{" "}
                      {fmtNum(achievement.data.opponentElo, { digits: 1 })} (diff{" "}
                      {fmtNum(achievement.data.eloDiff, { digits: 1 })})
                    </span>
                  )}
                  {achievement.type === "touched-the-throne" && achievement.data && (
                    <>
                      <span className="text-[11px] opacity-80">
                        Score {fmtNum(achievement.data.elo)}
                      </span>
                      <span className="text-[11px] opacity-80">
                        in{" "}
                        {Math.round(
                          (achievement.earnedAt - achievement.data.firstGameAt) /
                            (24 * 60 * 60 * 1000),
                        )}{" "}
                        days
                      </span>
                      {achievement.data.dethroned && (
                        <span className="text-[11px] opacity-80">
                          Dethroned {context.playerName(achievement.data.dethroned)}
                        </span>
                      )}
                    </>
                  )}
                  {achievement.type === "on-the-podium" && achievement.data && (
                    <>
                      <span className="text-[11px] opacity-80">
                        Score {fmtNum(achievement.data.elo)}
                      </span>
                      <span className="text-[11px] opacity-80">
                        in{" "}
                        {Math.round(
                          (achievement.earnedAt - achievement.data.firstGameAt) /
                            (24 * 60 * 60 * 1000),
                        )}{" "}
                        days
                      </span>
                    </>
                  )}
                  {achievement.type === "climber" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {fmtNum(achievement.data.fromElo, { digits: 0 })} →{" "}
                      {fmtNum(achievement.data.toElo, { digits: 0 })} in{" "}
                      {Math.round(
                        (achievement.data.toDate - achievement.data.fromDate) / (24 * 60 * 60 * 1000),
                      )}{" "}
                      days ({dateString(achievement.data.fromDate)} – {dateString(achievement.data.toDate)})
                    </span>
                  )}
                  {achievement.type === "less-is-more" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {achievement.data.playerPoints} pts vs {achievement.data.opponentPoints} pts
                    </span>
                  )}
                  {achievement.type === "marathon-set" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {achievement.data.setWinnerScore}–{achievement.data.setLoserScore}
                      {achievement.data.previousRecord !== undefined
                        ? ` (prev record ${achievement.data.previousRecord})`
                        : " (first league record!)"}
                    </span>
                  )}
                  {achievement.type === "shootout" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {achievement.data.points} points in the top {achievement.data.sets.length} set
                      {achievement.data.sets.length !== 1 ? "s" : ""}:{" "}
                      {achievement.data.sets.map((set) => `${set.playerPoints}–${set.opponentPoints}`).join(", ")}
                      {achievement.data.previousRecord !== undefined
                        ? ` (prev record ${achievement.data.previousRecord})`
                        : " (first league record!)"}
                    </span>
                  )}
                  {achievement.type === "hero-of-the-day" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {achievement.data.gamesPlayed} games in one day
                      {achievement.data.previousRecord !== undefined
                        ? ` (prev record ${achievement.data.previousRecord})`
                        : " (first league record!)"}
                    </span>
                  )}
                  {achievement.type === "hero-of-the-week" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {achievement.data.gamesPlayed} games in one week
                      {achievement.data.previousRecord !== undefined
                        ? ` (prev record ${achievement.data.previousRecord})`
                        : " (first league record!)"}
                    </span>
                  )}
                  {achievement.type === "hero-of-the-month" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {achievement.data.gamesPlayed} games in one month
                      {achievement.data.previousRecord !== undefined
                        ? ` (prev record ${achievement.data.previousRecord})`
                        : " (first league record!)"}
                    </span>
                  )}
                  {achievement.type === "back-from-the-dead" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Retired for{" "}
                      {Math.round((achievement.earnedAt - achievement.data.retiredAt) / (24 * 60 * 60 * 1000))} days
                    </span>
                  )}
                  {achievement.type === "king-maker" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      New king: {context.playerName(achievement.data.newKing)} (
                      {fmtNum(achievement.data.netScoreGained, { digits: 0, signedPositive: true })} Score)
                    </span>
                  )}
                  {achievement.type === "streak-ender" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Ended {achievement.data.streakLength}-game streak
                    </span>
                  )}
                  {(achievement.type === "longest-win-streak" ||
                    achievement.type === "longest-lose-streak") &&
                    achievement.data && (
                      <span className="text-[11px] opacity-80">
                        {achievement.data.streakLength}{" "}
                        {achievement.type === "longest-win-streak" ? "wins" : "losses"} in a row
                        {achievement.data.previousRecord !== undefined
                          ? ` (prev record ${achievement.data.previousRecord})`
                          : " (first league record!)"}
                      </span>
                    )}
                  {achievement.type === "perfect-day" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {achievement.data.wins} wins, 0 losses
                    </span>
                  )}
                  {achievement.type === "perfect-week" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Won 5 days in a row from {dateString(achievement.data.startDay)}
                    </span>
                  )}
                  {achievement.type === "group-stage-star" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Undefeated ({achievement.data.wins} win
                      {achievement.data.wins !== 1 ? "s" : ""})
                    </span>
                  )}
                  {achievement.type === "sweet-revenge" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Avenged in{" "}
                      {Math.round((achievement.earnedAt - achievement.data.lostAt) / (24 * 60 * 60 * 1000))} day
                      {Math.round((achievement.earnedAt - achievement.data.lostAt) / (24 * 60 * 60 * 1000)) !== 1
                        ? "s"
                        : ""}
                      {achievement.data.lostTournamentId === achievement.data.tournamentId &&
                        " in the same tournament"}
                    </span>
                  )}
                  {(achievement.type === "full-house" || achievement.type === "humbled") &&
                    achievement.data && (
                      <span className="text-[11px] opacity-80">
                        {achievement.type === "full-house" ? "Beat " : "Lost to "}
                        {achievement.data.count} ranked player
                        {achievement.data.count !== 1 ? "s" : ""} in{" "}
                        {Math.round(
                          (achievement.earnedAt - achievement.data.firstGameAt) / (24 * 60 * 60 * 1000),
                        )}{" "}
                        days
                      </span>
                    )}
                  {achievement.type === "leap-frog" && achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Jumped {achievement.data.ranksJumped} rank
                      {achievement.data.ranksJumped !== 1 ? "s" : ""}: #{achievement.data.fromRank} → #
                      {achievement.data.toRank} (
                      {fmtNum(achievement.data.fromElo, { digits: 1 })} →{" "}
                      {fmtNum(achievement.data.toElo, { digits: 1 })}
                      {achievement.data.leapfroggedPlayers.length > 0 && (
                        <>
                          {", over "}
                          {achievement.data.leapfroggedPlayers
                            .map((p) => context.playerName(p))
                            .join(", ")}
                        </>
                      )}
                      )
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
