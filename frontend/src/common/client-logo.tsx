import { getClientName } from "./get-client-name";
import skimorelogo from "../img/client-logo/skimore.jpg";
export const ClientLogo: React.FC = () => {
  const clientName = getClientName();
  switch (clientName) {
    case "skimore":
      return (
        <div className="h-full max-w-36 sm:max-w-48 rounded-lg overflow-hidden hover:opacity-60">
          <img src={skimorelogo} alt="skimore logo" />
        </div>
      );
    default:
      return (
        <div className="py-4 px-6 bg-primary-background hover:bg-primary-background/70  rounded-full">
          Tennis🏆💔Table
        </div>
      );
  }
};
