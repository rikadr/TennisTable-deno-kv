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

async function createJwt(client: string, user: User): Promise<string> {
  return await new SignJWT({ username: user.username, role: user.role, client })
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

async function signUp(client: string, username: string, password: string): Promise<{ token: string }> {
  const foundUser = await userStore.getUser(client, username);
  if (foundUser) {
    throw new Error("User already exists");
  }

  // async hash not avaiable in deno deploy
  const encryptedPassword = bcrypt.hashSync(password);

  const user = await userStore.createUser(client, username, encryptedPassword, "user");

  return { token: await createJwt(client, user) };
}

async function login(client: string, username: string, password: string): Promise<{ token: string }> {
  const user = await userStore.getUser(client, username);

  if (!user) {
    throw new Error("Username or password is incorrect");
  }

  const passwordMatch = await bcrypt.compareSync(password, user.password);

  if (!passwordMatch) {
    throw new Error("Username or password is incorrect");
  }

  const token = await createJwt(client, user);

  return { token };
}

async function getAllUsers(client: string): Promise<Omit<User, "password">[]> {
  return await userStore.findAll(client);
}

async function setRole(
  client: string,
  options: { role: string; username: string },
): Promise<Omit<User, "password">> {
  await userStore.update(client, options.username, { role: options.role });
  const user = await userStore.getUser(client, options.username);
  if (!user) {
    throw new Error("User not found");
  }
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

async function deleteUser(client: string, username: string): Promise<void> {
  await userStore.remove(client, username);
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
