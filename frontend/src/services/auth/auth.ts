import { useMutation } from "@tanstack/react-query";
import { session } from "./session";
import { httpClient } from "../../common/http-client";

export const useAuth = () => {
  return {
    login: useMutation({
      // Handle failures inline in the UI instead of throwing to an error boundary.
      throwOnError: false,
      mutationFn: async (data: { username: string; password: string }) => {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/user/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(response.status === 401 ? "Invalid username or password" : `Login failed (${response.status})`);
        }

        const json = (await response.json()) as { token: string };

        session.token = json.token;
      },
    }),
  };
};

export const auth = {
  async updateRole(data: { username: string; role: string }) {
    return httpClient(`${process.env.REACT_APP_API_BASE_URL}/user/${data.username}/role`, {
      method: "PUT",
      body: JSON.stringify({ role: data.role }),
    });
  },
  async signup(username: string, password: string) {
    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/user/sign-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(
        body?.error ??
          (response.status === 409 ? "Username already taken" : `Sign up failed (${response.status})`),
      );
    }

    const json = (await response.json()) as { token: string };
    session.token = json.token;
  },
  async deleteUser(username: string) {
    const response = await httpClient(`${process.env.REACT_APP_API_BASE_URL}/user/${username}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      console.error("Failed to delete user", response.status, response.statusText);
      return;
    }

    if (session.sessionData?.username === username) {
      session.token = undefined;
    }
  },
};
