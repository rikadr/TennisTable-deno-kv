import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { useEventDbContext } from "../../wrappers/event-db-context";

type Props = {
  playerId?: string;
};

export const OponentsScores: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();

  if (!playerId) return null;

  const { avgDiff, diffGraphData } = context.playerOponentDistribution.get(playerId);

  return (
    <div className="flex flex-col w-full divide-y divide-primary-text/50">
      <p>Avg. score of oponent: {fmtNum(avgDiff, { digits: 0, signedPositive: true })}</p>
      {diffGraphData.map((entry) => (
        <div className={classNames("flex", entry.diffGroup === 0 && "bg-secondary-background text-secondary-text")}>
          <p className="w-16">{entry.diffGroup}</p>
          {Array(entry.count)
            .fill(0)
            .map(() => (
              <pre>O</pre>
            ))}
        </div>
      ))}
    </div>
  );
};
