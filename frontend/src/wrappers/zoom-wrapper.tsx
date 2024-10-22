import { useLocalStorage } from "usehooks-ts";
import { classNames } from "../common/class-names";

type Props = {
  children: React.ReactNode;
};

export const ZoomWrapper: React.FC<Props> = ({ children }) => {
  const [zoomLevel, setZoomLevel] = useLocalStorage("app-zoom-level", 1);

  const showZoomControls = window.location.pathname === "/debug";

  return (
    <div className="relative" style={{ zoom: zoomLevel }}>
      <div className={classNames("absolute top-4 right-4 flex gap-2", showZoomControls === false && "hidden")}>
        <p>App zoom level: {Math.round(zoomLevel * 100)}%</p>
        <button
          className="px-4 py-1 rounded-md bg-blue-500 hover:bg-blue-700"
          onClick={() => setZoomLevel(zoomLevel + 0.1)}
        >
          +
        </button>
        <button
          className="px-4 py-1 rounded-md bg-blue-500 hover:bg-blue-700"
          onClick={() => setZoomLevel(zoomLevel - 0.1)}
        >
          -
        </button>
        <button className="px-4 py-1 rounded-md bg-blue-500 hover:bg-blue-700" onClick={() => setZoomLevel(1)}>
          Reset
        </button>
      </div>
      {children}
    </div>
  );
};
