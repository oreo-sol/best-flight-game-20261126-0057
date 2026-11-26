// Golden Hour Island Run — configuration: world layout, mission course, tuning.
// Every number here is original to this game. Units: metres, seconds, degrees.

export const GAME_NAME = 'Golden Hour Island Run';
export const GAME_TAGLINE = 'Thread the rings, mind the fuel, grease the landing.';

// --- World: one island in a wide sea, golden-hour light ----------------------
export const WORLD = {
  // Island centre and size (metres). Terrain height falls off with distance
  // from the centre, with a hill ridge along the north side.
  islandX: 0,
  islandZ: 0,
  islandRadius: 2600,
  seaLevel: 0,
  peakHeight: 260,
  // The airstrip sits on the flat south shore.
  runway: {
    x: 0, z: 1150,            // centre of the strip
    headingDeg: 0,           // strip runs north-south (toward -z on landing)
    length: 900, width: 46,
  },
};

// --- Mission: five golden rings then a landing on the strip -----------------
export const RINGS = [
  { x: -650, y: 270, z: 300, r: 42, name: 'RING 1 · COVE' },
  { x: 520, y: 240, z: -180, r: 42, name: 'RING 2 · RIDGE' },
  { x: 980, y: 190, z: -950, r: 38, name: 'RING 3 · CLIFF' },
  { x: -420, y: 210, z: -1450, r: 42, name: 'RING 4 · PEAK' },
  { x: -180, y: 300, z: 300, r: 40, name: 'RING 5 · HOME' },
];
export const RING_SCORE = 200;
export const LANDING_SCORE_MAX = 500;

// --- Flight model tuning -----------------------------------------------------
export const FLIGHT = {
  minSpeed: 26,          // m/s — below this the wing stops flying
  maxSpeed: 95,
  cruiseSpeed: 58,
  startSpeed: 55,
  throttleAccel: 14,     // m/s^2 at full throttle
  drag: 0.055,           // quadratic-ish drag coefficient
  pitchRate: 0.85,       // rad/s at full stick
  rollRate: 1.9,
  yawFromRoll: 0.55,     // coordinated-turn factor
  rudderYaw: 0.35,
  climbFromPitch: 0.9,
  gravitySink: 9.5,      // sink rate when slow, m/s
  fuelBurnBase: 0.55,    // %/s at cruise throttle
  fuelBurnThrottle: 1.15,
  startFuel: 100,
  startDamage: 0,
  crashSpeed: 78,        // vertical speed that breaks the plane on touchdown
  hardLandingSpeed: 26,
};

// --- Scoring -----------------------------------------------------------------
export const SCORE = {
  ring: 200,
  ringTimeBonusPerSec: 4,   // seconds under par add bonus
  parTimeSec: 150,
  landingPerfect: 500,
  landingGood: 300,
  landingRough: 120,
};

// --- Camera / rendering ------------------------------------------------------
export const VIEW = {
  fovDeg: 68,
  camDistance: 13,       // metres behind the aircraft
  camHeight: 3.2,
  terrainStep: 130,      // grid spacing in metres
  terrainAhead: 32,      // grid rows drawn ahead of the camera
  terrainSide: 18,       // grid columns either side
  farPlane: 3400,
};

// --- Golden-hour palette ------------------------------------------------------
export const PALETTE = {
  skyTop: '#2e4a7d',
  skyMid: '#e08a4e',
  skyHorizon: '#f7c873',
  sunCore: '#fff3c4',
  sunGlow: '#ffb347',
  seaDeep: '#1d4e6b',
  seaShallow: '#3f8ea6',
  sand: '#e8cf9a',
  grassLow: '#7da65a',
  grassHigh: '#4f7d43',
  rock: '#8a7a68',
  snow: '#e9e4d8',
  runway: '#3a3f46',
  runwayLine: '#f2ede0',
  hudAmber: '#ffc845',
  hudGreen: '#7dff9a',
  hudRed: '#ff5a4e',
  hudWhite: '#f5f1e6',
};
