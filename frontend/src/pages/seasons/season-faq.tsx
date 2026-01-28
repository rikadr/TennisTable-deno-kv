import React from "react";

export const SeasonFAQ: React.FC = () => {
  return (
    <div className="bg-secondary-background rounded-lg p-4 md:p-6 mt-4 text-secondary-text space-y-6 md:space-y-8 text-sm md:text-base">
      <section>
        <h2 className="text-lg md:text-2xl font-bold mb-2 md:mb-4">How Seasons Work</h2>
        <p className="mb-3 md:mb-4 text-xs md:text-base">
          Seasons are time-limited competitions where players accumulate points by playing against different opponents.
          Unlike the overall Elo rating which fluctuates up and down, your season score only goes up!
        </p>
      </section>

      <section>
        <h3 className="text-base md:text-xl font-bold mb-2 md:mb-3">Scoring System</h3>
        <p className="mb-3 md:mb-4 text-xs md:text-base">
          You can earn a maximum of <strong>100 points</strong> against each unique opponent. Your score against a
          specific opponent is based on your <strong>single best performance</strong> against them during the season.
        </p>

        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-3 md:mb-4">
          <div className="bg-primary-background p-2 md:p-4 rounded-lg border border-secondary-text/10">
            <div className="text-base md:text-xl mb-1 md:mb-2 font-semibold">🏆 Win</div>
            <div className="font-bold text-sm md:text-lg text-primary-text">25 pts</div>
            <div className="text-xs opacity-80 hidden md:block">Awarded for winning the match</div>
          </div>
          <div className="bg-primary-background p-2 md:p-4 rounded-lg border border-secondary-text/10">
            <div className="text-base md:text-xl mb-1 md:mb-2 font-semibold">📊 Sets</div>
            <div className="font-bold text-sm md:text-lg text-primary-text">25 pts</div>
            <div className="text-xs opacity-80 hidden md:block">Based on percentage of sets won</div>
          </div>
          <div className="bg-primary-background p-2 md:p-4 rounded-lg border border-secondary-text/10">
            <div className="text-base md:text-xl mb-1 md:mb-2 font-semibold">🏓 Points</div>
            <div className="font-bold text-sm md:text-lg text-primary-text">50 pts</div>
            <div className="text-xs opacity-80 hidden md:block">Based on percentage of total points won</div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-base md:text-xl font-bold mb-2 md:mb-4">Tie-breaker Rules</h3>
        <p className="mb-3 md:mb-4 text-xs md:text-sm opacity-90">
          If players have the same total score, ties are resolved in this order:
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 md:gap-4 p-2 md:p-3 rounded-lg bg-primary-background border border-secondary-text/20">
            <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-secondary-background flex items-center justify-center text-xs font-bold text-secondary-text">1</div>
            <div className="text-xs md:text-sm">
              <span className="font-bold text-primary-text">Avg. Performance:</span> Higher average score per opponent ranks higher.
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 p-2 md:p-3 rounded-lg bg-primary-background border border-secondary-text/20">
            <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-secondary-background flex items-center justify-center text-xs font-bold text-secondary-text">2</div>
            <div className="text-xs md:text-sm">
              <span className="font-bold text-primary-text">Activity:</span> More total games played ranks higher.
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 p-2 md:p-3 rounded-lg bg-primary-background border border-secondary-text/20">
            <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-secondary-background flex items-center justify-center text-xs font-bold text-secondary-text">3</div>
            <div className="text-xs md:text-sm">
              <span className="font-bold text-primary-text">First game played:</span> Earliest first game of the season ranks higher.
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 md:space-y-4">
        <h3 className="text-base md:text-xl font-bold">Frequently Asked Questions</h3>

        <div className="border-l-4 border-secondary-text pl-3 md:pl-4 py-1">
          <h4 className="font-bold text-sm md:text-lg mb-1">Does losing a game lower my score?</h4>
          <p className="opacity-90 text-xs md:text-sm">
            No! Since only your best performance against an opponent counts, a bad game will simply be ignored.
            There is no penalty for playing more games.
          </p>
        </div>

        <div className="border-l-4 border-secondary-text pl-3 md:pl-4 py-1">
          <h4 className="font-bold text-sm md:text-lg mb-1">How do I improve my score?</h4>
          <div className="opacity-90 space-y-2 text-xs md:text-sm">
            <p>There are three main ways to boost your season score:</p>
            <ul className="list-disc list-inside ml-2">
              <li>
                Play against <strong>new opponents</strong> you haven't played yet this season.
              </li>
              <li>
                <strong>Register full score details</strong> (sets and points) for your games. If you only track a win
                without the details, you'll receive 0 points for the set and ball components!
              </li>
              <li>
                Replay an opponent if you think you can <strong>beat your previous best result</strong> (e.g. winning
                more sets or with a larger point margin).
              </li>
            </ul>
          </div>
        </div>

        <div className="border-l-4 border-secondary-text pl-3 md:pl-4 py-1">
          <h4 className="font-bold text-sm md:text-lg mb-1">Why doesn't my score go up after a win?</h4>
          <p className="opacity-90 text-xs md:text-sm">
            If you've already played this opponent and had a better (or equal) performance in a previous game,
            your score for that matchup won't increase. You need to beat your previous best record against them!
          </p>
        </div>

        <div className="border-l-4 border-secondary-text pl-3 md:pl-4 py-1">
          <h4 className="font-bold text-sm md:text-lg mb-1">What happens when the season ends?</h4>
          <p className="opacity-90 text-xs md:text-sm">
            The season leaderboard is finalized and we celebrate the winners! A new season will start, and everyone
            begins again with 0 points. Your overall Elo rating continues across seasons.
          </p>
        </div>
      </section>
    </div>
  );
};
