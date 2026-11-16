'use client';

import {
  TV_KEY_CODES,
  TvDirection,
  isTvBackKey,
  isTvEnterKey,
  isTvDirectionKey,
  findNextFocusElement,
  FocusableElement,
} from '@watchparty/shared';

export { TV_KEY_CODES, isTvBackKey, isTvEnterKey, isTvDirectionKey };

export class DOMSpatialNavigator {
  private activeId: string | null = null;
  private onSelectCallback?: (id: string) => void;
  private onBackCallback?: () => void;

  constructor(options?: {
    onSelect?: (id: string) => void;
    onBack?: () => void;
  }) {
    this.onSelectCallback = options?.onSelect;
    this.onBackCallback = options?.onBack;
  }

  public getActiveId(): string | null {
    return this.activeId;
  }

  public setActiveId(id: string): void {
    this.activeId = id;
    const el = document.getElementById(id);
    if (el) {
      el.focus();
    }
  }

  /**
   * Queries all elements on the page marked with [data-tv-nav="true"]
   * and computes their bounding boxes.
   */
  public getFocusableElements(): FocusableElement[] {
    if (typeof document === 'undefined') return [];

    const nodes = document.querySelectorAll<HTMLElement>('[data-tv-nav="true"]');
    const elements: FocusableElement[] = [];

    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      // Ensure element is visible and has an id
      if (rect.width > 0 && rect.height > 0 && node.id) {
        elements.push({
          id: node.id,
          rect: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
        });
      }
    });

    return elements;
  }

  /**
   * Handles keyboard events from TV remote or arrow keys.
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    const keyCode = e.keyCode || e.which;

    if (isTvBackKey(keyCode)) {
      if (this.onBackCallback) {
        this.onBackCallback();
        return true;
      }
    }

    if (isTvEnterKey(keyCode)) {
      if (this.activeId) {
        const el = document.getElementById(this.activeId);
        if (el) {
          el.click();
        }
        if (this.onSelectCallback) {
          this.onSelectCallback(this.activeId);
        }
        return true;
      }
    }

    const direction = isTvDirectionKey(keyCode);
    if (direction) {
      e.preventDefault();
      const elements = this.getFocusableElements();
      if (elements.length === 0) return false;

      if (!this.activeId || !elements.some((el) => el.id === this.activeId)) {
        this.setActiveId(elements[0].id);
        return true;
      }

      const nextId = findNextFocusElement(this.activeId, direction, elements);
      if (nextId && nextId !== this.activeId) {
        this.setActiveId(nextId);
        return true;
      }
    }

    return false;
  }
}
