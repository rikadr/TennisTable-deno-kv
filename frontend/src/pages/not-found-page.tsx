import { Link } from "react-router-dom";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="w-full flex flex-col items-center gap-6 pt-24 px-4 text-center">
      <h1 className="text-6xl">🏓</h1>
      <h2 className="text-3xl font-semibold text-primary-text">404 – Page not found</h2>
      <p className="text-primary-text/70">This page went out of bounds.</p>
      <Link
        to="/leader-board"
        className="px-6 py-3 rounded-lg bg-secondary-background text-secondary-text hover:opacity-80 transition-opacity"
      >
        Back to leaderboard
      </Link>
    </div>
  );
};
