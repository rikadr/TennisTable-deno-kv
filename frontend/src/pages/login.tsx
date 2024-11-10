import { useNavigate } from "react-router-dom";
import { useAuth } from "../services/auth/auth";

export const LoginPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <form
        className="space-y-2 p-10 rounded-xl ring-1 ring-gray-300 drop-shadow bg-gray-50 text-black"
        onSubmit={async (e) => {
          e.preventDefault();
          const username = document.getElementById("username") as HTMLInputElement;
          const password = document.getElementById("password") as HTMLInputElement;

          if (username && password) {
            auth.login.mutate(
              {
                username: username.value,
                password: password.value,
              },
              {
                onSuccess: () => {
                  navigate("/");
                },
              },
            );
          } else {
            console.error("No username or password");
          }
        }}
      >
        <div className="w-full flex items-center justify-between">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            className="rounded-md ring-1 ring-gray-300 shadow bg-gray-200 text-gray-800 ml-2 p-1"
            id="username"
          />
        </div>
        <div className="w-full flex items-center justify-between">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            className="rounded-md ring-1 ring-gray-300 shadow bg-gray-200 text-gray-800 ml-2 p-1"
            id="password"
          />
        </div>
        <div className="/* flex flex-col w-full items-center justify-end space-y-3 pt-3 */">
          <button type="submit" className="p-2 w-full bg-blue-300 text-black rounded-md hover:bg-blue-500">
            Login
          </button>
          <a
            href="/sign-up"
            className="text-center p-2 w-full text-gray-800 ring-1 ring-gray-300 rounded-md hover:bg-gray-300"
          >
            or sign up
          </a>
        </div>
      </form>
    </div>
  );
};
