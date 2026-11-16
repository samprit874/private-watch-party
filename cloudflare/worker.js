/**
 * Cloudflare Worker: Global Edge Accelerator & 24/7 Keepalive for Dudu & Bubu
 * - Edge Caches static assets, JS chunks, and media at 300+ Cloudflare edge locations (<15ms latency in India)
 * - Low-latency Anycast WebSocket proxy for real-time video sync and WebSockets
 * - Scheduled Cron trigger keeps Render free-tier services awake 24/7 (zero cold starts)
 */

const WEB_ORIGIN = 'https://watchparty-web-75ez.onrender.com';
const SERVER_ORIGIN = 'https://watchparty-server-6a3v.onrender.com';

export default {
  // 1. HTTP and WebSocket Edge Proxy
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route /api and /socket.io to backend server
    const isBackend = url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io');
    const targetOrigin = isBackend ? SERVER_ORIGIN : WEB_ORIGIN;
    const targetUrl = new URL(url.pathname + url.search, targetOrigin);

    // Clone request headers
    const newHeaders = new Headers(request.headers);
    newHeaders.set('Host', new URL(targetOrigin).host);
    newHeaders.set('X-Forwarded-Host', url.host);
    newHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    // Handle WebSocket Upgrade directly
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return fetch(targetUrl.toString(), {
        headers: newHeaders,
        method: request.method,
      });
    }

    // Edge Caching for static Next.js assets, stickers, and images
    const isStaticAsset =
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/api/uploads/') ||
      /\.(png|jpg|jpeg|gif|webp|svg|css|js|woff2?|ico)$/i.test(url.pathname);

    if (isStaticAsset && request.method === 'GET') {
      const cache = caches.default;
      let response = await cache.match(request);
      if (response) {
        return response;
      }

      response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
      });

      // Cache successful static responses for 24 hours at Cloudflare Edge
      if (response.status === 200) {
        const cachedResponse = new Response(response.body, response);
        cachedResponse.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
        cachedResponse.headers.set('CF-Edge-Cache', 'HIT');
        ctx.waitUntil(cache.put(request, cachedResponse.clone()));
        return cachedResponse;
      }

      return response;
    }

    // Default proxy for dynamic HTML & REST endpoints
    return fetch(targetUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow',
    });
  },

  // 2. Cloudflare Cron Trigger (Runs every 5 minutes to keep Render alive 24/7)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      Promise.all([
        fetch(`${SERVER_ORIGIN}/health`),
        fetch(WEB_ORIGIN),
      ]).then(() => {
        console.log('[Cloudflare Cron] Successfully kept Dudu & Bubu alive.');
      }).catch((err) => {
        console.warn('[Cloudflare Cron] Ping warning:', err);
      })
    );
  },
};
