import React from "react";
import { Achievement } from "../../client/client-db/achievements";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { dateString, daysBetweenCeiled } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";

/**
 * What one earning of an achievement says beyond its name: the opponent, the
 * value of a record, the length of a streak, the days a chase took. Each type
 * says what its own data holds.
 *
 * The recent list and the details view of the achievements page both render
 * it, so an achievement describes itself the same way everywhere.
 */
export const AchievementFacts: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const context = useEventDbContext();

  return (
    <>
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
      {achievement.data &&
        "seasonStart" in achievement.data &&
        achievement.type !== "season-opener" &&
        achievement.type !== "so-close" && (
          <span className="text-[11px] opacity-80">
            Season: {dateString(achievement.data.seasonStart)} – {dateString(achievement.earnedAt)}
          </span>
        )}
      {achievement.type === "season-opener" && achievement.data && (
        <span className="text-[11px] opacity-80">
          Season starting {dateString(achievement.data.seasonStart)}
        </span>
      )}
      {achievement.type === "so-close" && achievement.data && (
        <span className="text-[11px] opacity-80">
          Season {context.seasons.getSeasons().findIndex((s) => s.start === achievement.data.seasonStart) + 1}
          {" — "}
          {fmtNum((achievement.data.playerScore / achievement.data.winnerScore) * 100, { digits: 1 })}% of{" "}
          {context.playerName(achievement.data.winner)}'s winning score
        </span>
      )}
      {achievement.type === "full-coverage" && achievement.data && (
        <span className="text-[11px] opacity-80">
          Played all {fmtNum(achievement.data.opponentCount)} other players
        </span>
      )}
      {achievement.type === "milestone-game" && achievement.data && (
        <span className="text-[11px] opacity-80">
          League game #{fmtNum(achievement.data.milestone)}
        </span>
      )}
      {achievement.data && "lastGameAt" in achievement.data && achievement.type !== "reunion" && (
        <span className="text-[11px] opacity-80">
          {dateString(achievement.data.lastGameAt)} – {dateString(achievement.earnedAt)}
        </span>
      )}
      {achievement.type === "reunion" && achievement.data && (
        <span className="text-[11px] opacity-80">
          Reunited after{" "}
          {Math.round((achievement.earnedAt - achievement.data.lastGameAt) / (24 * 60 * 60 * 1000))} days
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
      {achievement.type === "yin-yang" && achievement.data && (
        <span className="text-[11px] opacity-80">
          {achievement.data.streakLength} alternating results in a row
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
          Avenged in {daysBetweenCeiled(achievement.data.lostAt, achievement.earnedAt)} day
          {daysBetweenCeiled(achievement.data.lostAt, achievement.earnedAt) !== 1 ? "s" : ""}
          {achievement.data.lostTournamentId === achievement.data.tournamentId &&
            " in the same tournament"}
        </span>
      )}
      {(achievement.type === "full-house" ||
        achievement.type === "humbled" ||
        achievement.type === "everybodys-opponent") &&
        achievement.data && (
          <span className="text-[11px] opacity-80">
            {achievement.type === "full-house"
              ? "Beat "
              : achievement.type === "humbled"
                ? "Lost to "
                : "Played "}
            {achievement.data.count} ranked player
            {achievement.data.count !== 1 ? "s" : ""} in{" "}
            {Math.round(
              (achievement.earnedAt - achievement.data.firstGameAt) / (24 * 60 * 60 * 1000),
            )}{" "}
            days
          </span>
        )}
      {achievement.type === "giant-hunting" && achievement.data && (
        <span className="text-[11px] opacity-80">
          Beat{" "}
          {achievement.data.giants
            .map((giant) => `${context.playerName(giant.opponent)} (#${giant.opponentRank})`)
            .join(", ")}
        </span>
      )}
      {achievement.type === "party-pooper" && achievement.data && (
        <span className="text-[11px] opacity-80">
          Spoiled an undefeated day of {achievement.data.opponentWins} wins
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
    </>
  );
};
