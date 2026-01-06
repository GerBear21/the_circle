/**
 * n8n Integration Helper
 * 
 * This module provides utilities for triggering n8n workflows via webhooks.
 * Configure N8N_BASE_URL in your environment variables for production.
 */

export interface N8nTriggerOptions {
    method?: 'GET' | 'POST';
    timeout?: number; // in milliseconds
    headers?: Record<string, string>;
}

export interface N8nResponse {
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
}

/**
 * Get the configured n8n base URL
 */
export function getN8nBaseUrl(): string {
    return process.env.N8N_BASE_URL || 'http://localhost:5678';
}

/**
 * Trigger an n8n workflow via webhook
 * 
 * @param webhookSlug - The webhook slug/path configured in n8n (e.g., 'my-workflow')
 * @param method - HTTP method (GET or POST)
 * @param data - Optional data payload to send
 * @param options - Additional options like timeout
 * @returns The workflow response or null if failed
 */
export async function triggerN8nWorkflow(
    webhookSlug: string,
    method: 'GET' | 'POST' = 'POST',
    data?: any,
    options: N8nTriggerOptions = {}
): Promise<N8nResponse> {
    const baseUrl = getN8nBaseUrl();
    const url = `${baseUrl}/webhook/${webhookSlug}`;
    const timeout = options.timeout || 30000; // 30 second default timeout

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`Failed to trigger n8n workflow ${webhookSlug}: ${response.status} ${response.statusText}`);
            return {
                success: false,
                error: `HTTP ${response.status}: ${response.statusText}`,
                statusCode: response.status,
            };
        }

        // Parse response - handle both JSON and text responses
        const text = await response.text();
        let parsedData: any;

        try {
            parsedData = JSON.parse(text);
        } catch {
            parsedData = text || null;
        }

        return {
            success: true,
            data: parsedData,
            statusCode: response.status,
        };

    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error(`n8n workflow ${webhookSlug} timed out after ${timeout}ms`);
            return {
                success: false,
                error: `Request timed out after ${timeout}ms`,
            };
        }

        console.error('Error triggering n8n workflow:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use triggerN8nWorkflow instead
 */
export async function triggerWorkflow(webhookSlug: string, method: 'GET' | 'POST' = 'POST', data?: any) {
    const result = await triggerN8nWorkflow(webhookSlug, method, data);
    if (!result.success) {
        throw new Error(result.error || 'Failed to trigger workflow');
    }
    return result.data;
}

/**
 * Check if n8n is reachable
 */
export async function checkN8nHealth(): Promise<boolean> {
    try {
        const baseUrl = getN8nBaseUrl();
        const response = await fetch(`${baseUrl}/healthz`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        return response.ok;
    } catch {
        return false;
    }
}
