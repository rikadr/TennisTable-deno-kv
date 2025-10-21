import { Link } from "react-router-dom";

export const ChooseAddOrTrack: React.FC = () => {
  return (
    <div className="min-h-screen p-4 flex justify-center">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary-text">Add Game</h1>
          <p className="text-base text-primary-text">Choose how you want to record your match</p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {/* Add Finished Game Option */}
          <Link to="/add-game-add" className="block">
            <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-blue-500">
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-3xl group-hover:bg-blue-500 transition-colors">
                    <span className="group-hover:scale-110 transition-transform">🤝</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                      Add Finished Game
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">Quick entry for completed matches</p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Divider */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 text-sm font-semibold text-gray-500 bg-gray-50 rounded-full">OR</span>
            </div>
          </div>

          {/* Track Live Game Option */}
          <Link to="/add-game-track" className="block">
            <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-purple-500">
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center text-3xl group-hover:bg-purple-500 transition-colors">
                    <span className="group-hover:scale-110 transition-transform">🏓</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                      Track Live Game
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">Score point-by-point in real-time</p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
