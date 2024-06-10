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

  const deleteUserMutation = useMutation<void, Error, { username: string }>({
    mutationFn: async ({ username }) => {
      await auth.deleteUser(username);
    },
    onSuccess: () => {
      query.refetch();
    },
  });

  const currentUserName = session.sessionData?.username;

  return (
    <div className="p-1">
      <h1>Users</h1>
      <div className="p-5 divide-y-2 divide-gray-500">
        {query.data?.users &&
          query.data.users.sort((a, b) => {
            // Current user on top, then the rest sorted alphabetically
            if (a.username === currentUserName) {
              return -1;
            }

            if (b.username === currentUserName) {
              return 1;
            }

            return a.username.localeCompare(b.username);
          }).map((user) => (
            <User
              key={user.username}
              {...user}
              isYou={user.username === currentUserName}
              onDelete={() =>
                deleteUserMutation.mutate({ username: user.username })}
            />
          ))}
      </div>
    </div>
  );
};

const User: React.FC<
  { username: string; role: string; onDelete: () => void; isYou: boolean }
> = (
  { username, role, onDelete, isYou },
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

  return (
    <div className="max-w-96 flex items-center justify-between px-2 py-3">
      <div className="flex flex-col sm:flex-row ju items-center">
        <div className="sm:mr-3 rounded-full h-12 ring w-12 overflow-hidden">
          <img src={`https://robohash.org/${username}.png`} alt="profile" />
        </div>
        <h2>{username}</h2>
      </div>
      <div className="flex items-center">
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
        {!isYou && (
          <button
            className="bg-red-500 text-white rounded ml-2 p-1"
            onClick={onDelete}
          >
            delete
          </button>
        )}
      </div>
    </div>
  );
};
