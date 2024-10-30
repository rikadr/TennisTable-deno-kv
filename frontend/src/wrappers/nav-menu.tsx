import { CloseButton, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import React, { useEffect, useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { classNames } from "../common/class-names";
import { session } from "../services/auth";
import pumpkinLogo from "../img/halloween/tennis-table.png";
import { CURRENT_THEME } from "../client-db/types";

const MENU_HEIGHT = "h-20 md:h-12";

export const NavMenu: React.FC = () => {
  const { pathname } = useLocation();

  const showLoginLink = window.location.pathname === "/player/rikard";

  useEffect(() => {
    // Scroll to top whenever the path changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  }, [pathname]);

  const menuItems = useMemo(() => {
    const items: { name: string; to: string }[] = [
      { name: "🏆 Leaderboard", to: "/leader-board" },
      { name: "+🏓  Add game", to: "/add-game" },
      { name: "+👤  New player", to: "/add-player" },
      { name: "👥🥊 Compare 1v1", to: "/1v1" },
      { name: "📈 Compare all", to: "/compare-players" },
      { name: "Camera", to: "/camera" },
    ];
    if (session.isAuthenticated) {
      items.push({ name: "Admin Page 🔐", to: "/admin" });
    }
    if (showLoginLink) {
      items.push({ name: "Log in", to: "/secret" });
    }
    return items;
  }, [
    // TODO: update when session.isAuthenticated changes
    showLoginLink,
  ]);

  const renderMenuitems = () => {
    const list = menuItems.map((item, index) => (
      <CloseButton
        key={index}
        as={Link}
        to={item.to}
        className="flex items-center justify-end md:justify-start h-16 md:h-10 hover:underline px-12"
      >
        <p className="text-2xl md:text-xl font-semibold text-secondary-text">{item.name}</p>
      </CloseButton>
    ));
    if (session.isAuthenticated) {
      list.push(
        <CloseButton
          key={list.length}
          onClick={() => {
            session.token = undefined;
            window.location.reload();
          }}
          className="flex items-center justify-end md:justify-start h-16 md:h-10 hover:underline px-12"
        >
          <p className="text-2xl md:text-xl font-semibold text-secondary-text">Log Out</p>
        </CloseButton>,
      );
    }
    return list;
  };

  const themedLogo = () => {
    if (CURRENT_THEME === "halloween") {
      return <img className="w-40" src={pumpkinLogo} alt="Pumpkin" />;
    }

    // Default theme
    return <>Tennis🏆💔Table</>;
  };

  return (
    <div className="">
      <div aria-label="menu displacer" className={MENU_HEIGHT} />
      <div
        className={classNames(
          "fixed inset-0 top-0 z-50 bg-secondary-background text-white flex justify-between items-center p-4 overflow-hidden shadow-xl",
          MENU_HEIGHT,
        )}
      >
        <Link
          to="/leader-board"
          className=" whitespace-nowrap bg-primary-background py-4 px-6 rounded-full select-none hover:bg-primary-background/70 text-primary-text"
        >
          {themedLogo()}
        </Link>
        <div className="md:flex gap-0 shrink-0 hidden">{renderMenuitems().slice(1, 3)}</div>

        <div className="grow" />

        <Popover className={classNames("relative flex justify-center items-center", MENU_HEIGHT)}>
          {({ open }) => {
            return (
              <>
                <PopoverButton className="py-4 px-8 transition-all outline-0 space-y-0">
                  <div
                    className={classNames(
                      "h-[3px] bg-secondary-text transition-all",
                      open ? "rotate-45 translate-y-[3px] scale-110 w-6" : "-translate-y-1 w-8",
                    )}
                  />
                  <div
                    className={classNames("w-8 h-[3px] bg-secondary-text transition-all", open ? "opacity-0" : "")}
                  />
                  <div
                    className={classNames(
                      "h-[3px] bg-secondary-text transition-all",
                      open ? "-rotate-45 -translate-y-[3px] scale-110 w-6" : "translate-y-1 w-8",
                    )}
                  />
                </PopoverButton>
                <PopoverPanel
                  transition
                  anchor="bottom"
                  className={classNames(
                    "flex flex-col gap-2 p-8 mt-4 md:mt-0 w-full md:w-96 bg-secondary-background rounded-lg",
                    "transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0",
                  )}
                >
                  {renderMenuitems()}
                </PopoverPanel>
              </>
            );
          }}
        </Popover>
      </div>
      <div className="mt-4 mb-24">
        <Outlet />
      </div>
    </div>
  );
};
