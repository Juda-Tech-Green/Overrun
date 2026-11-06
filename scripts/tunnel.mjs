import { spawn, spawnSync } from 'node:child_process';
import { access, chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Prefer an existing installation, including ~/.local/bin outside PATH.
async function findCloudflared() {
    for (const candidate of ['cloudflared', join(homedir(), '.local', 'bin', 'cloudflared')]) {
        if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
    }

    const arch = { x64: 'amd64', arm64: 'arm64', arm: 'arm', ia32: '386' }[process.arch];
    if (process.platform !== 'linux' || !arch) {
        throw new Error('Install cloudflared from https://developers.cloudflare.com/tunnel/downloads/ and retry npm run tunnel.');
    }
    const cache = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'pixelforge', 'cloudflared');
    const binary = join(cache, `cloudflared-linux-${arch}`);
    try {
        await access(binary, constants.X_OK);
        return binary;
    } catch { /* Download once; future invocations use the cache. */ }

    const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
    console.log(`Downloading official cloudflared for Linux ${arch} (one time)…`);
    await mkdir(cache, { recursive: true });
    const temporary = `${binary}.${process.pid}.download`;
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`Cloudflared download failed: HTTP ${response.status}`);
        await writeFile(temporary, Buffer.from(await response.arrayBuffer()), { mode: 0o755 });
        await chmod(temporary, 0o755);
        await rename(temporary, binary);
    } finally {
        await rm(temporary, { force: true });
    }
    return binary;
}

try {
    const binary = await findCloudflared();
    const extra = process.argv.slice(2);
    const args = extra.includes('--version') ? ['--version'] : [
        'tunnel', '--url', 'http://127.0.0.1:8080', ...extra,
    ];
    const child = spawn(binary, args, { stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
    child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
    child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
