/**
 * A table tennis rally, solved rather than animated.
 *
 * The rally runs as a loop of four stages: the left side hits the ball, the ball
 * bounces once on the right half, the right side hits it, the ball bounces once on
 * the left half. Each stroke is planned on its own, so the speed, the arc and the
 * bounce point change from stroke to stroke.
 *
 * The model is constant gravity and one restitution value. No drag and no spin.
 * A stroke picks a horizontal speed and a bounce point, then solves for the launch
 * angle that makes the ball meet the table exactly there. Solving the angle instead
 * of choosing it keeps the speed and the arc tied together the way they are on a
 * real table: a fast stroke comes through low over the net and lands deep, and a
 * slow stroke has to be lifted and loops.
 *
 * All lengths are in the drawing units of the loader, not in centimetres.
 */

/** The court, in drawing units. The frame is 200 wide and spans y 14 to 106. */
export const RALLY = {
  /** Downwards, since y grows downwards. */
  gravity: 900,
  /** The share of vertical speed the table gives back on the bounce. */
  restitution: 0.72,
  ballRadius: 4,
  tableY: 88,
  tableX0: 26,
  tableX1: 174,
  netX: 100,
  netTop: 70,
  /** Where each side makes contact, just off each end of the table. */
  leftX: 22,
  rightX: 178,
  /** The band of contact heights a player can return. */
  hitHighest: 30,
  hitLowest: 78,
  /** The ball stays inside the frame. */
  apexHighest: 20,
} as const;

/** The height of the ball's centre when it touches the table. */
export const CONTACT_Y = RALLY.tableY - RALLY.ballRadius;

/** The ball must pass this high over the net, with a little to spare. */
const NET_CLEARANCE_Y = RALLY.netTop - RALLY.ballRadius - 1;

/** How far into the far half the bounce must land, so it never clips the net. */
const BOUNCE_MARGIN = 16;

/** 1 plays left to right, -1 plays right to left. */
export type Direction = 1 | -1;

export type Point = { x: number; y: number };

/** A source of numbers in [0, 1). Injected so the tests can drive it. */
export type Random = () => number;

/** One stroke: the flight from a bat, over the net, off the table, to the far bat. */
export type Stroke = {
  readonly direction: Direction;
  /** Where the bat made contact. */
  readonly x0: number;
  readonly y0: number;
  readonly velocityX: number;
  readonly velocityY: number;
  /** Time from the bat to the bounce. */
  readonly bounceTime: number;
  readonly bounceX: number;
  /** Vertical speed leaving the bounce. */
  readonly reboundVelocityY: number;
  /** Time from the bounce to the far bat. */
  readonly returnTime: number;
  /** The whole flight, bat to bat. */
  readonly duration: number;
  /** Where the far side makes contact. */
  readonly targetX: number;
  readonly targetY: number;
  /** Read out by the loader for nothing, and by the tests for everything. */
  readonly apexY: number;
  readonly speed: number;
};

function farBatX(direction: Direction): number {
  return direction > 0 ? RALLY.rightX : RALLY.leftX;
}

/**
 * Build a stroke from a horizontal speed and a bounce distance, with no checking.
 * The launch angle is solved so the ball meets the table exactly at the bounce.
 */
function solve(direction: Direction, x0: number, y0: number, speed: number, distance: number): Stroke {
  const velocityX = direction * speed;
  const bounceX = x0 + direction * distance;
  const bounceTime = distance / speed;

  const velocityY = (CONTACT_Y - y0 - 0.5 * RALLY.gravity * bounceTime * bounceTime) / bounceTime;
  const apexY = velocityY < 0 ? y0 - (velocityY * velocityY) / (2 * RALLY.gravity) : y0;

  const reboundVelocityY = -RALLY.restitution * (velocityY + RALLY.gravity * bounceTime);
  const targetX = farBatX(direction);
  const returnTime = (targetX - bounceX) / velocityX;
  const targetY = CONTACT_Y + reboundVelocityY * returnTime + 0.5 * RALLY.gravity * returnTime * returnTime;

  return {
    direction,
    x0,
    y0,
    velocityX,
    velocityY,
    bounceTime,
    bounceX,
    reboundVelocityY,
    returnTime,
    duration: bounceTime + returnTime,
    targetX,
    targetY,
    apexY,
    speed: Math.round(speed),
  };
}

/**
 * A stroke is playable when the ball clears the net, bounces once on the correct
 * half, stays above the table until it reaches the far bat, and arrives at a height
 * the far side can return.
 */
function isPlayable(stroke: Stroke): boolean {
  const { direction, x0, y0, velocityX, velocityY, bounceTime, bounceX } = stroke;

  if (stroke.apexY < RALLY.apexHighest) return false;

  if (direction > 0 && (bounceX < RALLY.netX + BOUNCE_MARGIN || bounceX > RALLY.tableX1 - 4)) return false;
  if (direction < 0 && (bounceX > RALLY.netX - BOUNCE_MARGIN || bounceX < RALLY.tableX0 + 4)) return false;

  const netTime = (RALLY.netX - x0) / velocityX;
  if (netTime <= 0 || netTime >= bounceTime) return false;
  const netY = y0 + velocityY * netTime + 0.5 * RALLY.gravity * netTime * netTime;
  if (netY > NET_CLEARANCE_Y) return false;

  if (stroke.returnTime < 0.1) return false;
  // The ball would land a second time before reaching the far bat.
  if ((2 * -stroke.reboundVelocityY) / RALLY.gravity <= stroke.returnTime) return false;

  return stroke.targetY >= RALLY.hitHighest && stroke.targetY <= RALLY.hitLowest;
}

/**
 * Plan the next stroke from where the last one arrived.
 *
 * `variation` runs from 0 to 1 and widens the range the speed and the bounce point
 * are drawn from. A plan that is not playable is thrown away and drawn again, which
 * normally takes one to four tries.
 */
export function planStroke(
  direction: Direction,
  x0: number,
  y0: number,
  variation: number,
  random: Random = Math.random,
): Stroke {
  const speedSpread = 45 + 115 * variation;
  const distanceSpread = 8 + 22 * variation;

  const attempt = (speedLow: number, speedHigh: number, distanceLow: number, distanceHigh: number): Stroke => {
    const speed = speedLow + random() * (speedHigh - speedLow);
    const distance = distanceLow + random() * (distanceHigh - distanceLow);
    return solve(direction, x0, y0, speed, distance);
  };

  for (let i = 0; i < 40; i++) {
    const stroke = attempt(
      Math.max(120, 235 - speedSpread),
      235 + speedSpread,
      112 - distanceSpread,
      112 + distanceSpread,
    );
    if (isPlayable(stroke)) return stroke;
  }
  // Widen the search before giving up.
  for (let i = 0; i < 80; i++) {
    const stroke = attempt(120, 400, 94, 136);
    if (isPlayable(stroke)) return stroke;
  }
  // Neither search found anything, which no measured rally has ever needed. Fall back
  // to a stroke from a contact height that is known to work, so a rally never stalls.
  return FALLBACK_STROKE(direction, x0);
}

/**
 * The last resort. Held apart so a test can check it is playable from both bats.
 * It ignores the arriving height, so the ball would step; that is the price of
 * always having a stroke to play.
 */
export const FALLBACK_STROKE = (direction: Direction, x0: number): Stroke => solve(direction, x0, 58, 210, 112);

/** Exposed so the tests can check the same rule the planner applies. */
export const isStrokePlayable = isPlayable;

/** Where the ball is `time` seconds after the bat, written into `out`. */
export function positionAt(stroke: Stroke, time: number, out: Point): Point {
  if (time <= stroke.bounceTime) {
    out.x = stroke.x0 + stroke.velocityX * time;
    out.y = stroke.y0 + stroke.velocityY * time + 0.5 * RALLY.gravity * time * time;
  } else {
    const afterBounce = time - stroke.bounceTime;
    out.x = stroke.bounceX + stroke.velocityX * afterBounce;
    out.y = CONTACT_Y + stroke.reboundVelocityY * afterBounce + 0.5 * RALLY.gravity * afterBounce * afterBounce;
  }
  return out;
}
