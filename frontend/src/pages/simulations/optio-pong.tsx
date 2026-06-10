import React from "react";

// The game is a self-contained HTML file served from /public.
// It is purely for fun and does not create or affect any data.
export const OptioPongPage: React.FC = () => {
  return (
    <iframe
      src={`${process.env.PUBLIC_URL}/optio-pong.html`}
      title="Optio Pong"
      className="fixed left-0 top-16 md:top-12 w-full h-[calc(100svh-4rem)] md:h-[calc(100svh-3rem)] border-0 bg-[#0c0d0f]"
    />
  );
};
