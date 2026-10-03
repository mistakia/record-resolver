import { type LookupFunction } from 'node:net';
export type AddressClass = 'unspecified' | 'loopback' | 'private' | 'shared' | 'link-local' | 'unique-local' | 'site-local' | 'multicast' | 'reserved';
export interface LookupAddress {
    address: string;
    family: number;
}
export type LookupAll = (hostname: string) => Promise<LookupAddress[]>;
export declare const address_class: (address: string) => AddressClass | undefined;
export declare const assert_public_addresses: (host: string, addresses: readonly LookupAddress[], url?: string) => void;
export declare function assert_public_destination(url: string, { lookup }?: {
    lookup?: LookupAll | undefined;
}): Promise<void>;
export declare const guarded_lookup: LookupFunction;
