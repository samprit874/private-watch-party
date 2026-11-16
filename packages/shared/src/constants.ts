export const MAX_ROOM_PARTICIPANTS = 3;
export const ROOM_EXPIRY_HOURS = 24;
export const SESSION_COOKIE_NAME = '__Host-Session-Token';

export const DRIFT_THRESHOLDS = {
  DEADBAND_SEC: 0.20,
  MICRO_SLEW_SEC: 0.75,
  MODERATE_SLEW_SEC: 1.50,
  HARD_SEEK_SEC: 1.50,
} as const;

export const SLEW_RATES = {
  MICRO_UP: 1.02,
  MICRO_DOWN: 0.98,
  MODERATE_UP: 1.06,
  MODERATE_DOWN: 0.94,
} as const;
