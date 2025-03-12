import Snowfall from "react-snowfall";
import { getClientName } from "../common/get-client-name";

export const TableTennisSnowfall: React.FC = () => {
  const clientName = getClientName();
  if (clientName === undefined) {
    return;
  }
  if (["skimore"].includes(clientName)) return <Snowfall />;
};
