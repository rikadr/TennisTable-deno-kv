import { Context } from "https://deno.land/x/oak@v16.0.0/mod.ts";
import { User } from "../user/user.store.ts";
import { SignJWT } from "https://deno.land/x/jose@v5.3.0/index.ts";
import * as userStore from "../user/user.store.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { Auth } from "./auth-handler.ts";
export type SessionUser = {
  username: string;
  role: string;
};

export type ContextState = {
  user?: SessionUser;
  auth?: Auth;
};

export type OptioPongContext = Context<ContextState>;

const myNotSoSecretSecret = "myNotSoSecretSecret";
export const JWT_SECRET = new TextEncoder().encode(myNotSoSecretSecret);

async function createJwt(user: User): Promise<string> {
  return await new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("tennis-table")
    .setAudience("tennis-table")
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

function getUserFromRequest(context: OptioPongContext): SessionUser {
  const user = context.state.user;
  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

async function register(username: string, password: string): Promise<{ token: string }> {
  const foundUser = await userStore.getUser(username);
  if (foundUser) {
    throw new Error("User already exists");
  }

  const encryptedPassword = await bcrypt.hash(password);

  let role: string = "user";

  if (username === "peder") {
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

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    throw new Error("Username or password is incorrect");
  }

  return { token: await createJwt(user) };
}

export const authService = {
  getUserFromRequest,
  createJwt,
  register,
  login,
};
