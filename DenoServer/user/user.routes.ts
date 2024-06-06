import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { OptioPongContext, authService } from "../auth-service/auth-service.ts";
import { isAuthenticated } from "../auth-service/middleware.ts";

export const registerUserRoutes = (api: Router) => {
  api.post("/user/register", async (context) => {
    const payload = (await context.request.body.json()) as { username: string; password: string };

    const { token } = await authService.register(payload.username, payload.password);

    context.response.body = { token };
  });

  api.get("/user/me", isAuthenticated, (context: OptioPongContext) => {
    const user = authService.getUserFromRequest(context);
    context.response.body = user;
    return;
  });

  api.post("/user/login", async (context) => {
    const payload = (await context.request.body.json()) as { username: string; password: string };

    try {
      const { token } = await authService.login(payload.username, payload.password);

      context.response.body = { token };
    } catch (err) {
      context.response.status = 401;
      context.response.body = { error: err.message };
    }
    return;
  });
};
