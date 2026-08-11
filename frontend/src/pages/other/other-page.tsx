import React from "react";
import { LinkListPage } from "../../common/link-list-page";

export const OtherPage: React.FC = () => {
  return (
    <LinkListPage
      title="Other"
      links={[
        { name: "Settings 🔧", url: "/settings" },
        { name: "Changelog 📜", url: "/changelog" },
        { name: "What changed ⏳", url: "/what-changed" },
        { name: "Performance testing ⏱️", url: "/performance" },
      ]}
    />
  );
};
