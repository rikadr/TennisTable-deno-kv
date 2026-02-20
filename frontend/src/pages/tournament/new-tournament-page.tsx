import { Link } from "react-router-dom";

export const NewTournamentPage: React.FC = () => {
  return (
    <div className="max-w-96 mx-4 md:mx-10 space-y-4 text-primary-text">
      <h1>New tournament</h1>
      <p>Want to set up a tournament? Reach out to Rikard to set up a new tournament 🏆</p>
      <Link to="/tournament/list" className="inline-block mt-4 text-sm text-primary-text hover:underline">
        ← Back to tournaments
      </Link>
    </div>
  );
};
