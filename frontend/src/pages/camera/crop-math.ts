/**
 * The geometry of the photo in the square stage. The stage is what the upload
 * keeps, and the circle inside it is what the app shows on a round picture.
 *
 * All of it is pure, so the drag, the zoom and the export agree on 1 model.
 */

/** A photo, in its own pixels. */
export type ImageSize = { width: number; height: number };

/** How the photo sits in the stage. Scale 1 covers the stage, more zooms in. */
export type Crop = { scale: number; offsetX: number; offsetY: number };

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const CENTERED: Crop = { scale: 1, offsetX: 0, offsetY: 0 };

/** The factor at which the shortest side of the photo covers the stage. */
export function coverFactor(image: ImageSize, stage: number): number {
  const shortestSide = Math.min(image.width, image.height);
  return shortestSide > 0 ? stage / shortestSide : 1;
}

/** The size of the photo on the screen, for the css of the stage. */
export function displaySize(image: ImageSize, stage: number, scale: number): { width: number; height: number } {
  const factor = coverFactor(image, stage) * scale;
  return { width: image.width * factor, height: image.height * factor };
}

/** Keeps the photo over the whole stage, so no corner of the stage is empty. */
export function clampCrop(image: ImageSize, stage: number, crop: Crop): Crop {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, crop.scale));
  const size = displaySize(image, stage, scale);
  const limitX = Math.max(0, (size.width - stage) / 2);
  const limitY = Math.max(0, (size.height - stage) / 2);

  // A limit of 0 gives -0 for a negative offset, which is the same place but
  // not the same value. The 0 keeps 1 value for the middle.
  const inLimit = (offset: number, limit: number) => Math.min(limit, Math.max(-limit, offset)) + 0;

  return { scale, offsetX: inLimit(crop.offsetX, limitX), offsetY: inLimit(crop.offsetY, limitY) };
}

/** The square of the photo the stage shows, in the pixels of the photo. */
export function sourceRect(image: ImageSize, stage: number, crop: Crop): { x: number; y: number; size: number } {
  const clamped = clampCrop(image, stage, crop);
  const factor = coverFactor(image, stage) * clamped.scale;
  const size = stage / factor;

  // The arithmetic of the limits can give a value a small part of a pixel
  // outside the photo, and canvas must get a square inside the photo.
  const inside = (value: number, length: number) => Math.min(Math.max(0, value), Math.max(0, length - size));

  return {
    x: inside(image.width / 2 - clamped.offsetX / factor - size / 2, image.width),
    y: inside(image.height / 2 - clamped.offsetY / factor - size / 2, image.height),
    size,
  };
}

/**
 * The same crop on a stage of an other size. The small previews use it to show
 * the photo as the app shows it, from the crop the user makes on the big stage.
 */
export function scaleCrop(crop: Crop, fromStage: number, toStage: number): Crop {
  const factor = fromStage > 0 ? toStage / fromStage : 1;
  return { scale: crop.scale, offsetX: crop.offsetX * factor, offsetY: crop.offsetY * factor };
}
