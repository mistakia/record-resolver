// The destination check: a URL the node fetches, or hands to yt-dlp, must
// name a public host. Private, loopback, link-local and the other non-global
// ranges below are refused after DNS resolution, for every resolved address,
// so a public name pointing inward is caught as well as a literal.
import { lookup as dns_lookup } from 'node:dns';
import { isIP, isIPv4 } from 'node:net';
import { ResolverError } from "./errors.js";
const IPV4_RANGES = [
    ['0.0.0.0', 8, 'unspecified'],
    ['10.0.0.0', 8, 'private'],
    ['100.64.0.0', 10, 'shared'],
    ['127.0.0.0', 8, 'loopback'],
    ['169.254.0.0', 16, 'link-local'],
    ['172.16.0.0', 12, 'private'],
    ['192.0.0.0', 24, 'reserved'],
    ['192.168.0.0', 16, 'private'],
    ['198.18.0.0', 15, 'reserved'],
    ['224.0.0.0', 4, 'multicast'],
    ['240.0.0.0', 4, 'reserved']
];
const ipv4_number = (address) => address.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
const ipv4_class = (address) => {
    const value = ipv4_number(address);
    for (const [base, bits, address_class] of IPV4_RANGES) {
        const size = 2 ** (32 - bits);
        if (Math.floor(value / size) === Math.floor(ipv4_number(base) / size))
            return address_class;
    }
    return undefined;
};
// The 16 bytes of an IPv6 address, which isIP has already accepted. A zone
// index (fe80::1%en0) is dropped; a trailing dotted quad becomes two groups.
const ipv6_bytes = (address) => {
    let text = address.split('%')[0] ?? '';
    const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
    if (dotted?.[1] !== undefined) {
        const value = ipv4_number(dotted[1]);
        text = `${text.slice(0, dotted.index)}${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
    }
    const [head = '', tail] = text.split('::');
    const groups_of = (part) => part === '' ? [] : part.split(':').map((group) => parseInt(group, 16));
    const head_groups = groups_of(head);
    const tail_groups = tail === undefined ? [] : groups_of(tail);
    const groups = [...head_groups, ...new Array(8 - head_groups.length - tail_groups.length).fill(0), ...tail_groups];
    return groups.flatMap((group) => [group >> 8, group & 0xff]);
};
const embedded_ipv4 = (bytes, offset) => bytes.slice(offset, offset + 4).join('.');
const ipv6_class = (address) => {
    const bytes = ipv6_bytes(address);
    const zero_until = (end) => bytes.slice(0, end).every((byte) => byte === 0);
    if (zero_until(16))
        return 'unspecified';
    if (zero_until(15) && bytes[15] === 1)
        return 'loopback';
    // IPv4-mapped ::ffff:0:0/96 and the NAT64 well-known prefix 64:ff9b::/96
    // reach the embedded IPv4 address, so they take its class.
    if (zero_until(10) && bytes[10] === 0xff && bytes[11] === 0xff)
        return ipv4_class(embedded_ipv4(bytes, 12));
    if (bytes.slice(0, 12).join() === [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0].join())
        return ipv4_class(embedded_ipv4(bytes, 12));
    // 6to4 2002::/16 carries its IPv4 address in bytes 2 to 5.
    if (bytes[0] === 0x20 && bytes[1] === 0x02)
        return ipv4_class(embedded_ipv4(bytes, 2));
    const first = bytes[0] ?? 0;
    const second = bytes[1] ?? 0;
    if (first === 0)
        return 'reserved';
    if (first === 0xff)
        return 'multicast';
    if ((first & 0xfe) === 0xfc)
        return 'unique-local';
    if (first === 0xfe && (second & 0xc0) === 0x80)
        return 'link-local';
    if (first === 0xfe && (second & 0xc0) === 0xc0)
        return 'site-local';
    return undefined;
};
// The non-public class of an IP address, or undefined for a public one. A
// string that is not an IP address is refused as reserved.
export const address_class = (address) => {
    const bare = address.replace(/^\[|\]$/g, '');
    if (isIP(bare.split('%')[0] ?? '') === 0)
        return 'reserved';
    return isIPv4(bare) ? ipv4_class(bare) : ipv6_class(bare);
};
const blocked = (host, address, address_class, url) => new ResolverError({
    code: 'BLOCKED_DESTINATION',
    message: host === address
        ? `${host} is a ${address_class} address`
        : `${host} resolves to a ${address_class} address, ${address}`,
    url
});
// Throws BLOCKED_DESTINATION when any address in the list is not public.
export const assert_public_addresses = (host, addresses, url) => {
    for (const { address } of addresses) {
        const found = address_class(address);
        if (found !== undefined)
            throw blocked(host, address, found, url);
    }
};
const default_lookup = async (hostname) => await new Promise((resolve, reject) => {
    dns_lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (error === null)
            resolve(addresses);
        else
            reject(error);
    });
});
// Resolves the URL's host and throws BLOCKED_DESTINATION unless every address
// is public. A host that does not resolve is INVALID_URL. This checks a URL
// before another process, such as yt-dlp, fetches it and resolves again
// itself; bind that process's connections with src/guarded-proxy.ts. For a
// fetch made in this process, connect through guarded_lookup so the checked
// address is the one connected to.
export async function assert_public_destination(url, { lookup = default_lookup } = {}) {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) !== 0) {
        assert_public_addresses(host, [{ address: host, family: isIP(host) }], url);
        return;
    }
    let addresses;
    try {
        addresses = await lookup(host);
    }
    catch (error) {
        throw new ResolverError({ code: 'INVALID_URL', message: `could not resolve ${host}: ${error.code ?? String(error)}`, url, cause: error });
    }
    if (addresses.length === 0)
        throw new ResolverError({ code: 'INVALID_URL', message: `${host} resolves to no address`, url });
    assert_public_addresses(host, addresses, url);
}
// A `lookup` for net.connect, http.request and https.request that refuses a
// host unless every address it resolves to is public. The connection goes
// only to an address this lookup returned, so a DNS answer that changes
// between check and connect cannot slip through. An IP-literal host skips
// lookup entirely, so check it with address_class before the request.
export const guarded_lookup = (hostname, { all = false, family = 0 }, done) => {
    const family_number = family === 'IPv4' ? 4 : family === 'IPv6' ? 6 : family;
    dns_lookup(hostname, { all: true, verbatim: true, family: family_number }, (error, addresses) => {
        if (error !== null) {
            done(error, []);
            return;
        }
        try {
            if (addresses.length === 0)
                throw new ResolverError({ code: 'INVALID_URL', message: `${hostname} resolves to no address` });
            assert_public_addresses(hostname, addresses);
        }
        catch (refusal) {
            done(refusal, []);
            return;
        }
        const [first] = addresses;
        if (all)
            done(null, addresses);
        else
            done(null, first.address, first.family);
    });
};
