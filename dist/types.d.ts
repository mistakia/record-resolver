export interface ResolverEntry {
    extractor: string;
    id: string;
    fulltitle?: string;
    thumbnail?: string;
    artist?: string;
    alt_title?: string;
    upload_date?: string;
    webpage_url?: string;
    duration?: number;
}
export interface ResolvedEntry extends ResolverEntry {
    url: string;
    ext?: string;
    http_headers?: Record<string, string>;
}
export interface ResolveOptions {
    binary_path?: string;
    timeout_ms?: number;
    playlist?: boolean;
}
