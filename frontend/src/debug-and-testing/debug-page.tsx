import React from "react";
import { NavigationLink } from "../pages/leader-board-page";

export const DebugPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 items-center pt-24">
      <NavigationLink to="/leader-board" text="Back to leaderboard" className="bg-indigo-700 hover:bg-indigo-800" />
      <NavigationLink to="/camera" text="Camera 📸" className="bg-indigo-700 hover:bg-indigo-800" />
      <NavigationLink to="/v2" text="V2" className="bg-indigo-700 hover:bg-indigo-800" />
    </div>
  );
};
