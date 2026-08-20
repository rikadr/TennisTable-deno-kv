import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BadSide } from "./table-sides";
import { TableSideDisplay } from "./table-sides-display";

function renderDisplay(params: {
  badSide: BadSide;
  currentSet?: { player1: number; player2: number };
  onSelect?: (badSide: BadSide) => void;
}) {
  return render(
    <TableSideDisplay
      currentSet={params.currentSet ?? { player1: 0, player2: 0 }}
      badSide={params.badSide}
      player1Name="Ada"
      player2Name="Bo"
      player1Color="#112233"
      player2Color="#445566"
      onSelect={params.onSelect}
    />,
  );
}

describe("TableSideDisplay", () => {
  it("selects the player who has the bad side", async () => {
    const onSelect = jest.fn();
    renderDisplay({ badSide: null, onSelect });

    await userEvent.click(screen.getByRole("button", { name: "Bo" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("selects 2 equally good sides", async () => {
    const onSelect = jest.fn();
    renderDisplay({ badSide: null, onSelect });

    await userEvent.click(screen.getByRole("button", { name: "Equal" }));
    expect(onSelect).toHaveBeenCalledWith("neutral");
  });

  it("puts Equal between the 2 players", () => {
    renderDisplay({ badSide: null, onSelect: jest.fn() });

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Ada", "Equal", "Bo"]);
  });

  it("removes the record when the selected option is pressed again", async () => {
    const onSelect = jest.fn();
    renderDisplay({ badSide: 1, onSelect });

    await userEvent.click(screen.getByRole("button", { name: "Ada" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("locks the side and names it when the set has a point", () => {
    renderDisplay({ badSide: 1, currentSet: { player1: 0, player2: 1 }, onSelect: jest.fn() });

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("🚧 Ada on the bad side")).toBeInTheDocument();
  });

  it("says that a locked set has no side", () => {
    renderDisplay({ badSide: null, currentSet: { player1: 1, player2: 0 }, onSelect: jest.fn() });

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("🚧 No bad side recorded for this set")).toBeInTheDocument();
  });

  it("shows no selector at all without a select handler", () => {
    renderDisplay({ badSide: "neutral" });

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("🚧 Equal sides")).toBeInTheDocument();
  });
});
