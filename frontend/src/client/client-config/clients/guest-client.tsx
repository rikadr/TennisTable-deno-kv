import { ClientConfig } from "../get-client-config";

export class GuestClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Guest";
  logo = (
    <div className="py-4 px-6 bg-primary-background hover:bg-primary-background/70  rounded-full">Tennis🏆💔Table</div>
  );
  snow = false;
  title = "Tennis🏆💔Table";
  favicon = "🏓";
  tournaments = [];
}
