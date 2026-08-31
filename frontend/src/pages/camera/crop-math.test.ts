import { clampCrop, CENTERED, coverFactor, displaySize, scaleCrop, sourceRect } from "./crop-math";

const SQUARE = { width: 1000, height: 1000 };
const LANDSCAPE = { width: 2000, height: 1000 };
const PORTRAIT = { width: 600, height: 1200 };
const STAGE = 400;

describe("the photo in the stage", () => {
  it("covers the stage with the shortest side of the photo", () => {
    expect(coverFactor(SQUARE, STAGE)).toBe(0.4);
    expect(coverFactor(LANDSCAPE, STAGE)).toBe(0.4);
    expect(coverFactor(PORTRAIT, STAGE)).toBeCloseTo(400 / 600);

    expect(displaySize(LANDSCAPE, STAGE, 1)).toEqual({ width: 800, height: 400 });
    expect(displaySize(PORTRAIT, STAGE, 1)).toEqual({ width: 400, height: 800 });
  });

  it("takes the middle square of a photo that is not square", () => {
    expect(sourceRect(LANDSCAPE, STAGE, CENTERED)).toEqual({ x: 500, y: 0, size: 1000 });
    expect(sourceRect(PORTRAIT, STAGE, CENTERED)).toEqual({ x: 0, y: 300, size: 600 });
  });

  it("takes the whole photo when the photo is square and the zoom is 1", () => {
    expect(sourceRect(SQUARE, STAGE, CENTERED)).toEqual({ x: 0, y: 0, size: 1000 });
  });

  it("takes a smaller square as the zoom grows", () => {
    expect(sourceRect(SQUARE, STAGE, { ...CENTERED, scale: 2 })).toEqual({ x: 250, y: 250, size: 500 });
    expect(sourceRect(SQUARE, STAGE, { ...CENTERED, scale: 4 })).toEqual({ x: 375, y: 375, size: 250 });
  });
});

describe("the limits of the drag", () => {
  it("holds a square photo at the middle while it is not zoomed", () => {
    expect(clampCrop(SQUARE, STAGE, { scale: 1, offsetX: 120, offsetY: -80 })).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("lets a landscape photo move sideways, and not up or down", () => {
    expect(clampCrop(LANDSCAPE, STAGE, { scale: 1, offsetX: 150, offsetY: 90 })).toEqual({
      scale: 1,
      offsetX: 150,
      offsetY: 0,
    });
    // The photo is 800 wide on a stage of 400, so 200 is the end of it.
    expect(clampCrop(LANDSCAPE, STAGE, { scale: 1, offsetX: 900, offsetY: 0 }).offsetX).toBe(200);
  });

  it("keeps the zoom between 1 and 4", () => {
    expect(clampCrop(SQUARE, STAGE, { ...CENTERED, scale: 0.2 }).scale).toBe(1);
    expect(clampCrop(SQUARE, STAGE, { ...CENTERED, scale: 12 }).scale).toBe(4);
  });

  it("never leaves a part of the stage empty", () => {
    const image = { width: 1600, height: 900 };
    const crops = [
      { scale: 1, offsetX: 5000, offsetY: 5000 },
      { scale: 2.5, offsetX: -5000, offsetY: 5000 },
      { scale: 4, offsetX: 0, offsetY: -5000 },
    ];

    // A part of a pixel of float arithmetic is not an empty corner.
    const half = STAGE / 2 - 0.001;

    crops.forEach((crop) => {
      const clamped = clampCrop(image, STAGE, crop);
      const size = displaySize(image, STAGE, clamped.scale);
      // Each edge of the photo is outside the stage, or exactly on it.
      expect(size.width / 2 + clamped.offsetX).toBeGreaterThanOrEqual(half);
      expect(size.width / 2 - clamped.offsetX).toBeGreaterThanOrEqual(half);
      expect(size.height / 2 + clamped.offsetY).toBeGreaterThanOrEqual(half);
      expect(size.height / 2 - clamped.offsetY).toBeGreaterThanOrEqual(half);
    });
  });

  it("keeps the source square inside the photo", () => {
    const image = { width: 1600, height: 900 };
    [1, 1.7, 3, 4].forEach((scale) => {
      const rect = sourceRect(image, STAGE, { scale, offsetX: 9999, offsetY: -9999 });
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.size).toBeLessThanOrEqual(image.width + 0.001);
      expect(rect.y + rect.size).toBeLessThanOrEqual(image.height + 0.001);
    });
  });
});

describe("the same crop on a smaller stage", () => {
  it("moves the offsets with the size of the stage", () => {
    expect(scaleCrop({ scale: 2, offsetX: 40, offsetY: -20 }, 400, 100)).toEqual({
      scale: 2,
      offsetX: 10,
      offsetY: -5,
    });
  });

  it("shows the same square of the photo as the big stage", () => {
    const crop = { scale: 2.5, offsetX: 60, offsetY: -35 };
    const big = sourceRect(LANDSCAPE, 400, crop);
    const small = sourceRect(LANDSCAPE, 64, scaleCrop(crop, 400, 64));

    expect(small.x).toBeCloseTo(big.x);
    expect(small.y).toBeCloseTo(big.y);
    expect(small.size).toBeCloseTo(big.size);
  });
});
