import React from "react";
import { ShareBar } from "./stat-tile";

type Props = {
  /** 1 to 4, printed in the marker of the section. */
  level: number;
  title: string;
  /** Which games the numbers of the section come from. */
  description: string;
  /** Share of the games of the period that record this level of detail. */
  coverage?: { label: string; share: number };
  children: React.ReactNode;
};

/**
 * One level of detail of the Games tab. The sections stand under each other in
 * the order of the levels, and each one says which games it covers, so a reader
 * knows that a number of a lower section is over fewer games.
 */
export const DetailLevelSection: React.FC<Props> = ({ level, title, description, coverage, children }) => (
  <section className="flex flex-col gap-3 border-t border-primary-text/20 pt-4 first:border-t-0 first:pt-0">
    <div className="flex items-start gap-3">
      <span className="shrink-0 grid place-items-center h-8 w-8 rounded-full bg-secondary-background text-secondary-text font-semibold">
        {level}
      </span>
      <div className="flex flex-col gap-2 min-w-0 grow">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-primary-text">{title}</h2>
          <p className="text-sm text-primary-text/70">{description}</p>
        </div>
        {coverage && <ShareBar label={coverage.label} share={coverage.share} />}
      </div>
    </div>
    <div className="flex flex-col gap-3">{children}</div>
  </section>
);
