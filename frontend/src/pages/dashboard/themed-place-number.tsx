import { classNames } from "../../common/class-names";

import pumpkin1 from "../../img/halloween/pumpkin-numbers/1.png";
import pumpkin2 from "../../img/halloween/pumpkin-numbers/2.png";
import pumpkin3 from "../../img/halloween/pumpkin-numbers/3.png";
import pumpkin4 from "../../img/halloween/pumpkin-numbers/4.png";
import pumpkin5 from "../../img/halloween/pumpkin-numbers/5.png";
import pumpkin6 from "../../img/halloween/pumpkin-numbers/6.png";
import pumpkin7 from "../../img/halloween/pumpkin-numbers/7.png";
import pumpkin8 from "../../img/halloween/pumpkin-numbers/8.png";
import pumpkin9 from "../../img/halloween/pumpkin-numbers/9.png";
import pumpkin10 from "../../img/halloween/pumpkin-numbers/10.png";
import pumpkinNotRanked from "../../img/halloween/pumpkin-numbers/not-ranked.png";

import egg1 from "../../img/easter/eggs/easter 1.png";
import egg2 from "../../img/easter/eggs/easter 2.png";
import egg3 from "../../img/easter/eggs/easter 3.png";
import egg4 from "../../img/easter/eggs/easter 4.png";
import egg5 from "../../img/easter/eggs/easter 5.png";
import egg6 from "../../img/easter/eggs/easter 6.png";
import egg7 from "../../img/easter/eggs/easter 7.png";
import egg8 from "../../img/easter/eggs/easter 8.png";
import egg9 from "../../img/easter/eggs/easter 9.png";
import egg10 from "../../img/easter/eggs/easter 10.png";
import eggNotRanked from "../../img/easter/eggs/easter not ranked.png";

import { getClientConfig, Theme, themeOrOverrideTheme } from "../../client/client-config/get-client-config";

const placeBoxSize: Record<Props["size"], string> = {
  default: "w-[4rem] h-[4rem]",
  sm: "w-[3.4rem] h-[3.4rem]",
  xs: "w-[3rem] h-[3rem]",
};

const placeTextSize: Record<Props["size"], string[]> = {
  default: ["text-5xl", "text-4xl", "text-3xl"],
  sm: ["text-4xl", "text-3xl", "text-2xl"],
  xs: ["text-3xl", "text-2xl", "text-xl"],
};

export function getPumpkin(place?: number): string | undefined {
  const pumpkins = [
    pumpkin1,
    pumpkin2,
    pumpkin3,
    pumpkin4,
    pumpkin5,
    pumpkin6,
    pumpkin7,
    pumpkin8,
    pumpkin9,
    pumpkin10,
  ];
  if (!place) return pumpkinNotRanked;

  return pumpkins[place - 1];
}

export function getEgg(place?: number): string | undefined {
  const pumpkins = [egg1, egg2, egg3, egg4, egg5, egg6, egg7, egg8, egg9, egg10];
  if (!place) return eggNotRanked;

  return pumpkins[place - 1];
}

type Props = {
  size: "default" | "sm" | "xs";
  place?: number;
};

export const ThemedPlaceNumber: React.FC<Props> = ({ place, size }) => {
  const client = getClientConfig();
  const theme = themeOrOverrideTheme(client.theme);
  const placeNumberLength = place?.toString().length || 1;
  if (theme === Theme.HALLOWEEN) {
    const pumpkin = getPumpkin(place);
    if (pumpkin) {
      return <img className={classNames("scale-125", placeBoxSize[size])} src={pumpkin} alt="Pumpkin" />;
    }
  }
  if (theme === Theme.EASTER) {
    const pumpkin = getEgg(place);
    if (pumpkin) {
      return <img className={classNames("scale-125", placeBoxSize[size])} src={pumpkin} alt="Pumpkin" />;
    }
  }

  // Default theme
  return (
    <div
      className={classNames(
        "w-16 flex justify-center items-center rounded-full bg-primary-background text-primary-text select-none",
        placeBoxSize[size],
      )}
    >
      {place ? (
        <div className={placeTextSize[size][placeNumberLength - 1]}>{place}</div>
      ) : (
        <div className="text-xs text-center">Not yet ranked</div>
      )}
    </div>
  );
};
