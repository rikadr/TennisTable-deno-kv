export const StepPlayerName: React.FC<{
  playerName: string;
  setPlayerName: (name: string) => void;
  errorMessage?: string;
  onSubmit: () => void;
}> = ({ playerName, setPlayerName, errorMessage, onSubmit }) => (
  <div className="space-y-6 max-w-md mx-auto">
    <div className="text-center space-y-1">
      <h2 className="text-xl font-bold text-primary-text">What is the name of the player?</h2>
      <p className="text-sm text-primary-text/70">You can change the name later.</p>
    </div>

    <div className="space-y-2">
      <label htmlFor="playerName" className="block text-sm font-medium text-primary-text">
        Player name
      </label>
      <input
        id="playerName"
        type="text"
        autoFocus
        autoComplete="off"
        className="w-full text-lg text-black ring-1 ring-primary-text rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-text/50 transition-all"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Enter player name"
      />
      {errorMessage && playerName.length > 0 ? (
        <p className="text-sm text-red-600 bg-white px-3 py-2 rounded-md border border-red-900/50">{errorMessage}</p>
      ) : (
        <p className="text-xs text-primary-text/70">The first letter must be uppercase.</p>
      )}
    </div>
  </div>
);
