import React, { useState } from "react";
import { GameTableDTO, GameTablePlayer } from "./table-page";
import { classNames } from "../common/class-names";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../common/query-client";
type Coordinates = {
  x: number | undefined;
  y: number | undefined;
  setX: React.Dispatch<React.SetStateAction<number | undefined>>;
  setY: React.Dispatch<React.SetStateAction<number | undefined>>;
};

export const TennisTable: React.FC<{ gameTable: GameTableDTO }> = ({
  gameTable,
}) => {
  const [x, setX] = useState<number>();
  const [y, setY] = useState<number>();
  const coordinates: Coordinates = { x, y, setX, setY };
  return (
    <div
      onMouseOutCapture={() => {
        coordinates.setX(undefined);
        coordinates.setY(undefined);
      }}
      className="h-full w-full"
    >
      <HeaderRow coordinates={coordinates} gameTable={gameTable} />
      {gameTable.players.map((player, index) => (
        <ScoreRow
          key={index}
          y={index + 1}
          coordinates={coordinates}
          player={player}
          gameTable={gameTable}
        />
      ))}
    </div>
  );
};

export const RowWrapper: React.FC<{
  columns: number;
  children: React.ReactNode;
}> = ({ columns, children }) => {
  const minWidth = 120 * columns;
  const maxWidth = 200 * columns;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        minWidth: minWidth,
        maxWidth: maxWidth,
      }}
    >
      {children}
    </div>
  );
};

export const Cell: React.FC<{
  x: number;
  y: number;
  coordinates: Coordinates;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ x, y, coordinates, onClick, children }) => {
  const [pressed, setPressed] = useState(false);
  const isOnDiagonal = x === y;
  const isSelectedOnDiagonal = coordinates.x === coordinates.y;

  const xIsDefined = coordinates.x !== undefined;
  const yIsDefined = coordinates.y !== undefined;
  const isMouseOnTable = xIsDefined && yIsDefined;

  const xIsOn = xIsDefined && coordinates.x === x;
  const yIsOn = yIsDefined && coordinates.y === y;
  const isSelected = xIsOn && yIsOn;
  const isNotInCross = !xIsOn && !yIsOn;
  const isTwinToSelectedCell =
    isMouseOnTable && x === coordinates.y && y === coordinates.x;

  function handleClick() {
    onClick && onClick();
    setPressed(false);
  }

  return (
    <div
      onMouseOverCapture={() => {
        coordinates.setX(x);
        coordinates.setY(y);
      }}
      onMouseLeave={() => setPressed(false)}
      onClick={() => (!pressed ? setPressed(!!onClick) : handleClick())}
      className={classNames(
        "relative w-42 h-16 select-none flex-1",
        "flex items-center justify-center",
        "border-[0.5px]",
        "transition-all duration-150",
        !!onClick && "cursor-pointer",
        ((!xIsOn && !yIsOn) || isSelectedOnDiagonal) && "border-slate-500/30",
        isMouseOnTable &&
          isNotInCross &&
          !isTwinToSelectedCell &&
          !isSelectedOnDiagonal &&
          "text-white/50",
        xIsOn && !isSelectedOnDiagonal && "border-x-2 border-slate-500/100",
        yIsOn && !isSelectedOnDiagonal && "border-y-2 border-slate-500/100",
        (isSelected || isTwinToSelectedCell) &&
          !isOnDiagonal &&
          !pressed &&
          "bg-slate-500",
        isSelected && "z-50",
        pressed && "scale-125 ring-4 ring-white bg-emerald-600 rounded-lg"
      )}
    >
      {!!onClick && isSelected && (
        <p className="absolute top-0 text-[10px]">Click to +</p>
      )}
      {pressed && (
        <p className="absolute bottom-0 text-[10px]">Are you sure?</p>
      )}
      {!isOnDiagonal && children}
    </div>
  );
};

export const HeaderRow: React.FC<{
  coordinates: Coordinates;
  gameTable: GameTableDTO;
}> = ({ coordinates, gameTable }) => {
  return (
    <RowWrapper columns={gameTable.players.length + 1}>
      <div className="flex flex-col items-center justify-center">
        <div>Winner ➡️</div>
        <div>Loser ⬇️</div>
      </div>
      {gameTable.players.map((player, index) => (
        <HeaderCell
          key={index}
          x={index + 1}
          y={0}
          coordinates={coordinates}
          player={player}
        />
      ))}
    </RowWrapper>
  );
};

export const ScoreRow: React.FC<{
  y: number;
  coordinates: Coordinates;
  player: GameTablePlayer;
  gameTable: GameTableDTO;
}> = ({ y, coordinates, player, gameTable }) => {
  const gameMutation = useMutation<
    {
      winner: string;
      loser: string;
      time: number;
    },
    Error,
    { winner: string; loser: string },
    unknown
  >({
    mutationFn: async ({ winner, loser }) => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          winner,
          loser,
        }),
      }).then(
        async (response) =>
          response.json() as Promise<{
            winner: string;
            loser: string;
            time: number;
          }>
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-table"] });
    },
  });
  return (
    <RowWrapper columns={gameTable.players.length + 1}>
      <HeaderCell x={0} y={y} coordinates={coordinates} player={player} />
      {gameTable.players.map((oponent, index) => {
        const cellScore =
          oponent.wins.find((win) => win.oponent === player.name)?.count || 0;
        function handleClick() {
          gameMutation.mutate({ winner: oponent.name, loser: player.name });
        }
        return (
          <ScoreCell
            key={index}
            x={index + 1}
            y={y}
            coordinates={coordinates}
            onClick={handleClick}
            score={cellScore}
          />
        );
      })}
    </RowWrapper>
  );
};
export const HeaderCell: React.FC<{
  x: number;
  y: number;
  coordinates: Coordinates;
  player: GameTablePlayer;
}> = ({ x, y, coordinates, player }) => {
  return (
    <Cell x={x} y={y} coordinates={coordinates}>
      <div>
        <h3>
          {player.name}{" "}
          <span className="font-thin text-slate-400">#{x !== 0 ? x : y}</span>
        </h3>
        <p>
          {player.elo.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
        </p>
      </div>
    </Cell>
  );
};
export const ScoreCell: React.FC<{
  x: number;
  y: number;
  coordinates: Coordinates;
  onClick?: () => void;
  score: number;
}> = ({ x, y, coordinates, onClick, score }) => {
  return (
    <Cell
      x={x}
      y={y}
      coordinates={coordinates}
      onClick={x !== y ? onClick : undefined}
    >
      <span className="text-xl">
        {score.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
      </span>
    </Cell>
  );
};
