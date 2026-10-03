import { spawn } from 'node:child_process';
import { ResolverError } from "./errors.js";
// The yt-dlp release this package is tested against, and the SHA-256 of that
// release's platform-independent `yt-dlp` zipapp asset. Callers supply the
// binary; nothing here downloads it. cli/install-yt-dlp.ts installs exactly
// this pin. A different installed version is reported by
// check_ytdlp_version, and is a warning rather than a failure: the contract is
// the resolved output, which the fixture tests pin.
export const YTDLP_VERSION = '2026.08.19';
export const YTDLP_SHA256 = '1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6';
export const DEFAULT_TIMEOUT_MS = 60_000;
// Audio only, m4a first (the legacy preference), and always a direct HTTP(S)
// file: an HLS or DASH manifest URL cannot be fetched as a single download.
export const FORMAT_SELECTOR = [
    "bestaudio[ext=m4a][protocol~='^https?$']",
    "bestaudio[protocol~='^https?$']",
    "best[protocol~='^https?$']"
].join('/');
const STDERR_LIMIT = 8192;
// An empty YTDLP_PATH counts as unset.
export function resolve_binary_path(binary_path) {
    return binary_path ?? (process.env['YTDLP_PATH'] || 'yt-dlp');
}
// --ignore-config keeps a user or system yt-dlp config from changing output.
// --flat-playlist is deliberately absent: it omits the streaming url.
// --proxy names a guarded proxy (src/guarded-proxy.ts); yt-dlp never runs
// without one.
export function build_ytdlp_args({ url, proxy_url, playlist = false }) {
    return [
        '--ignore-config',
        '--proxy', proxy_url,
        '--dump-json',
        '--no-warnings',
        '--no-progress',
        playlist ? '--yes-playlist' : '--no-playlist',
        '--format', FORMAT_SELECTOR,
        '--',
        url
    ];
}
function run({ binary_path, args, timeout_ms, url }) {
    return new Promise((resolve, reject) => {
        const child = spawn(binary_path, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const stdout = [];
        let stderr = '';
        let timed_out = false;
        let settled = false;
        const timer = setTimeout(() => {
            timed_out = true;
            child.kill('SIGKILL');
        }, timeout_ms);
        const settle = (fn) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            fn();
        };
        child.stdout.on('data', (chunk) => { stdout.push(chunk); });
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk) => {
            stderr = (stderr + chunk).slice(-STDERR_LIMIT);
        });
        child.on('error', (error) => {
            settle(() => {
                if (error.code === 'ENOENT' || error.code === 'EACCES') {
                    reject(new ResolverError({
                        code: 'YTDLP_NOT_FOUND',
                        message: `yt-dlp not runnable at ${binary_path}: ${error.code}`,
                        url,
                        cause: error
                    }));
                }
                else {
                    reject(new ResolverError({
                        code: 'YTDLP_FAILED',
                        message: `yt-dlp failed to start: ${error.message}`,
                        url,
                        cause: error
                    }));
                }
            });
        });
        child.on('close', (exit_code) => {
            settle(() => {
                if (timed_out) {
                    reject(new ResolverError({
                        code: 'YTDLP_TIMEOUT',
                        message: `yt-dlp did not finish within ${timeout_ms}ms`,
                        url,
                        stderr
                    }));
                    return;
                }
                resolve({ exit_code, stdout: Buffer.concat(stdout).toString('utf8'), stderr });
            });
        });
    });
}
function last_error_line(stderr) {
    const lines = stderr.trim().split('\n');
    return lines.findLast((line) => line.startsWith('ERROR:')) ?? lines.at(-1) ?? '';
}
// Runs yt-dlp --dump-json through the proxy at proxy_url and returns one raw
// info object per resolved entry.
export async function dump_json({ url, proxy_url, binary_path, timeout_ms = DEFAULT_TIMEOUT_MS, playlist = false }) {
    const result = await run({
        binary_path: resolve_binary_path(binary_path),
        args: build_ytdlp_args({ url, proxy_url, playlist }),
        timeout_ms,
        url
    });
    if (result.exit_code !== 0) {
        const reason = last_error_line(result.stderr);
        const unsupported = reason.startsWith('ERROR: Unsupported URL');
        throw new ResolverError({
            code: unsupported ? 'UNSUPPORTED_URL' : 'YTDLP_FAILED',
            message: unsupported
                ? `no extractor supports ${url}`
                : `yt-dlp exited ${result.exit_code ?? 'by signal'}: ${reason}`,
            url,
            stderr: result.stderr
        });
    }
    const lines = result.stdout.split('\n').filter((line) => line.trim() !== '');
    return lines.map((line) => {
        try {
            return JSON.parse(line);
        }
        catch (error) {
            throw new ResolverError({
                code: 'YTDLP_INVALID_OUTPUT',
                message: 'yt-dlp printed a line that is not JSON',
                url,
                cause: error
            });
        }
    });
}
// Reports the installed yt-dlp version against the pin. Call it once at
// startup and warn on a mismatch, as record-node does for fpcalc and ffmpeg.
export async function check_ytdlp_version({ binary_path, timeout_ms = DEFAULT_TIMEOUT_MS } = {}) {
    const result = await run({
        binary_path: resolve_binary_path(binary_path),
        args: ['--ignore-config', '--version'],
        timeout_ms
    });
    if (result.exit_code !== 0) {
        throw new ResolverError({
            code: 'YTDLP_FAILED',
            message: `yt-dlp --version exited ${result.exit_code ?? 'by signal'}`,
            stderr: result.stderr
        });
    }
    const version = result.stdout.trim();
    return { version, pinned: YTDLP_VERSION, matches: version === YTDLP_VERSION };
}
