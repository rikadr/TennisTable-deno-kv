import { session } from "../services/auth";

export function httpClient(...input: Parameters<typeof fetch>) {
  return fetch(input[0], {
    ...input[1],
    headers: {
      ...input[1]?.headers,
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
    },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    return response;
  });
}
