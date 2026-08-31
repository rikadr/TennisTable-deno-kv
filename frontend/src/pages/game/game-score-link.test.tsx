import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { GameScoreLink } from "./game-score-link";

const CurrentLocation: React.FC = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
};

function renderLink(onRowClick?: () => void) {
  return render(
    <MemoryRouter initialEntries={["/season"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <div onClick={onRowClick}>
                <GameScoreLink playedAt={1700000000000}>3 - 1</GameScoreLink>
              </div>
              <CurrentLocation />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GameScoreLink", () => {
  it("opens the details page of the game", async () => {
    renderLink();

    await userEvent.click(screen.getByRole("button", { name: "3 - 1" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/game?time=1700000000000");
  });

  it("keeps the click away from the row around it", async () => {
    const onRowClick = jest.fn();
    renderLink(onRowClick);

    await userEvent.click(screen.getByRole("button", { name: "3 - 1" }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
