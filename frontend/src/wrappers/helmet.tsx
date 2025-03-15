import React from "react";
import { Helmet } from "react-helmet";
import { getClientConfig } from "../client/client-config/get-client-config";

export const HelmetSetter: React.FC = () => {
  const { title, favicon } = getClientConfig();
  return (
    <Helmet>
      <title>{title}</title>
      <link
        rel="icon"
        href={`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox='0 0 100 100'><text y='.9em' font-size='90'>${favicon}</text></svg>`}
      />
    </Helmet>
  );
};
