import type { Context, Middleware, RouterMiddleware } from "oak";

/**
 * The client of the routes at the root path. A deployment that served one
 * client sets `CLIENT`, and its frontend calls the routes without a client in
 * the path. Remove this when every frontend uses a client path.
 */
export const ROOT_CLIENT: string | undefined = Deno.env.get("CLIENT")?.trim() || undefined;

/**
 * The clients this server serves. One server holds the data of all of them,
 * and a request names its client in the first path segment: `/optio/events`.
 */
export const CLIENTS: ReadonlySet<string> = new Set(
  [...(Deno.env.get("CLIENTS") ?? "").split(","), ROOT_CLIENT ?? ""]
    .map((client) => client.trim())
    .filter((client) => client !== ""),
);

if (CLIENTS.size === 0) {
  throw new Error("Set CLIENTS (comma separated) or CLIENT to the clients this server serves");
}

/**
 * Takes the client from the path. An unknown client gets a 404, so a request
 * can not create data for a client that this server does not serve.
 */
export const usePathClient: RouterMiddleware<"/:client"> = async (context, next) => {
  const client = context.params.client;
  if (!CLIENTS.has(client)) {
    context.response.status = 404;
    context.response.body = { message: "Unknown client" };
    return;
  }
  context.state.client = client;
  await next();
};

export function useFixedClient(client: string): Middleware {
  return async (context, next) => {
    context.state.client = client;
    await next();
  };
}

export function clientOf(context: Context): string {
  const client: unknown = context.state.client;
  if (typeof client !== "string") {
    throw new Error("The request has no client");
  }
  return client;
}
