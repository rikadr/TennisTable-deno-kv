import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/auth/auth";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();

  const signupMutation = useMutation<
    void,
    Error,
    { username: string; password: string }
  >({
    mutationFn: async ({ username, password }) => {
      await auth.signup(username, password);
    },
    onSuccess: () => {
      navigate("/");
    },
  });

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <form
        className="space-y-2 p-10 rounded-xl ring-1 ring-gray-300 drop-shadow bg-gray-50 text-black"
        onSubmit={async (e) => {
          e.preventDefault();
          const username = document.getElementById(
            "username",
          ) as HTMLInputElement;
          const password = document.getElementById(
            "password",
          ) as HTMLInputElement;

          const confirmPassword = document.getElementById(
            "confirm-password",
          ) as HTMLInputElement;

          if (username && password && confirmPassword?.checked) {
            signupMutation.mutate({
              username: username.value,
              password: password.value,
            });
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
        <div className="w-full flex flex-col items-start justify-center">
          <label htmlFor="confirm-password">Confirm your password</label>
          <div className="flex w-full items-center space-x-3">
            <input
              type="checkbox"
              id="confirm-password"
            />
            <span>Yes that is my password</span>
          </div>
        </div>
        <div className="flex flex-col w-full items-center justify-end space-y-3 pt-3">
          <button
            type="submit"
            className="p-2 w-full bg-blue-300 text-black rounded-md hover:bg-blue-500"
          >
            sign up
          </button>
        </div>
      </form>
    </div>
  );
};
