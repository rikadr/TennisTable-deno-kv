import { Router } from "oak";
import { OptioPongContext, authService } from "../auth-service/auth-service.ts";
import { isAuthenticated, requireAuth } from "../auth-service/middleware.ts";
import { getUser } from "./user.store.ts";

export const registerUserRoutes = (api: Router) => {
  api.post("/user/sign-up", async (context) => {
    const payload = (await context.request.body.json()) as { username: string; password: string };

    const { token } = await authService.signUp(payload.username, payload.password);

    context.response.body = { token };
  });

  api.get("/user/me", isAuthenticated, async (context: OptioPongContext) => {
    const user = authService.getUserFromRequest(context);
    const userData = await getUser(user.username);
    context.response.body = userData;
    return;
  });

  api.get("/user", isAuthenticated, requireAuth("user", "read"), async (context) => {
    const users = await authService.getAllUsers();
    context.response.body = { users };
  });

  api.post("/user/login", async (context) => {
    const payload = (await context.request.body.json()) as { username: string; password: string };

    try {
      const { token } = await authService.login(payload.username, payload.password);

      context.response.body = { token };
    } catch (err) {
      context.response.status = 401;
      context.response.body = { error: (err as Error).message };
    }
    return;
  });

  api.put("/user/:username/role", isAuthenticated, requireAuth("roles", "write"), async (context) => {
    const username = context.params.username;
    const payload = (await context.request.body.json()) as { role: string };

    const updated = await authService.setRole({ username, role: payload.role });

    context.response.status = 200;
    context.response.body = updated;
  });

  api.delete("/user/:username", isAuthenticated, requireAuth("user", "delete"), async (context) => {
    const username = context.params.username;
    await authService.deleteUser(username);
    context.response.status = 204;
  });
};
