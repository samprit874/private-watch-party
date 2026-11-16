import { describe, it, expect } from 'vitest';
import {
  TV_KEY_CODES,
  isTvBackKey,
  isTvEnterKey,
  isTvDirectionKey,
  findNextFocusElement,
  Rect,
  FocusableElement,
} from '@watchparty/shared';

describe('Smart TV Spatial Navigation', () => {
  describe('Remote Key Identification', () => {
    it('identifies D-Pad directional keys correctly', () => {
      expect(isTvDirectionKey(TV_KEY_CODES.UP)).toBe('up');
      expect(isTvDirectionKey(TV_KEY_CODES.DOWN)).toBe('down');
      expect(isTvDirectionKey(TV_KEY_CODES.LEFT)).toBe('left');
      expect(isTvDirectionKey(TV_KEY_CODES.RIGHT)).toBe('right');
      expect(isTvDirectionKey(999)).toBeNull();
    });

    it('identifies Smart TV Back keys across Tizen, webOS, and standard escape', () => {
      expect(isTvBackKey(TV_KEY_CODES.BACK_TIZEN)).toBe(true);
      expect(isTvBackKey(TV_KEY_CODES.BACK_WEBOS)).toBe(true);
      expect(isTvBackKey(TV_KEY_CODES.ESCAPE)).toBe(true);
      expect(isTvBackKey(TV_KEY_CODES.BACKSPACE)).toBe(true);
      expect(isTvBackKey(13)).toBe(false);
    });

    it('identifies Smart TV Enter / Select keys', () => {
      expect(isTvEnterKey(TV_KEY_CODES.ENTER)).toBe(true);
      expect(isTvEnterKey(27)).toBe(false);
    });
  });

  describe('2D Spatial Navigation Algorithm', () => {
    // 2x2 grid layout of elements
    // [A (10, 10)]   [B (110, 10)]
    // [C (10, 110)]  [D (110, 110)]
    const elements: FocusableElement[] = [
      { id: 'btn-a', rect: { x: 10, y: 10, width: 80, height: 40 } },
      { id: 'btn-b', rect: { x: 110, y: 10, width: 80, height: 40 } },
      { id: 'btn-c', rect: { x: 10, y: 110, width: 80, height: 40 } },
      { id: 'btn-d', rect: { x: 110, y: 110, width: 80, height: 40 } },
    ];

    it('navigates right to nearest horizontal neighbor', () => {
      const next = findNextFocusElement('btn-a', 'right', elements);
      expect(next).toBe('btn-b');
    });

    it('navigates down to nearest vertical neighbor', () => {
      const next = findNextFocusElement('btn-a', 'down', elements);
      expect(next).toBe('btn-c');
    });

    it('navigates left back to previous horizontal neighbor', () => {
      const next = findNextFocusElement('btn-b', 'left', elements);
      expect(next).toBe('btn-a');
    });

    it('navigates up back to previous vertical neighbor', () => {
      const next = findNextFocusElement('btn-c', 'up', elements);
      expect(next).toBe('btn-a');
    });

    it('stays on current element if no candidates exist in direction', () => {
      const next = findNextFocusElement('btn-a', 'left', elements);
      expect(next).toBe('btn-a');
    });

    it('prioritizes direct axis alignment over diagonal candidates', () => {
      // Element directly below vs diagonal right-down
      const customElements: FocusableElement[] = [
        { id: 'origin', rect: { x: 100, y: 100, width: 50, height: 50 } },
        { id: 'direct-below', rect: { x: 100, y: 200, width: 50, height: 50 } },
        { id: 'diagonal-below', rect: { x: 180, y: 190, width: 50, height: 50 } },
      ];

      const next = findNextFocusElement('origin', 'down', customElements);
      expect(next).toBe('direct-below');
    });
  });
});
