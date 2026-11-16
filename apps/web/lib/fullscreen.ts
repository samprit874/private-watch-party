/**
 * Fullscreen and Mobile Landscape Orientation helper.
 * Handles Android Chrome (screen.orientation.lock) and iOS Safari (webkitEnterFullscreen).
 */

export async function enterLandscapeFullscreen(
  container: HTMLElement | null,
  video?: HTMLVideoElement | null
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (container) {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        await (container as any).webkitRequestFullscreen();
      } else if (video && (video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
        return;
      }
    } else if (video && (video as any).webkitEnterFullscreen) {
      (video as any).webkitEnterFullscreen();
      return;
    }

    // Attempt orientation lock to landscape on mobile devices (requires active fullscreen)
    if (typeof screen !== 'undefined' && (screen.orientation as any)?.lock) {
      try {
        await (screen.orientation as any).lock('landscape');
      } catch {
        // Ignored on desktop or devices without orientation lock support
      }
    }
  } catch (err) {
    if (video && (video as any).webkitEnterFullscreen) {
      try {
        (video as any).webkitEnterFullscreen();
      } catch {}
    }
  }
}

export async function exitLandscapeFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;

  try {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      }
    }
  } catch {}

  try {
    if (typeof screen !== 'undefined' && (screen.orientation as any)?.unlock) {
      (screen.orientation as any).unlock();
    }
  } catch {}
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
}
