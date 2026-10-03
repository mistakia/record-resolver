export declare const RESOLVER_ERROR_CODES: readonly ["MISSING_URL", "INVALID_URL", "BLOCKED_DESTINATION", "UNSUPPORTED_URL", "YTDLP_NOT_FOUND", "YTDLP_FAILED", "YTDLP_TIMEOUT", "YTDLP_INVALID_OUTPUT"];
export type ResolverErrorCode = typeof RESOLVER_ERROR_CODES[number];
export declare class ResolverError extends Error {
    readonly code: ResolverErrorCode;
    readonly url: string | undefined;
    readonly stderr: string | undefined;
    constructor({ code, message, url, stderr, cause }: {
        code: ResolverErrorCode;
        message: string;
        url?: string | undefined;
        stderr?: string | undefined;
        cause?: unknown;
    });
}
