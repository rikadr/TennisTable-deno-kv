import { jwtVerify } from "jose";
import { Context, Middleware } from "oak";
import { ContextState, JWT_SECRET, SessionUser } from "./auth-service.ts";
import { Action, Auth, Resource } from "./auth-handler.ts";
import { clientOf, ROOT_CLIENT } from "../client.ts";

export function requireAuth<T extends Resource, K extends Action<T>>(resource: T, action: K): Middleware<ContextState> {
  return async (context, next) => {
    const auth = new Auth(context);

    if (!auth.can(resource, action)) {
      context.response.status = 403;
      context.response.body = { message: "Forbidden" };
      return;
    }

    await next();
  };
}

export const isAuthenticated: Middleware<ContextState> = async (context, next) => {
  try {
    context.state.user = await verifyRequestToken(context);
    context.state.auth = new Auth(context);
  } catch (err) {
    context.response.status = 401;
    context.response.body = { message: (err as Error).message };
    return;
  }

  // Outside the try/catch: a route handler failure must surface as a server
  // error, not be re-labelled 401 with its internals echoed to the client.
  await next();
};

// Shared token verification used by both the middleware path (isAuthenticated)
// and the imperative path (hasAccess), so the two cannot drift apart.
async function verifyRequestToken(context: Context): Promise<SessionUser> {
  const authHeader = context.request.headers.get("Authorization");

  if (!authHeader) {
    throw new Error("Authorization header missing");
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new Error("Token missing");
  }

  let payload: SessionUser & { client?: string };
  try {
    payload = (await jwtVerify<SessionUser & { client?: string }>(token, JWT_SECRET)).payload;
  } catch (_err) {
    throw new Error("Invalid token");
  }

  // A token is only valid for the client that issued it. Tokens from before
  // the client claim came from a deployment that served the root client.
  if ((payload.client ?? ROOT_CLIENT) !== clientOf(context)) {
    throw new Error("Invalid token");
  }

  return {
    username: payload.username,
    role: payload.role,
  };
}

export async function hasAccess<T extends Resource, K extends Action<T>>(
  context: Context,
  resource: T,
  action: K,
): Promise<boolean> {
  try {
    context.state.user = await verifyRequestToken(context);
    const auth = new Auth(context);
    return auth.can(resource, action);
  } catch (_) {
    return false;
  }
}
