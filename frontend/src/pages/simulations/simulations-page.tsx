import React from "react";
import { LinkListPage } from "../../common/link-list-page";

export const SimulationsPage: React.FC = () => {
  return (
    <LinkListPage
      title="Simulations"
      links={[
        { name: "Expected leaderboard 🥇🥈🥉", url: "expected-leaderboard" },
        { name: "Player network 🕸️", url: "/player-network" },
        { name: "Expected win/loss rate 🏆💔", url: "win-loss" },
        { name: "Numbered points 🔢🧮 (Experimental)", url: "individual-points" },
        { name: "Optio Pong 🏓👾 (Playable game)", url: "optio-pong" },
      ]}
    />
  );
};
