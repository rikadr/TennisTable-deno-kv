import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { classNames } from "../common/class-names";
import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

export const ZoomWrapper: React.FC<Props> = ({ children }) => {
  const [zoomLevel, setZoomLevel] = useLocalStorage("app-zoom-level", 1);
  const [sizeAdjustment, setSizeAdjustment] = useState(0);
  const windowSize = useWindowSize();

  useEffect(() => {
    if (windowSize.width && windowSize.width < 330) {
      setSizeAdjustment(-0.3);
    } else if (windowSize.width && windowSize.width < 350) {
      setSizeAdjustment(-0.25);
    } else if (windowSize.width && windowSize.width < 370) {
      setSizeAdjustment(-0.2);
    } else if (windowSize.width && windowSize.width < 400) {
      setSizeAdjustment(-0.15);
    } else if (windowSize.width && windowSize.width < 450) {
      setSizeAdjustment(-0.1);
    } else {
      setSizeAdjustment(0);
    }
  }, [windowSize.width]);

  const showZoomControls = window.location.pathname === "/log-in";

  return (
    <div className="relative" style={{ zoom: zoomLevel + sizeAdjustment }}>
      <div className={classNames("absolute top-20 right-4 flex gap-2 z-50", showZoomControls === false && "hidden")}>
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
