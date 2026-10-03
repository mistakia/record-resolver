export const RESOLVER_ERROR_CODES = [
    'MISSING_URL',
    'INVALID_URL',
    'UNSUPPORTED_URL',
    'YTDLP_NOT_FOUND',
    'YTDLP_FAILED',
    'YTDLP_TIMEOUT',
    'YTDLP_INVALID_OUTPUT'
];
export class ResolverError extends Error {
    code;
    url;
    stderr;
    constructor({ code, message, url, stderr, cause }) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'ResolverError';
        this.code = code;
        this.url = url;
        this.stderr = stderr;
    }
}
