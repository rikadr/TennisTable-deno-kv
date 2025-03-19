import skimorelogo from "../../../img/client-logo/skimore.jpg";
import { ClientConfig, Theme } from "../get-client-config";

export class SkimoreClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Skimore";
  theme = Theme.CLIENT_SKIMORE;
  logo = (
    <div className="h-full max-w-36 sm:max-w-48 rounded-lg overflow-hidden hover:opacity-60">
      <img src={skimorelogo} alt="skimore logo" />
    </div>
  );
  snow = true;
  title = "SKIMORE - Ping pong klubb";
  favicon = "❄";
  tournaments = [];
}
