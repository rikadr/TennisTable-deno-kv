import { useMutation } from "@tanstack/react-query";
import { httpClient } from "../../components/login";
import { session } from "./session";

export const useAuth = () => {
  return {
    login: useMutation({
      mutationFn: async (data: { username: string; password: string }) => {
        const response = await httpClient(`${process.env.REACT_APP_API_BASE_URL}/user/login`, {
          method: "POST",
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          console.log("Failed to login", response.status, response.statusText);
          return;
        }

        const json = (await response.json()) as { token: string };

        session.token = json.token;
      },
    }),
  };
};
