export declare const YTDLP_VERSION = "2026.08.19";
export declare const YTDLP_SHA256 = "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6";
export declare const DEFAULT_TIMEOUT_MS = 60000;
export declare const FORMAT_SELECTOR: string;
export declare function resolve_binary_path(binary_path?: string): string;
export declare function build_ytdlp_args({ url, playlist }: {
    url: string;
    playlist?: boolean;
}): string[];
export declare function dump_json({ url, binary_path, timeout_ms, playlist }: {
    url: string;
    binary_path?: string | undefined;
    timeout_ms?: number | undefined;
    playlist?: boolean | undefined;
}): Promise<unknown[]>;
export interface YtdlpVersionCheck {
    version: string;
    pinned: string;
    matches: boolean;
}
export declare function check_ytdlp_version({ binary_path, timeout_ms }?: {
    binary_path?: string;
    timeout_ms?: number;
}): Promise<YtdlpVersionCheck>;
