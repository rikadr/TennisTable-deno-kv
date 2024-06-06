import { jwtVerify } from "https://deno.land/x/jose@v5.3.0/index.ts";
import { Middleware } from "https://deno.land/x/oak@v16.0.0/middleware.ts";
import { ContextState, JWT_SECRET, SessionUser } from "./auth-service.ts";
import { Action, Auth, Resource } from "./auth-handler.ts";

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
  if (context.request.url.pathname === "/user/login") {
    await next();
    return;
  }

  const authHeader = context.request.headers.get("Authorization");

  if (!authHeader) {
    context.response.status = 401;
    context.response.body = { message: "Authorization header missing" };
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    context.response.status = 401;
    context.response.body = { message: "Token missing" };
    return;
  }

  try {
    const user = await jwtVerify<SessionUser>(token, JWT_SECRET);
    context.state.user = {
      username: user.payload.username,
      role: user.payload.role,
    };

    context.state.auth = new Auth(context);

    await next();
  } catch (_err) {
    context.response.status = 401;
    context.response.body = { message: "Invalid token" };
  }
};

export const middleware = {
  isAuthenticated,
};
