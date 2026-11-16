/**
 * 24/7 Keep-Alive Service for Render Free Tier.
 * Periodically sends external HTTP pings to the public server and web endpoints
 * every 5 minutes to prevent Render's 15-minute inactivity spin-down.
 */
export function startKeepAliveService(intervalMs = 5 * 60 * 1000) {
  const serverUrl = 'https://watchparty-server-6a3v.onrender.com/health';
  const webUrl = 'https://watchparty-web-75ez.onrender.com';

  console.log(`[KeepAlive] 24/7 anti-sleep pinger active (interval: ${intervalMs / 1000}s)`);

  const ping = async () => {
    try {
      await fetch(serverUrl, { method: 'GET' }).catch(() => {});
      await fetch(webUrl, { method: 'GET' }).catch(() => {});
      console.log(`[KeepAlive] Ping dispatched to keep cloud services awake.`);
    } catch (err: any) {
      console.warn(`[KeepAlive] Ping notice:`, err?.message || err);
    }
  };

  // Initial delay before first ping
  setTimeout(ping, 15 * 1000);
  // Recurring interval every 5 minutes
  return setInterval(ping, intervalMs);
}
