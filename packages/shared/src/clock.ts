import { DRIFT_THRESHOLDS, SLEW_RATES } from './constants.js';
import { PlaybackStatus } from './types.js';

export interface ClockSyncResult {
  rtt: number;
  offset: number;
}

/**
 * Computes round-trip time and clock offset using standard NTP 3-way handshake.
 */
export function calculateNtpOffset(
  tClientSend: number,
  tServer: number,
  tClientRecv: number
): ClockSyncResult {
  const rtt = tClientRecv - tClientSend;
  const offset = tServer - (tClientSend + rtt / 2);
  return { rtt, offset };
}

export interface PlaybackAnchor {
  position: number;
  status: PlaybackStatus;
  basePlaybackRate: number;
  serverTimestamp: number;
}

/**
 * Calculates authoritative expected position at clientNow given a calibrated clock offset.
 */
export function computeExpectedPosition(
  anchor: PlaybackAnchor,
  clientNow: number,
  clockOffset: number
): number {
  if (anchor.status === 'paused') {
    return anchor.position;
  }

  const effectiveServerTime = clientNow + clockOffset;
  const elapsedSeconds = Math.max(0, (effectiveServerTime - anchor.serverTimestamp) / 1000);
  return anchor.position + elapsedSeconds * anchor.basePlaybackRate;
}

export type SlewAction = 'deadband' | 'micro_slew' | 'moderate_slew' | 'hard_seek';

export interface DriftCorrection {
  drift: number;
  effectiveRate: number;
  action: SlewAction;
}

/**
 * Computes non-destructive speed correction preserving base playback rate.
 * Drift > 0: Viewer leads (ahead of host) -> Slew Down.
 * Drift < 0: Viewer lags (behind host) -> Slew Up.
 */
export function computeDriftCorrection(
  currentPosition: number,
  expectedPosition: number,
  baseRate: number
): DriftCorrection {
  const drift = currentPosition - expectedPosition;
  const absDrift = Math.abs(drift);

  if (absDrift < DRIFT_THRESHOLDS.DEADBAND_SEC) {
    return {
      drift,
      effectiveRate: baseRate,
      action: 'deadband',
    };
  }

  if (absDrift < DRIFT_THRESHOLDS.MICRO_SLEW_SEC) {
    const multiplier = drift > 0 ? SLEW_RATES.MICRO_DOWN : SLEW_RATES.MICRO_UP;
    return {
      drift,
      effectiveRate: Number((baseRate * multiplier).toFixed(4)),
      action: 'micro_slew',
    };
  }

  if (absDrift < DRIFT_THRESHOLDS.MODERATE_SLEW_SEC) {
    const multiplier = drift > 0 ? SLEW_RATES.MODERATE_DOWN : SLEW_RATES.MODERATE_UP;
    return {
      drift,
      effectiveRate: Number((baseRate * multiplier).toFixed(4)),
      action: 'moderate_slew',
    };
  }

  return {
    drift,
    effectiveRate: baseRate,
    action: 'hard_seek',
  };
}
