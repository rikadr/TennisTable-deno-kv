import React from "react";
import { LinkListPage } from "../../common/link-list-page";

export const ComparePage: React.FC = () => {
  return (
    <LinkListPage
      title="Compare"
      links={[
        { name: "Compare 1v1 👥🥊", url: "/1v1" },
        { name: "Compare all 📈", url: "/compare-players" },
      ]}
    />
  );
};
