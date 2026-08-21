import React, { useMemo } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { PillSelect } from "../../common/pill-select";
import { getRangeCutoff, TimeRange, TIME_RANGE_LABELS, TIME_RANGES } from "../../common/time-range";
import { fmtNum } from "../../common/number-utils";
import { ContentCard } from "../player/content-card";
import { durationString, gapString } from "../game/game-tracking-stats";
import { NotEnoughGames, StackedShareBar, StatTile, StatTileRow } from "./stat-tile";
import { DetailLevelSection } from "./detail-level-section";
import { percentLabel, ratioLabel, SPREAD_COLORS } from "./percent-chart";
import {
  DetailLevelChart,
  DetailLevelLegend,
  LosingScoreChart,
  PointsPerGameChart,
  SetScorePie,
  SetsPlayedChart,
} from "./games-tab-charts";
import {
  detailLevels,
  detailLevelTrend,
  gameLevelStats,
  leaguePace,
  pointLevelStats,
  setLevelStats,
  tableSideStats,
  trackedLevelStats,
  TrackedLevelStats,
} from "./statistics-aggregations";

const RANGE_OPTIONS = TIME_RANGES.map((range) => ({ value: range, label: TIME_RANGE_LABELS[range] }));

/** A value the period can leave out, because it holds no game for it. */
const orDash = (value: string | undefined): string => value ?? "–";

/**
 * The set points and the match points read as one thing: closing a set costs a
 * player this many chances, closing a game costs more, and the difference is
 * the point of the card.
 */
const ClosingOutCard: React.FC<{ stats: TrackedLevelStats }> = ({ stats }) => {
  const { setPointsToClose, matchPointsToClose } = stats;
  const difference =
    setPointsToClose === undefined || matchPointsToClose === undefined
      ? undefined
      : matchPointsToClose - setPointsToClose;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            title: "To close a set",
            chances: setPointsToClose,
            unit: "set points",
            conversion: stats.setPointConversion,
            color: "rgb(var(--color-secondary-text))",
          },
          {
            title: "To close a game",
            chances: matchPointsToClose,
            unit: "match points",
            conversion: stats.matchPointConversion,
            color: "rgba(var(--color-secondary-text),0.45)",
          },
        ].map((side) => (
          <div
            key={side.title}
            className="flex flex-col gap-0.5 rounded-lg bg-secondary-background text-secondary-text px-3 py-2 border-l-4"
            style={{ borderColor: side.color }}
          >
            <span className="text-xs md:text-sm opacity-80">{side.title}</span>
            <span className="text-2xl md:text-3xl font-semibold leading-tight">
              {orDash(fmtNum(side.chances, { digits: 1 }))}
            </span>
            <span className="text-xs opacity-70">{side.unit}, on average</span>
            <span className="text-xs opacity-70">
              {side.conversion === undefined ? "–" : percentLabel(side.conversion)} of them go in
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm text-primary-text">
        {difference === undefined && "Not enough closed sets to compare the two yet."}
        {difference !== undefined && Math.abs(difference) < 0.05 && "A game costs as many chances to close as a set."}
        {difference !== undefined && Math.abs(difference) >= 0.05 && (
          <>
            A game costs <span className="font-semibold">{fmtNum(Math.abs(difference), { digits: 1 })}</span>{" "}
            {difference > 0 ? "more" : "fewer"} chances to close than a set.
          </>
        )}
      </p>
    </div>
  );
};

export const GamesTab: React.FC<{ range: TimeRange; setRange: (range: TimeRange) => void }> = ({ range, setRange }) => {
  const context = useEventDbContext();

  const cutoff = useMemo(() => getRangeCutoff(range, new Date()), [range]);
  const gamesInRange = useMemo(() => context.games.filter((game) => game.playedAt >= cutoff), [context, cutoff]);

  const detail = useMemo(() => detailLevels(gamesInRange), [gamesInRange]);
  const trend = useMemo(() => detailLevelTrend(context.games), [context]);
  const gameLevel = useMemo(
    // `allPlayers`, like every other rating walk of the app: a deactivated
    // player still played their games, and leaving them out would move the
    // rating of everyone who ever met them.
    () => gameLevelStats(context.games, context.allPlayers, context.client.gameLimitForRanked, cutoff),
    [context, cutoff],
  );
  const pace = useMemo(() => leaguePace(gamesInRange, cutoff, Date.now()), [gamesInRange, cutoff]);
  const setLevel = useMemo(() => setLevelStats(gamesInRange), [gamesInRange]);
  const pointLevel = useMemo(() => pointLevelStats(gamesInRange), [gamesInRange]);
  const trackedLevel = useMemo(() => trackedLevelStats(gamesInRange), [gamesInRange]);
  const tableSides = useMemo(() => tableSideStats(gamesInRange), [gamesInRange]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <PillSelect label="Period" options={RANGE_OPTIONS} value={range} onChange={setRange} />
        <p className="text-sm text-primary-text/70 text-center max-w-xl">
          One section per level of detail, from the least to the most. A level needs the level over it, so each section
          covers fewer games than the one before, and every share is of the games of that section only.
        </p>
      </div>

      <ContentCard
        title="How much detail we record"
        description="The four levels as a share of the games of each month, over the whole history."
      >
        {trend.length === 0 ? (
          <NotEnoughGames />
        ) : (
          <div className="flex flex-col gap-2">
            <DetailLevelChart data={trend} />
            <DetailLevelLegend />
          </div>
        )}
      </ContentCard>

      <div className="flex flex-col gap-6">
        <DetailLevelSection
          level={1}
          title="Game level"
          description="From the winner and the loser of every game. The rating belongs here too, because it is built from results alone."
        >
          <ContentCard
            title="How much the league plays"
            description="The games of the whole league, as a rate over the period. A period that starts before the first game starts at that game."
          >
            {pace === undefined ? (
              <NotEnoughGames />
            ) : (
              <StatTileRow columns={3}>
                <StatTile label="Games per day" value={orDash(fmtNum(pace.perDay, { digits: 1 }))} />
                <StatTile label="Games per week" value={orDash(fmtNum(pace.perWeek, { digits: 1 }))} />
                <StatTile label="Games per month" value={orDash(fmtNum(pace.perMonth, { digits: 0 }))} />
              </StatTileRow>
            )}
          </ContentCard>

          <ContentCard title="The matchup" description="Who meets whom, and how far apart they stand.">
            {gameLevel === undefined ? (
              <NotEnoughGames />
            ) : (
              <StatTileRow columns={3}>
                <StatTile
                  label="Median rating gap"
                  value={orDash(fmtNum(gameLevel.medianRatingGap, { digits: 0 }))}
                  note="points, before the game"
                />
                <StatTile
                  label="Median days since the pair played"
                  value={orDash(fmtNum(gameLevel.medianDaysSinceThePairPlayed, { digits: 1 }))}
                  note="over the games that repeat a pair"
                />
                <StatTile
                  label="First ever meeting"
                  value={percentLabel(gameLevel.firstMeeting)}
                  note="of the games in this period"
                />
              </StatTileRow>
            )}
          </ContentCard>

          <ContentCard
            title="Ranked and unranked"
            description={`A player is ranked once they have played ${context.client.gameLimitForRanked} games, so from game number ${
              context.client.gameLimitForRanked + 1
            }. This counts each player as they stood before the game.`}
          >
            {gameLevel === undefined ? (
              <NotEnoughGames />
            ) : (
              <StackedShareBar
                segments={[
                  { label: "Both ranked", share: gameLevel.rankedMix.bothRanked, color: SPREAD_COLORS[0] },
                  { label: "One ranked", share: gameLevel.rankedMix.oneRanked, color: SPREAD_COLORS[1] },
                  { label: "Neither ranked", share: gameLevel.rankedMix.neitherRanked, color: SPREAD_COLORS[2] },
                ]}
              />
            )}
          </ContentCard>
        </DetailLevelSection>

        <DetailLevelSection
          level={2}
          title="Set level"
          description="From the games that record how many sets each player won."
          coverage={detail && { label: "Games that record sets", share: detail.withSets }}
        >
          <ContentCard
            title="The set score"
            description="Read from the winner, so 2-1 and 1-2 are the same score. The slices are all the games with sets."
          >
            {setLevel === undefined ? <NotEnoughGames what="games with sets" /> : <SetScorePie data={setLevel.byScore} />}
          </ContentCard>

          <ContentCard title="How long a game runs" description="The sets a game holds, and who won them.">
            {setLevel === undefined ? (
              <NotEnoughGames what="games with sets" />
            ) : (
              <div className="flex flex-col gap-3">
                <SetsPlayedChart data={setLevel.bySetsPlayed} />
                <StatTileRow columns={3}>
                  <StatTile
                    label="Sets won by the game winner"
                    value={percentLabel(setLevel.setsWonByTheWinner)}
                    note="of all the sets played"
                  />
                </StatTileRow>
              </div>
            )}
          </ContentCard>

          <ContentCard
            title="The bad side of the table"
            description="A game with a score can record which player had the bad side of the table in each set, or that the 2 sides were equal. Every set with a worse side has one player on it, so 50% means the side costs nothing."
          >
            {tableSides === undefined ? (
              <NotEnoughGames what="games with sides" />
            ) : (
              <div className="flex flex-col gap-3">
                {tableSides.setsWonOnTheBadSide !== undefined && (
                  <StackedShareBar
                    segments={[
                      {
                        label: "The bad side wins the set",
                        share: tableSides.setsWonOnTheBadSide,
                        color: SPREAD_COLORS[0],
                      },
                      {
                        label: "The good side wins the set",
                        share: 100 - tableSides.setsWonOnTheBadSide,
                        color: SPREAD_COLORS[1],
                      },
                    ]}
                  />
                )}
                <StatTileRow>
                  <StatTile
                    label="Points won on the bad side"
                    value={tableSides.pointsWonOnTheBadSide === undefined ? "–" : percentLabel(tableSides.pointsWonOnTheBadSide)}
                    note="of the points of the sets with a worse side"
                  />
                  <StatTile
                    label="More sets on the bad side, and the game"
                    value={tableSides.wonWithMoreBadSideSets === undefined ? "–" : percentLabel(tableSides.wonWithMoreBadSideSets)}
                    note="of the games where one player had the bad side more often, that player won"
                  />
                  <StatTile
                    label="Sets with equal sides"
                    value={percentLabel(tableSides.neutralSets)}
                    note="of the sets with recorded sides"
                  />
                  <StatTile
                    label="Games that record the sides"
                    value={percentLabel(tableSides.sidesRecorded)}
                    note="of the games with a score in this period"
                  />
                </StatTileRow>
              </div>
            )}
          </ContentCard>
        </DetailLevelSection>

        <DetailLevelSection
          level={3}
          title="Point level"
          description="From the games that record the points of each set. The sets are in the order they were played, so the first set and the deciding set are known here."
          coverage={detail && { label: "Games that record the points of each set", share: detail.withPoints }}
        >
          <ContentCard title="Inside a set" description="Over every set these games record.">
            {pointLevel === undefined ? (
              <NotEnoughGames what="games with points" />
            ) : (
              <div className="flex flex-col gap-3">
                <StatTileRow>
                  <StatTile
                    label="Sets that reach deuce"
                    value={percentLabel(pointLevel.setsToDeuce)}
                    note="both players at 10 or more"
                  />
                  <StatTile
                    label="Median points in a set"
                    value={orDash(fmtNum(pointLevel.medianPointsPerSet, { digits: 1 }))}
                  />
                  <StatTile
                    label="Median winning margin"
                    value={orDash(fmtNum(pointLevel.medianSetMargin, { digits: 1 }))}
                    note="points in a set"
                  />
                  <StatTile
                    label="Deuce in a match deciding set"
                    value={ratioLabel(pointLevel.deuceRatioOfDecidingSets)}
                    note="as often as in a set that is not the decider"
                  />
                </StatTileRow>
                <LosingScoreChart data={pointLevel.losingSetScores} />
                <p className="text-xs text-primary-text/60 text-center">
                  The score the losing side of a set ends on. A set where both players reach 10 counts as a deuce.
                </p>
              </div>
            )}
          </ContentCard>

          <ContentCard title="Over a whole game" description="The points of every set of a game, added up.">
            {pointLevel === undefined ? (
              <NotEnoughGames what="games with points" />
            ) : (
              <div className="flex flex-col gap-3">
                <StatTileRow columns={3}>
                  <StatTile
                    label="Points won by the game winner"
                    value={percentLabel(pointLevel.pointsWonByTheWinner)}
                    note="of all the points played"
                  />
                  <StatTile
                    label="Less is More"
                    value={percentLabel(pointLevel.lessIsMore)}
                    note="of the games the winner won with fewer points"
                  />
                  <StatTile
                    label="Median points in a game"
                    value={orDash(fmtNum(pointLevel.medianPointsPerGame, { digits: 0 }))}
                  />
                </StatTileRow>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-primary-text">The first set and the game</span>
                  <StackedShareBar
                    segments={[
                      {
                        label: "The winner of the first set wins",
                        share: pointLevel.firstSetWinnerWins,
                        color: SPREAD_COLORS[0],
                      },
                      {
                        label: "The loser of the first set wins",
                        share: 100 - pointLevel.firstSetWinnerWins,
                        color: SPREAD_COLORS[1],
                      },
                    ]}
                  />
                  <span className="text-xs text-primary-text/60">
                    A game of one set counts on the first side, because there the first set is the game.
                  </span>
                </div>
                <PointsPerGameChart data={pointLevel.pointsPerGame} median={pointLevel.medianPointsPerGame} />
                <p className="text-xs text-primary-text/60 text-center">
                  The share of the games at each total of points, with the median marked.
                </p>
              </div>
            )}
          </ContentCard>
        </DetailLevelSection>

        <DetailLevelSection
          level={4}
          title="Fully tracked games"
          description="From the games that record every point as it was scored, with its time and its server."
          coverage={detail && { label: "Games tracked point by point", share: detail.tracked }}
        >
          <ContentCard
            title="Closing a set and closing a game"
            description="A set point is a point that wins the set. A match point is a set point of a player who is one set from the match. Sets that were marked won at a score the 11 and 2 rule does not accept are left out."
          >
            {trackedLevel === undefined ? (
              <NotEnoughGames what="tracked games" />
            ) : (
              <div className="flex flex-col gap-3">
                <ClosingOutCard stats={trackedLevel} />
                <StatTileRow columns={3}>
                  <StatTile
                    label="The loser held a match point"
                    value={trackedLevel.matchPointForTheLoser === undefined ? "–" : percentLabel(trackedLevel.matchPointForTheLoser)}
                    note="of the tracked games"
                  />
                  <StatTile
                    label="The loser of a set held a set point"
                    value={trackedLevel.setPointForTheSetLoser === undefined ? "–" : percentLabel(trackedLevel.setPointForTheSetLoser)}
                    note="of the sets"
                  />
                </StatTileRow>
              </div>
            )}
          </ContentCard>

          <ContentCard title="Pace, serve and runs" description="What the times and the order of the points show.">
            {trackedLevel === undefined ? (
              <NotEnoughGames what="tracked games" />
            ) : (
              <StatTileRow>
                <StatTile label="Median game length" value={durationString(trackedLevel.medianGameDurationMs)} />
                <StatTile label="Median time per point" value={gapString(trackedLevel.medianPointGapMs)} />
                <StatTile
                  label="A point at deuce takes"
                  value={ratioLabel(trackedLevel.deucePaceRatio)}
                  note="as long as a point outside deuce"
                />
                <StatTile
                  label="Points won on serve"
                  value={ratioLabel(trackedLevel.serveRatio)}
                  note="for every point lost on serve"
                />
                <StatTile
                  label="The first point of a set wins the set"
                  value={percentLabel(trackedLevel.firstPointWinsTheSet)}
                />
                <StatTile
                  label="Median longest run of points"
                  value={orDash(fmtNum(trackedLevel.medianLongestRun, { digits: 0 }))}
                  note="points in a row, in a game"
                />
                <StatTile
                  label="Corrections in a tracked game"
                  value={orDash(fmtNum(trackedLevel.averageCorrections, { digits: 1 }))}
                  note="points undone while tracking, on average"
                />
              </StatTileRow>
            )}
          </ContentCard>
        </DetailLevelSection>
      </div>
    </div>
  );
};
