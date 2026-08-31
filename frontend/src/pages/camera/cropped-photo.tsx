import { classNames } from "../../common/class-names";
import { Crop, displaySize, ImageSize, scaleCrop } from "./crop-math";

/**
 * The photo with the crop of the user, at the size and the shape the app uses.
 * It takes the stage the crop comes from, so a preview of 32 px shows the same
 * square as the stage of 400 px.
 */
export const CroppedPhoto: React.FC<{
  imageUrl: string;
  imageSize: ImageSize;
  crop: Crop;
  /** The size of the stage the crop was made on. */
  stage: number;
  size: number;
  shape?: "circle" | "rounded";
}> = ({ imageUrl, imageSize, crop, stage, size, shape = "circle" }) => {
  const previewCrop = scaleCrop(crop, stage, size);
  const display = displaySize(imageSize, size, previewCrop.scale);

  return (
    <div
      className={classNames(
        "relative overflow-hidden shrink-0 bg-black/60",
        shape === "circle" ? "rounded-full" : "rounded-lg",
      )}
      style={{ height: size, width: size }}
    >
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        className="absolute left-1/2 top-1/2 max-w-none select-none"
        style={{
          height: display.height,
          width: display.width,
          transform: `translate(calc(-50% + ${previewCrop.offsetX}px), calc(-50% + ${previewCrop.offsetY}px))`,
        }}
      />
    </div>
  );
};
