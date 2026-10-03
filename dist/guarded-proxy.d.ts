import { type LookupFunction } from 'node:net';
import { ResolverError } from './errors.ts';
export interface GuardedProxy {
    url: string;
    refusals: ResolverError[];
    close: () => Promise<void>;
}
export declare function start_guarded_proxy({ lookup }?: {
    lookup?: LookupFunction | undefined;
}): Promise<GuardedProxy>;
export declare function with_guarded_proxy<T>({ run, lookup }: {
    run: (proxy_url: string) => Promise<T>;
    lookup?: LookupFunction | undefined;
}): Promise<T>;
