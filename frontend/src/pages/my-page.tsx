import { session } from "../services/auth";

export const MyPage: React.FC = () => {
  const { sessionData, isAuthenticated } = session;
  if (!isAuthenticated || !sessionData) {
    return <div>Not authenticated</div>;
  }

  return (
    <div className="text-primary-text">
      <h1>My Page</h1>
      <p>Nothing here at the moment. Feel free to come with suggestions of what logged in players could do :) </p>
      <div className="w-56 shadow bg-secondary-background rounded-md m-2 flex-col flex items-center justify-between px-2 py-3">
        <div className="flex flex-col items-center">
          <div className="rounded-full h-20 w-20 my-2 ring ring-secondary-text shadow bg-gradient-to-t from-secondary-background to-primary-background transition-all overflow-hidden">
            <img src={`https://robohash.org/${sessionData.username}.png`} alt="profile" />
          </div>
          <h2 className="text-secondary-text">{sessionData?.username}</h2>
        </div>
      </div>
      <pre className="p-4">{JSON.stringify(sessionData, null, 2)}</pre>
    </div>
  );
};
