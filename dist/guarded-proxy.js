// The HTTP proxy every yt-dlp run goes through. yt-dlp resolves hosts and
// follows redirects itself, so checking the input URL alone does not bind
// what it connects to. This proxy listens on loopback for the length of one
// run, resolves each target through guarded_lookup, refuses a non-public
// destination with 403, and connects only to an address that lookup approved,
// so no second resolution can rebind the name. It serves CONNECT, for https,
// and absolute-form plain http requests.
import { createServer, request, STATUS_CODES } from 'node:http';
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
const status_of = (error) => error instanceof ResolverError && error.code === 'BLOCKED_DESTINATION' ? 403 : 502;
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
    // Resolves and connects, or records the refusal and rejects.
    const open = async ({ host, port }) => {
        try {
            const addresses = await approved_addresses({ host, lookup });
            if (closed)
                throw new Error('proxy closed');
            return await connect_first({ addresses, port, track });
        }
        catch (error) {
            if (status_of(error) === 403)
                refusals.push(error);
            throw error;
        }
    };
    const reply = (socket, status, body) => {
        socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
    };
    const on_request = (req, res) => {
        let target;
        try {
            target = new URL(req.url ?? '');
        }
        catch { }
        if (target?.protocol !== 'http:') {
            res.writeHead(400, { 'Content-Type': 'text/plain', Connection: 'close' }).end('only absolute-form http requests and CONNECT are proxied\n');
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
        }, (error) => {
            res.writeHead(status_of(error), { 'Content-Type': 'text/plain', Connection: 'close' }).end(`${error.message}\n`);
        });
    };
    const on_connect = (req, client, head) => {
        const target = parse_authority(req.url ?? '');
        if (target === undefined) {
            reply(client, 400, 'CONNECT needs host:port\n');
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
        }, (error) => {
            reply(client, status_of(error), `${error.message}\n`);
        });
    };
    const server = createServer(on_request);
    server.on('connect', on_connect);
    server.on('connection', track);
    server.on('clientError', (_error, socket) => { socket.destroy(); });
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
    return { url: `http://127.0.0.1:${port}`, refusals, close };
}
// Runs `run` with a fresh proxy's URL and closes the proxy when it settles,
// on every path. A yt-dlp failure after the proxy refused a connection is
// reported as BLOCKED_DESTINATION, naming the first refused destination.
export async function with_guarded_proxy({ run, lookup }) {
    const proxy = await start_guarded_proxy({ lookup });
    try {
        return await run(proxy.url);
    }
    catch (error) {
        const [refusal] = proxy.refusals;
        if (refusal !== undefined && error instanceof ResolverError && REFUSABLE_CODES.has(error.code)) {
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
