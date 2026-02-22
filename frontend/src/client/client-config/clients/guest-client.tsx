import { ClientConfig, Theme } from "../get-client-config";

export class GuestClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Guest";
  theme = Theme.DEFAULT;
  logo = (
    <div className="py-4 px-6 bg-primary-background hover:bg-primary-background/70  rounded-full">Tennis🏆💔Table</div>
  );
  snow = false;
  title = "Tennis🏆💔Table";
  favicon = "🏓";
  gameLimitForRanked = 5;
}
