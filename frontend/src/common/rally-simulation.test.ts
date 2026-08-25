import {
  CONTACT_Y,
  Direction,
  FALLBACK_STROKE,
  Point,
  RALLY,
  Stroke,
  isStrokePlayable,
  planStroke,
  positionAt,
} from "./rally-simulation";

const NET_CLEARANCE_Y = RALLY.netTop - RALLY.ballRadius;

/** Play a rally and hand back every stroke in it, exactly as the loader does. */
function playRally(strokeCount: number, variation: number, random?: () => number): Stroke[] {
  const strokes: Stroke[] = [];
  let direction: Direction = 1;
  let x: number = RALLY.leftX;
  let y = 60;

  for (let i = 0; i < strokeCount; i++) {
    const stroke = planStroke(direction, x, y, variation, random);
    strokes.push(stroke);
    direction = stroke.direction > 0 ? -1 : 1;
    x = stroke.targetX;
    y = stroke.targetY;
  }
  return strokes;
}

/** The height of the ball as it passes the net, derived from the flight itself. */
function heightAtNet(stroke: Stroke): number {
  const time = (RALLY.netX - stroke.x0) / stroke.velocityX;
  return positionAt(stroke, time, { x: 0, y: 0 }).y;
}

describe("planStroke", () => {
  const variations = [0, 0.3, 0.7, 1];

  it.each(variations)("plays a legal rally at variation %p", (variation) => {
    const strokes = playRally(2000, variation);
    const point: Point = { x: 0, y: 0 };

    for (const stroke of strokes) {
      // The ball passes over the net rather than into it.
      expect(heightAtNet(stroke)).toBeLessThanOrEqual(NET_CLEARANCE_Y);

      // It bounces once, on the far half, and on the table.
      expect(stroke.direction * (stroke.bounceX - RALLY.netX)).toBeGreaterThan(0);
      expect(stroke.bounceX).toBeGreaterThanOrEqual(RALLY.tableX0);
      expect(stroke.bounceX).toBeLessThanOrEqual(RALLY.tableX1);
      expect(positionAt(stroke, stroke.bounceTime, point).y).toBeCloseTo(CONTACT_Y, 6);

      // It stays above the table from the bounce to the far bat.
      for (let step = 1; step < 20; step++) {
        const time = stroke.bounceTime + (stroke.returnTime * step) / 20;
        expect(positionAt(stroke, time, point).y).toBeLessThanOrEqual(CONTACT_Y + 1e-6);
      }

      // It arrives where the far side can return it.
      expect(stroke.targetY).toBeGreaterThanOrEqual(RALLY.hitHighest);
      expect(stroke.targetY).toBeLessThanOrEqual(RALLY.hitLowest);
      expect(positionAt(stroke, stroke.duration, point).x).toBeCloseTo(stroke.targetX, 6);

      // It stays inside the frame.
      expect(stroke.apexY).toBeGreaterThanOrEqual(RALLY.apexHighest);
    }
  });

  it("alternates sides and starts each stroke where the last one landed", () => {
    const strokes = playRally(500, 0.7);

    for (let i = 1; i < strokes.length; i++) {
      const previous = strokes[i - 1];
      const stroke = strokes[i];
      expect(stroke.direction).toBe(-previous.direction);
      expect(stroke.x0).toBe(previous.targetX);
      expect(stroke.y0).toBe(previous.targetY);
    }
  });

  it("varies the speed, the arc and the bounce point from stroke to stroke", () => {
    const strokes = playRally(2000, 0.7);
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

    expect(spread(strokes.map((s) => s.speed))).toBeGreaterThan(100);
    expect(spread(strokes.map((s) => RALLY.tableY - s.apexY))).toBeGreaterThan(20);
    expect(spread(strokes.map((s) => s.duration))).toBeGreaterThan(0.2);
    // A stroke lasts long enough to watch and short enough to keep the rally moving.
    for (const stroke of strokes) {
      expect(stroke.duration).toBeGreaterThan(0.3);
      expect(stroke.duration).toBeLessThan(1.5);
    }
  });

  it("still returns a playable stroke when every drawn plan fails", () => {
    // A random source stuck at one end makes all 120 attempts identical, so the
    // planner exhausts both searches and has to fall back.
    for (const stuck of [() => 0, () => 0.999999]) {
      for (const stroke of playRally(20, 0.7, stuck)) {
        expect(isStrokePlayable(stroke)).toBe(true);
      }
    }
  });

  it("has a fallback that is playable from either bat", () => {
    expect(isStrokePlayable(FALLBACK_STROKE(1, RALLY.leftX))).toBe(true);
    expect(isStrokePlayable(FALLBACK_STROKE(-1, RALLY.rightX))).toBe(true);
  });
});

describe("positionAt", () => {
  const stroke = planStroke(1, RALLY.leftX, 60, 0.7, () => 0.5);

  it("starts at the bat and ends at the far bat", () => {
    expect(positionAt(stroke, 0, { x: 0, y: 0 })).toEqual({ x: stroke.x0, y: stroke.y0 });

    const end = positionAt(stroke, stroke.duration, { x: 0, y: 0 });
    expect(end.x).toBeCloseTo(stroke.targetX, 6);
    expect(end.y).toBeCloseTo(stroke.targetY, 6);
  });

  it("is continuous across the bounce", () => {
    const before = positionAt(stroke, stroke.bounceTime - 1e-9, { x: 0, y: 0 });
    const after = positionAt(stroke, stroke.bounceTime + 1e-9, { x: 0, y: 0 });
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("moves at a constant horizontal speed", () => {
    const a = positionAt(stroke, 0.1, { x: 0, y: 0 }).x;
    const b = positionAt(stroke, 0.2, { x: 0, y: 0 }).x;
    expect(b - a).toBeCloseTo(stroke.velocityX * 0.1, 6);
  });

  it("rises to the apex and comes back down", () => {
    const timeToApex = -stroke.velocityY / RALLY.gravity;
    expect(positionAt(stroke, timeToApex, { x: 0, y: 0 }).y).toBeCloseTo(stroke.apexY, 6);
    expect(positionAt(stroke, timeToApex - 0.05, { x: 0, y: 0 }).y).toBeGreaterThan(stroke.apexY);
    expect(positionAt(stroke, timeToApex + 0.05, { x: 0, y: 0 }).y).toBeGreaterThan(stroke.apexY);
  });

  it("writes into the point it is given instead of allocating", () => {
    const point: Point = { x: 0, y: 0 };
    expect(positionAt(stroke, 0.2, point)).toBe(point);
  });
});
