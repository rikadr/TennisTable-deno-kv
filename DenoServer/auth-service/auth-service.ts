import * as bcrypt from "bcrypt";
import { User } from "../user/user.store.ts";
import { SignJWT } from "jose";
import * as userStore from "../user/user.store.ts";
import { Auth } from "./auth-handler.ts";
import { Context } from "oak";
export type SessionUser = {
  username: string;
  role: string;
};

export type ContextState = {
  user?: SessionUser;
  auth?: Auth;
};

export type OptioPongContext = Context<ContextState>;

export const JWT_SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET"));

async function createJwt(user: User): Promise<string> {
  return await new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("tennis-table")
    .setAudience("tennis-table")
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

function getUserFromRequest(context: OptioPongContext): SessionUser {
  const user = context.state.user;
  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

async function signUp(username: string, password: string): Promise<{ token: string }> {
  const foundUser = await userStore.getUser(username);
  if (foundUser) {
    throw new Error("User already exists");
  }

  // async hash not avaiable in deno deploy
  const encryptedPassword = bcrypt.hashSync(password);

  let role: string = "user";

  if (username === "peder2" || username === "rikard2") {
    role = "admin";
  }

  const user = await userStore.createUser(username, encryptedPassword, role);

  return { token: await createJwt(user) };
}

async function login(username: string, password: string): Promise<{ token: string }> {
  const user = await userStore.getUser(username);

  if (!user) {
    throw new Error("Username or password is incorrect");
  }

  const passwordMatch = await bcrypt.compareSync(password, user.password);

  if (!passwordMatch) {
    throw new Error("Username or password is incorrect");
  }

  const token = await createJwt(user);

  return { token };
}

async function getAllUsers(): Promise<Omit<User, "password">[]> {
  return await userStore.findAll();
}

async function setRole(options: { role: string; username: string }): Promise<Omit<User, "password">> {
  await userStore.update(options.username, { role: options.role });
  const user = await userStore.getUser(options.username);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

async function deleteUser(username: string): Promise<void> {
  await userStore.remove(username);
}

export const authService = {
  getUserFromRequest,
  getAllUsers,
  deleteUser,
  createJwt,
  signUp,
  setRole,
  login,
};
