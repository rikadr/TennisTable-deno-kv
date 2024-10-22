import React from "react";
import { Link, Outlet } from "react-router-dom";

export const V2Wrapper: React.FC = () => {
  return (
    <div className="">
      <div className=" hidden md:visible fixed inset-x-0 top-0 bg-gray-500/50 text-white md:flex justify-between items-center p-4 h-16 shadow-md">
        <Link to="/leader-board" className="flex-1 flex justify-center items-center">
          <span className="text-xs sm:text-sm">Leaderboard</span>
        </Link>
      </div>
      <div aria-label="menu displacer" className="hidden md:visible md:flex h-16 bg-red-500 w-full" />
      <Outlet />
      <div className=" visible md:hidden fixed inset-x-0 bottom-0 bg-gray-500/50 text-white flex justify-between items-center p-4 h-16 shadow-md">
        {/* Left Item - Leaderboard */}
        <Link to="/leader-board" className="flex-1 flex justify-center items-center">
          <span className="text-xs sm:text-sm">Leaderboard</span>
        </Link>

        {/* Middle Item - Plus Button */}
        <button className="flex-1 flex justify-center items-center">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-2xl pb-1">+</div>
        </button>

        {/* Right Item - Burger Menu */}
        <button className="flex-1 flex justify-center items-center">
          <div className="space-y-1">
            <div className="w-6 h-0.5 bg-white"></div>
            <div className="w-6 h-0.5 bg-white"></div>
            <div className="w-6 h-0.5 bg-white"></div>
          </div>
        </button>
      </div>
    </div>
  );
};
