import { describe, it, expect } from 'vitest';
import { 
  calculateNtpOffset, 
  computeExpectedPosition, 
  computeDriftCorrection 
} from '@watchparty/shared';

describe('Playback Sync & Clock Math', () => {
  it('calculates NTP RTT and offset correctly', () => {
    // Client sends at 1000, Server receives & replies at 2050, Client receives at 1100
    // RTT = 1100 - 1000 = 100ms
    // Est client time when server replied = 1000 + 50 = 1050ms
    // Offset = 2050 - 1050 = +1000ms
    const result = calculateNtpOffset(1000, 2050, 1100);
    expect(result.rtt).toBe(100);
    expect(result.offset).toBe(1000);
  });

  it('computes expected position correctly during playing and paused state', () => {
    const anchor = {
      position: 10.0,
      status: 'playing' as const,
      basePlaybackRate: 1.5,
      serverTimestamp: 5000,
    };

    // Client at 4000ms with +1000ms offset -> effective server time = 5000ms (0 elapsed)
    expect(computeExpectedPosition(anchor, 4000, 1000)).toBe(10.0);

    // Client at 6000ms with +1000ms offset -> effective server time = 7000ms (2s elapsed)
    // 10.0 + 2.0 * 1.5 = 13.0
    expect(computeExpectedPosition(anchor, 6000, 1000)).toBe(13.0);

    // Paused anchor always returns static position regardless of elapsed time
    const pausedAnchor = { ...anchor, status: 'paused' as const };
    expect(computeExpectedPosition(pausedAnchor, 8000, 1000)).toBe(10.0);
  });

  describe('Drift Correction Slew Boundaries', () => {
    const baseRate = 1.0;

    it('remains in deadband when |drift| < 0.20s', () => {
      // 100ms drift ahead
      const res1 = computeDriftCorrection(10.10, 10.00, baseRate);
      expect(res1.action).toBe('deadband');
      expect(res1.effectiveRate).toBe(1.0);

      // 150ms drift behind
      const res2 = computeDriftCorrection(9.85, 10.00, baseRate);
      expect(res2.action).toBe('deadband');
      expect(res2.effectiveRate).toBe(1.0);
    });

    it('applies micro-slew (±2%) when 0.20s <= |drift| < 0.75s', () => {
      // Leading by 300ms -> slew down to 0.98x
      const resLead = computeDriftCorrection(10.30, 10.00, baseRate);
      expect(resLead.action).toBe('micro_slew');
      expect(resLead.effectiveRate).toBe(0.98);

      // Lagging by 400ms -> slew up to 1.02x
      const resLag = computeDriftCorrection(9.60, 10.00, baseRate);
      expect(resLag.action).toBe('micro_slew');
      expect(resLag.effectiveRate).toBe(1.02);

      // Preserves non-1.0 base rates (e.g. 1.5x * 0.98 = 1.47x)
      const res15 = computeDriftCorrection(10.30, 10.00, 1.5);
      expect(res15.action).toBe('micro_slew');
      expect(res15.effectiveRate).toBe(1.47);
    });

    it('applies moderate slew (±6%) when 0.75s <= |drift| < 1.50s', () => {
      // Leading by 1.0s -> slew down to 0.94x
      const resLead = computeDriftCorrection(11.00, 10.00, baseRate);
      expect(resLead.action).toBe('moderate_slew');
      expect(resLead.effectiveRate).toBe(0.94);

      // Lagging by 1.2s -> slew up to 1.06x
      const resLag = computeDriftCorrection(8.80, 10.00, baseRate);
      expect(resLag.action).toBe('moderate_slew');
      expect(resLag.effectiveRate).toBe(1.06);
    });

    it('triggers hard seek when |drift| >= 1.50s', () => {
      const res = computeDriftCorrection(12.50, 10.00, baseRate);
      expect(res.action).toBe('hard_seek');
      expect(res.effectiveRate).toBe(baseRate);
    });
  });
});
