import { useMutation, useQuery } from "@tanstack/react-query";
import { httpClient } from "./login";
import { auth } from "../services/auth/auth";
import { session } from "../services/auth";

export const Users: React.FC = () => {
  const query = useQuery<{ users: { username: string; role: string }[] }>({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await httpClient(
        process.env.REACT_APP_API_BASE_URL + "/user",
      );
      return response.json();
    },
  });

  return (
    <div className="p-1">
      <h1>Users</h1>
      <div className="ring-1 p-5 space-y-3">
        {query.data?.users &&
          query.data.users.map((user) => (
            <User
              key={user.username}
              {...user}
            />
          ))}
      </div>
    </div>
  );
};

const User: React.FC<{ username: string; role: string }> = (
  { username, role },
) => {
  const updateRoleMutation = useMutation({
    mutationFn: async (data: { username: string; role: string }) => {
      const response = await auth.updateRole(data);

      if (!response.ok) {
        console.error(
          "Failed to update role",
          response.status,
          response.statusText,
        );
        return;
      }
    },
  });

  const isYou = username === session.sessionData?.username;

  return (
    <div>
      <h2>{username}</h2>
      <label htmlFor="role">{isYou ? "Your role" : "Choose a role:"}</label>
      <select
        className="bg-gray-300 text-black rounded ml-2 p-1 ring-1 ring-gray-500"
        id="role"
        name="role"
        onChange={(e) => {
          updateRoleMutation.mutate({ username, role: e.target.value });
        }}
        disabled={isYou}
        defaultValue={role}
      >
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
    </div>
  );
};
