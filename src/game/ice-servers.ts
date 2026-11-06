/** Optional same-origin relay configuration. Privileged provider keys stay in Netlify. */
export async function loadIceServers(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RTCIceServer[] | undefined> {
    const response = await fetcher('/.netlify/functions/ice-servers', { signal, cache: 'no-store' });
    // Dev/static-only hosting has no Netlify function; retain PeerJS defaults there.
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error('TURN service unavailable. Check the Netlify relay settings and try again.');
    if (!response.headers.get('content-type')?.includes('application/json')) return undefined;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('iceServers' in data) || !Array.isArray(data.iceServers) || data.iceServers.length > 16)
        throw new Error('Invalid relay configuration');
    if (data.iceServers.length === 0) return undefined;
    const servers: RTCIceServer[] = data.iceServers.map((server: unknown) => {
        if (!server || typeof server !== 'object' || !('urls' in server)) throw new Error('Invalid relay configuration');
        const urls: unknown[] = typeof server.urls === 'string' ? [server.urls] : Array.isArray(server.urls) ? server.urls : [];
        if (!urls.length || urls.length > 8 || !urls.every(url => typeof url === 'string' && /^(stun|stuns|turn|turns):[^\s]+$/.test(url) && url.length <= 512))
            throw new Error('Invalid relay configuration');
        const result: RTCIceServer = { urls: urls as string[] };
        for (const field of ['username', 'credential'] as const) {
            if (field in server) {
                const value = server[field as keyof typeof server];
                if (typeof value !== 'string' || value.length > 1024) throw new Error('Invalid relay credentials');
                result[field] = value;
            }
        }
        return result;
    });
    return servers;
}
