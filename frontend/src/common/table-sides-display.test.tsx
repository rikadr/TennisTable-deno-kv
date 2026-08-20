import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BadSide } from "./table-sides";
import { TableSideSelector } from "./table-sides-display";

function renderSelector(badSide: BadSide, onSelect: (badSide: BadSide) => void) {
  return render(
    <TableSideSelector
      badSide={badSide}
      player1Name="Ada"
      player2Name="Bo"
      player1Color="#112233"
      player2Color="#445566"
      onSelect={onSelect}
    />,
  );
}

describe("TableSideSelector", () => {
  it("selects the player who has the bad side", async () => {
    const onSelect = jest.fn();
    renderSelector(null, onSelect);

    await userEvent.click(screen.getByRole("button", { name: "Bo" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("selects 2 equally good sides", async () => {
    const onSelect = jest.fn();
    renderSelector(null, onSelect);

    await userEvent.click(screen.getByRole("button", { name: "Equal" }));
    expect(onSelect).toHaveBeenCalledWith("neutral");
  });

  it("removes the record when the selected option is pressed again", async () => {
    const onSelect = jest.fn();
    renderSelector(1, onSelect);

    await userEvent.click(screen.getByRole("button", { name: "Ada" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
