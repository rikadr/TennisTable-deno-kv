import React from "react";
import { Link } from "react-router-dom";

type LinkListPageProps = {
  title: string;
  links: { name: string; url: string }[];
};

// Shared hub page: a title over a vertical list of link buttons.
// max-w-full keeps the fixed-width list inside small viewports.
export const LinkListPage: React.FC<LinkListPageProps> = ({ title, links }) => {
  return (
    <div className="flex flex-col items-center bg-primary-background rounded-lg p-4 w-fit max-w-full m-auto">
      <h1 className="mb-6 text-2xl text-primary-text">{title}</h1>
      <div className="flex flex-col gap-4 w-96 max-w-full">
        {links.map(({ name, url }) => (
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
