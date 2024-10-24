import { CloseButton, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import React, { useMemo } from "react";
import { Link, Outlet } from "react-router-dom";
import { classNames } from "../common/class-names";
import { session } from "../services/auth";

const MENU_HEIGHT = "h-20 md:h-12";

export const NavMenu: React.FC = () => {
  const menuItems = useMemo(
    () => {
      const items: { name: string; to: string }[] = [
        { name: "🏆 Leaderboard", to: "/leader-board" },
        { name: "+🏓  Add game", to: "/add-game" },
        { name: "+👤  New player", to: "/add-player" },
        { name: "📈 Compare players", to: "/compare-players" },
        { name: "Camera", to: "/camera" },
      ];
      if (session.isAuthenticated) {
        items.push({ name: "Admin Page 🔐", to: "/admin" });
      } else {
        items.push({ name: "Log in", to: "/login" });
      }
      return items;
    },
    [
      // TODO: update when session.isAuthenticated changes
    ],
  );

  return (
    <div className="">
      <div aria-label="menu displacer" className={classNames("hidden md:visible md:flex w-full", MENU_HEIGHT)} />
      <div className="mt-4 mb-24">
        <Outlet />
      </div>
      <div
        className={classNames(
          "fixed inset-x-0 bottom-0 md:top-0 bg-slate-600 text-white flex justify-between items-center p-4 overflow-hidden",
          MENU_HEIGHT,
        )}
      >
        {/* Logo for desktop menu */}
        <Link to="/leader-board" className=" whitespace-nowrap bg-slate-800 py-4 px-6 rounded-full select-none">
          Tennis🏆💔Table
        </Link>

        <div className="grow" />

        {/* Right Item - Burger Menu */}
        <Popover className="relative flex justify-center items-center">
          {({ open }) => {
            return (
              <>
                <PopoverButton className="py-4 px-8 transition-all outline-0 ">
                  <div
                    className={classNames(
                      "w-6 h-0.5 bg-white transition-all duration-100",
                      open ? "rotate-45 translate-y-0.5 scale-110" : "-translate-y-2",
                    )}
                  />
                  <div className={classNames("w-6 h-0.5 bg-white transition-all", open ? "opacity-0" : "")} />
                  <div
                    className={classNames(
                      "w-6 h-0.5 bg-white transition-all",
                      open ? "-rotate-45 -translate-y-0.5 scale-110" : "translate-y-2",
                    )}
                  />
                </PopoverButton>
                <PopoverPanel
                  transition
                  anchor="top"
                  className={classNames(
                    "flex flex-col gap-2 p-8 w-full md:w-96 bg-slate-600 rounded-lg",
                    "transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0",
                  )}
                >
                  {menuItems.map((item, index) => (
                    <CloseButton
                      key={index}
                      as={Link}
                      to={item.to}
                      className="flex items-center justify-end md:justify-start h-16 md:h-10 hover:underline px-12"
                    >
                      <p className="text-2xl md:text-xl font-semibold">{item.name}</p>
                    </CloseButton>
                  ))}
                  {session.isAuthenticated && (
                    <button
                      className={classNames(
                        "flex items-center justify-end md:justify-start h-16 md:h-10 hover:underline w-full text-2xl md:text-xl font-semibold text-center whitespace-nowrap text-white px-12 rounded-md",
                      )}
                      onClick={() => {
                        session.token = undefined;
                        window.location.reload();
                      }}
                    >
                      Log Out
                    </button>
                  )}
                </PopoverPanel>
              </>
            );
          }}
        </Popover>
      </div>
    </div>
  );
};
