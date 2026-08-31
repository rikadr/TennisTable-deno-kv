import { useEffect, useRef } from "react";
import { classNames } from "../../common/class-names";
import { clampCrop, Crop, displaySize, ImageSize } from "./crop-math";

/**
 * The square the upload keeps. The circle inside it is the part the app shows
 * on a round picture, and the 4 corners are dark to show what a round picture
 * cuts. The camera and the photo of the user both live in it, at the same
 * size, so nothing moves between the 2 steps.
 */
export const PhotoStage: React.FC<{
  /** The side of the stage in px, reported on each change of the size. */
  onSize: (size: number) => void;
  guide?: boolean;
  children: React.ReactNode;
}> = ({ onSize, guide = true, children }) => {
  const frameRef = useRef<HTMLDivElement>(null);

  // The crop math needs the real side of the stage. The stage changes size
  // with the window, and also while the layout of the page settles, so a
  // measure at the mount alone leaves the math on an old size: the photo then
  // misses a part of the stage, and the upload cuts an other square than the
  // user sees.
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const measure = () => onSize(element.clientWidth);
    measure();

    // jsdom has no ResizeObserver, and the window keeps the tests honest.
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onSize]);

  return (
    <div
      ref={frameRef}
      // shrink-0 keeps it square: a flex item shrinks along the column when
      // the screen is short, and a squashed stage makes the circle an ellipse.
      className="relative aspect-square shrink-0 overflow-hidden rounded-2xl bg-black shadow-lg"
      // Square, never wider than the column and never taller than the screen
      // has room for. The 2 steps keep the same size, so the photo stays where
      // the user framed it.
      style={{ width: "min(100%, 420px, 46vh)" }}
    >
      {children}
      {guide && (
        <div className="pointer-events-none absolute inset-0">
          {/* The dark corners are the shadow of the circle, so the circle is
              exactly the round picture the app shows. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)", outline: "2px solid rgba(255,255,255,0.85)" }}
          />
        </div>
      )}
    </div>
  );
};

/** The photo of the user in the stage, which the user drags and zooms. */
export const DraggablePhoto: React.FC<{
  imageUrl: string;
  imageSize: ImageSize;
  crop: Crop;
  stage: number;
  onCropChange: (update: (current: Crop) => Crop) => void;
}> = ({ imageUrl, imageSize, crop, stage, onCropChange }) => {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number>();
  const display = displaySize(imageSize, stage, crop.scale);

  function distanceBetweenPointers(): number {
    const [first, second] = Array.from(pointers.current.values());
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      pinchDistance.current = distanceBetweenPointers();
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // 2 fingers zoom, and 1 finger moves the photo.
    if (pointers.current.size >= 2 && pinchDistance.current) {
      const distance = distanceBetweenPointers();
      const factor = distance / pinchDistance.current;
      pinchDistance.current = distance;
      onCropChange((current) => clampCrop(imageSize, stage, { ...current, scale: current.scale * factor }));
      return;
    }

    const moveX = event.clientX - previous.x;
    const moveY = event.clientY - previous.y;
    onCropChange((current) =>
      clampCrop(imageSize, stage, {
        ...current,
        offsetX: current.offsetX + moveX,
        offsetY: current.offsetY + moveY,
      }),
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchDistance.current = undefined;
    }
  }

  return (
    <div
      className={classNames("absolute inset-0 touch-none", crop.scale > 1 ? "cursor-grab" : "cursor-move")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={(event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.06 : 1 / 1.06;
        onCropChange((current) => clampCrop(imageSize, stage, { ...current, scale: current.scale * factor }));
      }}
    >
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        className="absolute left-1/2 top-1/2 max-w-none select-none"
        style={{
          height: display.height,
          width: display.width,
          transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px))`,
        }}
      />
    </div>
  );
};
