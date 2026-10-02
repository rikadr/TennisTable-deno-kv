import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { readableOn, readableTextColor } from "../../common/color-utils";
import { stringToColor } from "../../common/string-to-color";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { PvpGame, PvpSet } from "./pvp-data";

/** The primary background of the active theme, as a hex color */
function themeSurface(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--color-primary-background").trim();
  const [r, g, b] = value.split(",").map((part) => Number(part.trim()));
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#1e293b";
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function distance(a: string, b: string) {
  const parse = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [parse(a), parse(b)];
  return Math.sqrt(x.reduce((sum, v, i) => sum + (v - y[i]) ** 2, 0));
}

export type SideColors = { c1: string; c2: string; on1: string; on2: string; surface: string };

/** The colors of the 2 players, readable as marks on the page. When the 2 colors are too similar, player 2 gets white */
export function usePlayerColors(player1?: string, player2?: string): SideColors {
  return useMemo(() => {
    const surface = themeSurface();
    const raw1 = stringToColor(player1);
    let raw2 = stringToColor(player2);
    if (distance(raw1, raw2) < 90) raw2 = readableTextColor(surface) === "#ffffff" ? "#e5e7eb" : "#374151";
    const c1 = readableOn(raw1, surface, 2.2);
    const c2 = readableOn(raw2, surface, 2.2);
    return { c1, c2, on1: readableTextColor(c1), on2: readableTextColor(c2), surface };
  }, [player1, player2]);
}

export function useSelectPlayers() {
  const [, setSearchParams] = useSearchParams();
  const select = (param: "player1" | "player2", value: string) =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set(param, value);
      return params;
    });
  const swap = (player1?: string, player2?: string) =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (player2) params.set("player1", player2);
      if (player1) params.set("player2", player1);
      return params;
    });
  return { select, swap };
}

/** A player button with a native select on top: the phone opens its own list, the desktop a dropdown */
export const PlayerPicker: React.FC<{
  value?: string;
  exclude?: string;
  onChange: (value: string) => void;
  size?: number;
  align?: "left" | "right" | "center";
  layout?: "row" | "column" | "responsive";
  subtitle?: React.ReactNode;
  className?: string;
  nameClassName?: string;
  pictureRing?: boolean;
}> = ({
  value,
  exclude,
  onChange,
  size = 56,
  align = "left",
  layout = "row",
  subtitle,
  className,
  nameClassName,
  pictureRing,
}) => {
  const context = useEventDbContext();
  const players = [...context.players].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return (
    <div
      className={classNames(
        "relative group flex items-center gap-3 min-w-0 rounded-xl",
        layout === "column" && "flex-col gap-2",
        layout === "row" && align === "right" && "flex-row-reverse",
        layout === "responsive" && "flex-col gap-1 sm:gap-3",
        layout === "responsive" && (align === "right" ? "sm:flex-row-reverse" : "sm:flex-row"),
        className,
      )}
    >
      <div
        className={classNames(
          "shrink-0 rounded-full transition",
          pictureRing ? "ring-4 ring-primary-background" : "ring-2 ring-transparent group-hover:ring-primary-text/40",
        )}
      >
        <ProfilePicture playerId={value} size={size} border={3} />
      </div>
      <div
        className={classNames(
          "min-w-0",
          layout === "column" && "text-center w-full",
          layout === "row" && (align === "right" ? "text-right" : "text-left"),
          layout === "responsive" &&
            classNames("text-center w-full sm:w-auto", align === "right" ? "sm:text-right" : "sm:text-left"),
        )}
      >
        <div className={classNames("font-bold truncate", nameClassName)}>
          {value ? context.playerName(value) : "Select player"}
          <span className="ml-1 text-xs opacity-50 group-hover:opacity-100">▾</span>
        </div>
        {subtitle && <div className="text-xs opacity-70 truncate">{subtitle}</div>}
      </div>
      <select
        aria-label="Select player"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {!value && <option value="">Select player</option>}
        {players.map((player) => (
          <option value={player.id} key={player.id} disabled={player.id === exclude}>
            {player.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export const SwapButton: React.FC<{ onClick: () => void; className?: string }> = ({ onClick, className }) => (
  <button
    onClick={onClick}
    title="Swap the players"
    aria-label="Swap the players"
    className={classNames(
      "rounded-full w-9 h-9 flex items-center justify-center bg-secondary-background text-secondary-text hover:bg-secondary-background/70 transition shrink-0",
      className,
    )}
  >
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
);

/** The sets of a game as small chips, in the color of the player who won the set */
export const SetChips: React.FC<{ sets: PvpSet[]; colors: SideColors; size?: "sm" | "md" }> = ({
  sets,
  colors,
  size = "sm",
}) => (
  <div className="flex gap-1">
    {sets.map((set, index) => {
      const p1 = set.p1 > set.p2;
      return (
        <span
          key={index}
          className={classNames(
            "rounded tabular-nums font-semibold leading-none whitespace-nowrap",
            size === "sm" ? "text-[11px] px-1.5 py-1" : "text-xs px-2 py-1.5",
          )}
          style={{ backgroundColor: p1 ? colors.c1 : colors.c2, color: p1 ? colors.on1 : colors.on2 }}
        >
          {set.p1}-{set.p2}
        </span>
      );
    })}
  </div>
);

/** The last games as a row of dots, oldest first, in the color of the winner */
export const FormDots: React.FC<{ games: PvpGame[]; colors: SideColors; count?: number; className?: string }> = ({
  games,
  colors,
  count = 10,
  className,
}) => {
  const navigate = useNavigate();
  const recent = games.slice(-count);
  return (
    <div className={classNames("flex gap-1 items-center", className)}>
      {recent.map((g, index) => (
        <button
          key={g.time}
          onClick={() => navigate(`/game?time=${g.time}`)}
          title={new Date(g.time).toLocaleDateString()}
          className={classNames(
            "rounded-full transition hover:scale-125",
            index === recent.length - 1 ? "w-4 h-4 ring-2 ring-primary-text/60" : "w-3 h-3",
          )}
          style={{ backgroundColor: g.p1Won ? colors.c1 : colors.c2 }}
        />
      ))}
    </div>
  );
};

export const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

export const monthLabel = (time: number) =>
  new Date(time).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export const shortDate = (time: number) =>
  new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
