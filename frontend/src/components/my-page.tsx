import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { httpClient } from "./login";

export const MyPage: React.FC = () => {
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await httpClient(process.env.REACT_APP_API_BASE_URL + "/user/me");
      response.status === 401 && navigate("/login");
      return response.json();
    },
  });

  return (
    <div>
      <h1>My Page</h1>
      <pre className="p-16">{JSON.stringify(query, null, 2)}</pre>
    </div>
  );
};
