import { session } from "../services/auth";

export function httpClient(...input: Parameters<typeof fetch>) {
  return fetch(input[0], {
    ...input[1],
    headers: {
      ...input[1]?.headers,
      Authorization: `Bearer ${session.token}`,
    },
  });
}
