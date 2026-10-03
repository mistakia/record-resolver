import type { ResolveOptions, ResolvedEntry } from './types.ts';
export declare function validate_url(url: unknown): string;
export declare function resolve_url(url: string, options?: ResolveOptions): Promise<ResolvedEntry[]>;
