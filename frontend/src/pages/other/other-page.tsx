import React from "react";
import { Link } from "react-router-dom";

export const OtherPage: React.FC = () => {
  const otherOptions: { name: string; url: string }[] = [
    { name: "Settings 🔧", url: "/settings" },
    { name: "Changelog 📜", url: "/changelog" },
    { name: "Performance testing ⏱️", url: "/performance" },
  ];

  return (
    <div className="flex flex-col items-center bg-primary-background rounded-lg p-4 w-fit m-auto">
      <h1 className="mb-6 text-2xl text-primary-text">Other</h1>
      <div className="flex flex-col gap-4 w-96">
        {otherOptions.map(({ name, url }) => (
          <Link
            key={url}
            className="bg-secondary-background hover:bg-secondary-background/50 rounded-md py-4 text-center text-lg text-secondary-text"
            to={url}
          >
            {name}
          </Link>
        ))}
      </div>
    </div>
  );
};
