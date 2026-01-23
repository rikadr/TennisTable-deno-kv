import { CloseButton, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import React, { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { classNames } from "../common/class-names";
import { session } from "../services/auth";
import pumpkinLogo from "../img/halloween/tennis-table.png";
import easterLogo from "../img/easter/easter-tennis-table.png";
import { getClientConfig, Theme, themeOrOverrideTheme } from "../client/client-config/get-client-config";

const MENU_HEIGHT = "h-16 md:h-12";

export const NavMenu: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top whenever the path changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  }, [pathname]);

  const renderMenuitems = () => {
    const items: { name: string; to: string }[] = [
      { name: "🥇 Leaderboard", to: "/leader-board" },
      { name: "🍁 Seasons", to: "/season/list" },
      { name: "🏆 Hall of Fame", to: "/hall-of-fame" },
      { name: "🏓  Add game", to: "/add-game" },
      { name: "👤  New player", to: "/add-player" },
      { name: "👥🥊 Compare 1v1", to: "/1v1" },
      { name: "📈 Compare all", to: "/compare-players" },
      { name: "🏆 Tournaments", to: "/tournament/list" },
      { name: "🎖️ Achievements", to: "/achievements" },
      { name: "🤖 Simulations", to: "/simulations" },
      { name: "🔧 Settings", to: "/settings" },
    ];
    if (session.isAuthenticated && session.sessionData?.role === "admin") {
      items.push({ name: "🔐 Admin Page", to: "/admin" });
    }
    const menuItemWrapperClassNames =
      "flex items-center justify-end md:justify-start h-12 md:h-10 hover:underline px-4 sm:px-12";
    const menuItemTextClassNames = "text-lg md:text-xl font-semibold text-secondary-text";

    const list = items.map((item, index) => (
      <CloseButton key={index} as={Link} to={item.to} className={menuItemWrapperClassNames}>
        <p className={menuItemTextClassNames}>{item.name}</p>
      </CloseButton>
    ));
    if (session.isAuthenticated) {
      list.push(
        <CloseButton key={list.length} as={Link} to="/me" className={menuItemWrapperClassNames}>
          <p className={menuItemTextClassNames}>My profile</p>
        </CloseButton>,
      );
      list.push(
        <CloseButton
          key={list.length}
          onClick={() => {
            session.token = undefined;
            window.location.reload();
          }}
          className={menuItemWrapperClassNames}
        >
          <p className={menuItemTextClassNames}>Log Out</p>
        </CloseButton>,
      );
    } else {
      list.push(
        <CloseButton key={list.length} as={Link} to="/log-in" className={menuItemWrapperClassNames}>
          <p className={menuItemTextClassNames}>Log In</p>
        </CloseButton>,
      );
    }
    return list;
  };

  const themedLogo = () => {
    const client = getClientConfig();
    const theme = themeOrOverrideTheme(client.theme);

    if (theme === Theme.HALLOWEEN) {
      return (
        <div className="w-40 py-4 px-6 rounded-full bg-primary-background hover:bg-primary-background/70">
          <img className="" src={pumpkinLogo} alt="Pumpkin" />
        </div>
      );
    }
    if (theme === Theme.EASTER) {
      return (
        <div className="w-40 py-4 px-6 rounded-full bg-primary-background hover:bg-primary-background/70">
          <img className="" src={easterLogo} alt="Pumpkin" />
        </div>
      );
    }

    const clientConfig = getClientConfig();

    return clientConfig.logo;
  };

  return (
    <div className="min-h-svh">
      <div aria-label="menu displacer" className={MENU_HEIGHT} />
      <div
        className={classNames(
          "fixed inset-0 top-0 z-50 bg-secondary-background text-white flex justify-between items-center p-4 overflow-hidden",
          MENU_HEIGHT,
        )}
      >
        <Link to="/leader-board" className={classNames("whitespace-nowrap rounded-full select-none text-primary-text")}>
          {themedLogo()}
        </Link>
        {renderMenuitems().slice(2, 3)}
        <div className="md:flex hidden">{renderMenuitems().slice(3, 4)}</div>

        <div className="grow md:block" />

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
                    "flex flex-col gap-2 p-8 md:mt-0 w-full md:w-96 bg-secondary-background rounded-lg",
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
