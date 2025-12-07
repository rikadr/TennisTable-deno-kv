import { ClientConfig, Theme } from "../get-client-config";

export class DeepinsightClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Deepinsight";
  theme = Theme.CLIENT_DEEPINSIGHT;
  logo = (
    <div className="h-full max-w-36 sm:max-w-44 rounded-full overflow-hidden hover:opacity-80 p-2 flex items-center justify-center">
      <img
        src="https://framerusercontent.com/images/1ojnQz8eyOHZxCBgA9tbAGg2U.png"
        alt="Deepinsight logo"
        className="object-contain w-full h-full"
      />
    </div>
  );
  snow = false;
  title = "Deepinsight - bordtennis";
  favicon = "🔮";
  gameLimitForRanked = 5;
  tournaments = [];
}
