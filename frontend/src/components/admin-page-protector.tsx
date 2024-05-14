import { useState } from "react";
import { AdminPage } from "./admin-page";

export const AdminPageProtector: React.FC = () => {
  const [passwordText, setPasswordText] = useState("");

  const correctPassword = process.env.REACT_APP_ADMIN_PASSWORD;

  if (!correctPassword) {
    return <p>Unable to load password from environment</p>;
  }

  if (passwordText === correctPassword) {
    return <AdminPage />;
  }
  return (
    <div className="flex flex-col items-center">
      <h1>Admin Page</h1>
      <input
        type="password"
        className="text-black"
        value={passwordText}
        onChange={(e) => setPasswordText(e.target.value)}
        placeholder="Password"
      />
    </div>
  );
};
