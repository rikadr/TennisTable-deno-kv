import { session } from "../services/auth";

export const MyPage: React.FC = () => {
  const { sessionData, isAuthenticated } = session;
  if (!isAuthenticated || !sessionData) {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <h1>My Page</h1>
      <div className="w-56 border-b-2 border-r-2 shadow border-gray-500 bg-slate-700 rounded-md m-2 flex-col flex items-center justify-between px-2 py-3">
        <div className="flex flex-col items-center">
          <div className="rounded-full h-20 w-20 my-2 ring ring-slate-800 shadow bg-gradient-to-t from-red-800 to-slate-900 transition-all overflow-hidden">
            <img src={`https://robohash.org/${sessionData.username}.png`} alt="profile" />
          </div>
          <h2>{sessionData?.username}</h2>
        </div>
      </div>
      <pre className="p-4">{JSON.stringify(sessionData, null, 2)}</pre>
    </div>
  );
};
