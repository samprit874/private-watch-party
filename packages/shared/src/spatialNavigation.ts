export const TV_KEY_CODES = {
  // D-Pad Directional Keys
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,

  // Selection / Activation
  ENTER: 13,

  // Back Keys across Smart TV platforms
  BACK_TIZEN: 10009, // Samsung Tizen Return / Back
  BACK_WEBOS: 461,   // LG webOS Back
  ESCAPE: 27,        // Standard browser escape
  BACKSPACE: 8,      // Legacy TV back

  // TV Media Remote Keys
  PLAY: 415,
  PAUSE: 19,
  PLAY_PAUSE: 179,
  STOP: 413,
  FAST_FORWARD: 417,
  REWIND: 412,
} as const;

export type TvDirection = 'up' | 'down' | 'left' | 'right';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FocusableElement {
  id: string;
  rect: Rect;
}

/**
 * Checks if a key code corresponds to a D-Pad directional navigation key.
 */
export function isTvDirectionKey(keyCode: number): TvDirection | null {
  switch (keyCode) {
    case TV_KEY_CODES.UP:
      return 'up';
    case TV_KEY_CODES.DOWN:
      return 'down';
    case TV_KEY_CODES.LEFT:
      return 'left';
    case TV_KEY_CODES.RIGHT:
      return 'right';
    default:
      return null;
  }
}

/**
 * Checks if a key code corresponds to a Smart TV Back / Return button.
 */
export function isTvBackKey(keyCode: number): boolean {
  return (
    keyCode === TV_KEY_CODES.BACK_TIZEN ||
    keyCode === TV_KEY_CODES.BACK_WEBOS ||
    keyCode === TV_KEY_CODES.ESCAPE ||
    keyCode === TV_KEY_CODES.BACKSPACE
  );
}

/**
 * Checks if a key code corresponds to a Smart TV Enter / OK button.
 */
export function isTvEnterKey(keyCode: number): boolean {
  return keyCode === TV_KEY_CODES.ENTER;
}

/**
 * 2D Euclidean Directional Navigation.
 * Finds the closest focusable element in the specified direction.
 * Uses primary axis distance + weighted orthogonal cross-axis penalty.
 */
export function findNextFocusElement(
  currentId: string,
  direction: TvDirection,
  elements: FocusableElement[]
): string {
  const current = elements.find((el) => el.id === currentId);
  if (!current) return currentId;

  const currentCx = current.rect.x + current.rect.width / 2;
  const currentCy = current.rect.y + current.rect.height / 2;

  let bestCandidateId = currentId;
  let bestScore = Infinity;

  for (const candidate of elements) {
    if (candidate.id === currentId) continue;

    const candCx = candidate.rect.x + candidate.rect.width / 2;
    const candCy = candidate.rect.y + candidate.rect.height / 2;

    const dx = candCx - currentCx;
    const dy = candCy - currentCy;

    let isCandidateInDirection = false;
    let primaryDist = 0;
    let orthoDist = 0;

    switch (direction) {
      case 'right':
        if (dx > 0) {
          isCandidateInDirection = true;
          primaryDist = dx;
          orthoDist = Math.abs(dy);
        }
        break;
      case 'left':
        if (dx < 0) {
          isCandidateInDirection = true;
          primaryDist = Math.abs(dx);
          orthoDist = Math.abs(dy);
        }
        break;
      case 'down':
        if (dy > 0) {
          isCandidateInDirection = true;
          primaryDist = dy;
          orthoDist = Math.abs(dx);
        }
        break;
      case 'up':
        if (dy < 0) {
          isCandidateInDirection = true;
          primaryDist = Math.abs(dy);
          orthoDist = Math.abs(dx);
        }
        break;
    }

    if (isCandidateInDirection) {
      // Score = primary distance + 2.5x orthogonal penalty to favor direct alignment
      const score = primaryDist + orthoDist * 2.5;
      if (score < bestScore) {
        bestScore = score;
        bestCandidateId = candidate.id;
      }
    }
  }

  return bestCandidateId;
}
