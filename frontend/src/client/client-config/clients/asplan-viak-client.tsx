import asplanViaklogo from "../../../img/client-logo/asplan-viak.png";
import { ClientConfig, Theme } from "../get-client-config";

export class AsplanViakClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Asplan Viak";
  theme = Theme.CLIENT_ASPLAN_VIAK;
  logo = (
    <div className="h-full max-w-36 sm:max-w-48 rounded-full overflow-hidden hover:opacity-80">
      <img src={asplanViaklogo} alt="Asplan viak logo" />
    </div>
  );
  snow = false;
  title = "Asplan Viak - bordtennis";
  favicon = "🏓";
  gameLimitForRanked = 5;
  tournaments = [];
}
