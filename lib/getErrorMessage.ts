/**
 * Extracts a user-safe, human-readable message from any thrown value.
 *
 * Crucially, this NEVER returns a stack trace. It returns a short message
 * suitable for showing in a toast or fallback UI, falling back to a generic
 * message when nothing meaningful is available.
 */
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export function getErrorMessage(error: unknown, fallback: string = GENERIC_MESSAGE): string {
    if (!error) return fallback;

    if (typeof error === 'string') {
        return error.trim() || fallback;
    }

    if (error instanceof Error) {
        // error.message only — never error.stack.
        return error.message?.trim() || fallback;
    }

    // API responses often look like { error: '...' } or { message: '...' }.
    if (typeof error === 'object') {
        const obj = error as Record<string, unknown>;
        const candidate = obj.error ?? obj.message ?? obj.detail;
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }

    return fallback;
}

export { GENERIC_MESSAGE };
