import React from "react";
import { Link } from "react-router-dom";
import { LeaderBoard } from "./leader-board";

import { classNames } from "../common/class-names";

export const NavigationLink: React.FC<{ to: string; text: string; className?: string }> = (props) => {
  return (
    <Link
      className={classNames(
        "w-full text-sm text-center whitespace-nowrap text-white py-1 px-3 rounded-md font-thin",
        props.className,
      )}
      to={props.to}
    >
      {props.text}
    </Link>
  );
};

export const LeaderBoardPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center">
      <section className="flex gap-x-4 gap-y-2 items-baseline flex-col w-56 sm:w-fit sm:flex-row p-1">
        <NavigationLink to="/add-game" text="Add played game +🏓" className="bg-green-700 hover:bg-green-900" />
        <NavigationLink to="/add-player" text="Add player +👤" className="bg-green-700 hover:bg-green-900" />
      </section>
      <LeaderBoard />
    </div>
  );
};
