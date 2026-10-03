// The HTTP proxy every yt-dlp run goes through. yt-dlp resolves hosts and
// follows redirects itself, so checking the input URL alone does not bind
// what it connects to. This proxy listens on loopback for the length of one
// run, resolves each target through guarded_lookup, refuses a non-public
// destination with 403, and connects only to an address that lookup approved,
// so no second resolution can rebind the name. It serves CONNECT, for https,
// and absolute-form plain http requests.
import { randomBytes } from 'node:crypto';
import { createServer, request } from 'node:http';
import { connect, isIP } from 'node:net';
import { assert_public_addresses, guarded_lookup } from "./destination.js";
import { ResolverError } from "./errors.js";
// How long one approved address gets to accept the connection before the next
// is tried, so a host whose IPv6 route is a black hole still falls back to IPv4.
const CONNECT_TIMEOUT_MS = 10_000;
// Headers that describe the hop to this proxy, not the request to the origin.
const HOP_HEADERS = ['connection', 'keep-alive', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'upgrade'];
// yt-dlp failures a refused connection can surface as.
const REFUSABLE_CODES = new Set(['YTDLP_FAILED', 'UNSUPPORTED_URL']);
// The addresses a target may be connected to. An IP literal is checked
// directly; a name goes through the lookup, which refuses it unless every
// address is public.
const approved_addresses = async ({ host, lookup }) => {
    if (isIP(host) !== 0) {
        const literal = [{ address: host, family: isIP(host) }];
        assert_public_addresses(host, literal);
        return literal;
    }
    return await new Promise((resolve, reject) => {
        lookup(host, { all: true }, (error, addresses, family) => {
            if (error !== null)
                reject(error);
            else if (Array.isArray(addresses))
                resolve(addresses);
            else
                resolve([{ address: addresses, family: family ?? isIP(addresses) }]);
        });
    });
};
// Connects to the first address that accepts, in lookup order.
const connect_first = async ({ addresses, port, track }) => {
    let last_error = new Error('no address to connect to');
    for (const { address } of addresses) {
        try {
            return await new Promise((resolve, reject) => {
                const socket = connect({ host: address, port, timeout: CONNECT_TIMEOUT_MS });
                track(socket);
                socket.once('connect', () => {
                    socket.setTimeout(0);
                    resolve(socket);
                });
                socket.once('timeout', () => { socket.destroy(new Error(`connect to ${address} timed out`)); });
                socket.once('error', reject);
                socket.once('close', () => { reject(new Error(`connection to ${address} closed`)); });
            });
        }
        catch (error) {
            last_error = error;
        }
    }
    throw last_error;
};
const unsupported_scheme = (target) => new ResolverError({ code: 'BLOCKED_DESTINATION', message: `unsupported scheme ${target.protocol} in ${target.href}`, url: target.href });
// The absolute-form target of a request line Bun's parser rejected; Bun
// refuses a scheme other than http or https before the request handler runs.
const rejected_target = (raw) => {
    const target = /^[A-Z]+ ([a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S*) HTTP\/1\.[01]\r?\n/.exec(String(raw ?? ''))?.[1];
    try {
        return target === undefined ? undefined : new URL(target);
    }
    catch {
        return undefined;
    }
};
// host:port, with an IPv6 host in brackets. Returns the bare host.
const parse_authority = (authority) => {
    const match = /^(?:\[([^\]]+)\]|([^:[\]]+)):(\d{1,5})$/.exec(authority);
    const port = Number(match?.[3]);
    const host = match?.[1] ?? match?.[2];
    if (host === undefined || port < 1 || port > 65535)
        return undefined;
    return { host, port };
};
// Starts a proxy on a random loopback port. `lookup` is the resolver it
// connects through; anything other than guarded_lookup is for tests.
export async function start_guarded_proxy({ lookup = guarded_lookup } = {}) {
    const refusals = [];
    // Each refusal's 403 carries a reason phrase naming it, which yt-dlp echoes
    // in its error ("HTTP Error 403: ..." or "Tunnel connection failed: 403
    // ..."). The nonce keeps an origin's own 403 from passing for one.
    const nonce = randomBytes(6).toString('hex');
    const reason_of = (index) => `Forbidden (record-resolver refusal ${nonce}-${index})`;
    const sockets = new Set();
    let closed = false;
    const track = (socket) => {
        if (closed) {
            socket.destroy();
            return;
        }
        sockets.add(socket);
        socket.once('close', () => { sockets.delete(socket); });
    };
    // The status line for a failed open: 403 for a refusal, which is recorded,
    // and 502 for anything else, such as a name that does not resolve.
    const failure_of = (error) => {
        const body = `${error.message}\n`;
        if (!(error instanceof ResolverError && error.code === 'BLOCKED_DESTINATION'))
            return { status: 502, reason: 'Bad Gateway', body };
        refusals.push(error);
        return { status: 403, reason: reason_of(refusals.length - 1), body };
    };
    const refusal_in = (stderr) => {
        const error_lines = stderr.split('\n').filter((line) => line.startsWith('ERROR:'));
        return refusals.find((_refusal, index) => error_lines.some((line) => line.includes(reason_of(index))));
    };
    const open = async ({ host, port }) => {
        const addresses = await approved_addresses({ host, lookup });
        if (closed)
            throw new Error('proxy closed');
        return await connect_first({ addresses, port, track });
    };
    const reply = (socket, { status, reason, body }) => {
        socket.end(`HTTP/1.1 ${status} ${reason}\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
    };
    const respond = (res, { status, reason, body }) => {
        res.writeHead(status, reason, { 'Content-Type': 'text/plain', Connection: 'close' }).end(body);
    };
    const on_request = (req, res) => {
        let target;
        try {
            target = new URL(req.url ?? '');
        }
        catch { }
        if (target === undefined) {
            respond(res, { status: 400, reason: 'Bad Request', body: 'only absolute-form http requests and CONNECT are proxied\n' });
            return;
        }
        if (target.protocol !== 'http:') {
            respond(res, failure_of(unsupported_scheme(target)));
            return;
        }
        const host = target.hostname.replace(/^\[|\]$/g, '');
        const port = Number(target.port || 80);
        const headers = { ...req.headers };
        for (const name of HOP_HEADERS)
            Reflect.deleteProperty(headers, name);
        open({ host, port }).then((socket) => {
            const upstream = request({
                method: req.method,
                path: `${target.pathname}${target.search}`,
                headers,
                createConnection: () => socket
            }, (response) => {
                res.writeHead(response.statusCode ?? 502, response.headers);
                response.pipe(res);
            });
            upstream.on('error', () => { res.destroy(); });
            req.pipe(upstream);
        }, (error) => { respond(res, failure_of(error)); });
    };
    const on_connect = (req, client, head) => {
        const target = parse_authority(req.url ?? '');
        if (target === undefined) {
            reply(client, { status: 400, reason: 'Bad Request', body: 'CONNECT needs host:port\n' });
            return;
        }
        open(target).then((upstream) => {
            client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head.length > 0)
                upstream.write(head);
            upstream.on('error', () => { client.destroy(); });
            client.on('error', () => { upstream.destroy(); });
            upstream.pipe(client);
            client.pipe(upstream);
        }, (error) => { reply(client, failure_of(error)); });
    };
    const server = createServer(on_request);
    server.on('connect', on_connect);
    server.on('connection', track);
    server.on('clientError', (error, socket) => {
        const target = rejected_target(error.rawPacket);
        if (target === undefined || !socket.writable)
            socket.destroy();
        else
            reply(socket, failure_of(unsupported_scheme(target)));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
    const { port } = server.address();
    let closing;
    const close = async () => {
        closed = true;
        closing ??= new Promise((resolve) => {
            server.close(() => { resolve(); });
            for (const socket of sockets)
                socket.destroy();
        });
        await closing;
    };
    return { url: `http://127.0.0.1:${port}`, refusals, refusal_in, close };
}
// Runs `run` with a fresh proxy's URL and closes the proxy when it settles,
// on every path. A yt-dlp failure is reported as BLOCKED_DESTINATION only when
// yt-dlp's own ERROR line names a refusal, so a refused incidental fetch, or a
// refusal another local client provoked, cannot relabel an unrelated failure.
export async function with_guarded_proxy({ run, lookup }) {
    const proxy = await start_guarded_proxy({ lookup });
    try {
        return await run(proxy.url);
    }
    catch (error) {
        const refusal = error instanceof ResolverError && REFUSABLE_CODES.has(error.code) ? proxy.refusal_in(error.stderr ?? '') : undefined;
        if (refusal !== undefined && error instanceof ResolverError) {
            throw new ResolverError({
                code: 'BLOCKED_DESTINATION',
                message: `yt-dlp was refused a connection: ${refusal.message}`,
                url: error.url,
                stderr: error.stderr,
                cause: error
            });
        }
        throw error;
    }
    finally {
        await proxy.close();
    }
}
