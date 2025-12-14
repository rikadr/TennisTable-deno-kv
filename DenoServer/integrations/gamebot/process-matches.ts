export interface MatchesApiResponse {
  _links: {
    self: { href: string };
    next?: { href: string };
    prev?: { href: string };
  };
  _embedded: {
    matches: Array<{
      id: string;
      _links: { self: { href: string } };

      // These could be embedded objects OR just IDs
      winners?: Array<{ id: string; user_name: string }>;
      losers?: Array<{ id: string; user_name: string }>;

      // Or just IDs referencing users
      winner_ids?: string[];
      loser_ids?: string[];

      scores?: string[]; // ["21:15", "18:21"]
      tied?: boolean;
      resigned?: boolean;

      created_at: string; // ISO timestamp
      updated_at: string;
    }>;
  };
  total_count?: number;
}

export function processMatchesResponse(response: MatchesApiResponse) {
  const matches = response._embedded?.matches;
  if (Array.isArray(matches)) {
    console.log(`Processing ${matches.length} matches.`);
  } else {
    console.log("No matches found in response.");
  }
}
