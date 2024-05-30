import { session } from "../services/auth";
import { useAuth } from "../services/auth/auth";

export function httpClient(...input: Parameters<typeof fetch>) {
  return fetch(input[0], {
    ...input[1],
    headers: {
      ...input[1]?.headers,
      Authorization: `Bearer ${session.token}`,
    },
  });
}

export const LoginPage: React.FC = () => {
  const auth = useAuth();

  return (
    <div>
      <form
        className="space-y-2 p-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const username = document.getElementById("username") as HTMLInputElement;
          const password = document.getElementById("password") as HTMLInputElement;

          if (username && password) {
            auth.login.mutate({ username: username.value, password: password.value });
          } else {
            console.error("No username or password");
          }
        }}
      >
        <div>
          <label htmlFor="username">Username</label>
          <input type="text" className="rounded-sm bg-gray-400 text-black ml-2 p-1" id="username" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input type="password" className="rounded-sm bg-gray-400 text-black ml-2 p-1" id="password" />
        </div>
        <button type="submit" className="p-2 bg-blue-300 text-black rounded-md hover:bg-blue-600">
          Login
        </button>
      </form>
    </div>
  );
};
