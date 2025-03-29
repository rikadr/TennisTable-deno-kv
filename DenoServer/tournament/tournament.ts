import { kv } from "../db.ts";

export type SignUpTournament = {
  tournamentId: string;
  player: string;
  time: number;
};

type SignUpTournamentPayload = {
  tournamentId: string;
  player: string;
};

export async function signUp(payload: SignUpTournamentPayload): Promise<SignUpTournament> {
  const key = getTournamentSignupKey(payload.tournamentId, payload.player);
  const value: SignUpTournament = {
    tournamentId: payload.tournamentId,
    player: payload.player,
    time: Date.now(),
  };

  const res = await kv.atomic().check({ key, versionstamp: null }).set(key, value).commit();

  if (!res.ok) {
    throw new Error("Failed to sign up player");
  }
  return value;
}

export async function getAllSignedUp(): Promise<SignUpTournament[]> {
  const signedUp: SignUpTournament[] = [];
  const res = kv.list<SignUpTournament>({ prefix: getTournamentSignupKey() });

  for await (const signUp of res) {
    signedUp.push(signUp.value);
  }
  return signedUp;
}

function getTournamentSignupKey(tournamentId?: string, player?: string): string[] {
  if (tournamentId === undefined && player !== undefined) {
    throw new Error("tournamentId is required when player is provided");
  }

  const key: string[] = [];
  key.push("tournament");
  key.push("sign-up");

  if (tournamentId !== undefined) {
    key.push(tournamentId);
  }

  if (player !== undefined) {
    key.push(player);
  }
  return key;
}
