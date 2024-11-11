import { TennisTable } from "./tennis-table";
import { Tournament } from "./types";

export class Tournaments {
  private parent: TennisTable;

  tournaments: Tournament[] = [];

  constructor(parent: TennisTable) {
    this.parent = parent;
  }
}

/**
 * Ideas:
 * - Tournament results in player page
 * - Tournament page, with brackets and results
 */
