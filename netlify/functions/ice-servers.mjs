// This endpoint returns WebRTC credentials, never the privileged Metered API key.
export default async function iceServers(request) {
    const reply = (body, status = 200) => Response.json(body, {
        status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
    if (request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply({ error: 'Forbidden' }, 403);
    const host = process.env.METERED_TURN_HOST;
    const key = process.env.METERED_TURN_API_KEY;
    if (!host && !key) return reply({ iceServers: [] });
    if (!host || !key || !/^[a-z0-9-]+\.metered\.live$/.test(host))
        return reply({ error: 'TURN service configuration is incomplete' }, 503);
    try {
        const url = new URL(`https://${host}/api/v1/turn/credentials`);
        url.searchParams.set('apiKey', key);
        const response = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'error' });
        if (!response.ok) throw new Error('Provider unavailable');
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0 || data.length > 16) throw new Error('Invalid ICE servers');
        const servers = data.map(server => {
            const urls = typeof server?.urls === 'string' ? [server.urls] : server?.urls;
            if (!Array.isArray(urls) || !urls.length || urls.length > 8 ||
                !urls.every(url => typeof url === 'string' && url.length <= 512 && /^(stun|stuns|turn|turns):[^\s]+$/.test(url)))
                throw new Error('Invalid ICE URLs');
            const result = { urls };
            for (const field of ['username', 'credential']) {
                if (server[field] !== undefined) {
                    if (typeof server[field] !== 'string' || server[field].length > 1024) throw new Error('Invalid credential');
                    result[field] = server[field];
                }
            }
            return result;
        });
        if (!servers.some(server => server.urls.some(url => /^turns?:/.test(url)) && server.username && server.credential))
            throw new Error('No authenticated TURN server');
        return reply({ iceServers: servers });
    } catch {
        // Provider errors can contain the secret-bearing URL. Never return/log them.
        return reply({ error: 'TURN service unavailable. Try again shortly.' }, 503);
    }
}

export const config = {
    rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip'], action: 'rate_limit' },
};
