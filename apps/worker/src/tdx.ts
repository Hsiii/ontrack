import type { Env, TDXOptions, TDXResponse } from './types';

const TOKEN_URL =
    'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export type TDXServiceErrorKind =
    | 'authentication'
    | 'capacity'
    | 'upstream'
    | 'invalid-response';

export class TDXServiceError extends Error {
    readonly kind: TDXServiceErrorKind;
    readonly status: number | null;

    constructor(
        kind: TDXServiceErrorKind,
        status: number | null,
        message: string
    ) {
        super(message);
        this.name = 'TDXServiceError';
        this.kind = kind;
        this.status = status;
    }
}

function getResponseBytes(response: Response, bodyText?: string) {
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
        const parsed = Number(contentLength);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return bodyText === undefined
        ? null
        : new TextEncoder().encode(bodyText).length;
}

function logTDXRequest(details: {
    path: string;
    tier: string;
    caller: string;
    status: number;
    notModified: boolean;
    durationMs: number;
    bytes: number | null;
    authenticated: boolean;
}) {
    console.info(
        JSON.stringify({
            event: 'tdx_request',
            ...details,
        })
    );
}

async function getAccessToken(env: Env): Promise<string | null> {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt) {
        return cachedToken;
    }

    if (!env.TDX_CLIENT_ID || !env.TDX_CLIENT_SECRET) {
        console.warn(
            'TDX_CLIENT_ID or TDX_CLIENT_SECRET missing. Using Visitor Mode.'
        );
        return null;
    }

    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.TDX_CLIENT_ID,
        client_secret: env.TDX_CLIENT_SECRET,
    });

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new TDXServiceError(
            response.status === 429 ? 'capacity' : 'authentication',
            response.status,
            `Failed to get TDX token: ${response.status} ${errorText}. Refusing Visitor Mode because credentials are configured.`
        );
    }

    const data = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
    };

    if (!data.access_token) {
        throw new TDXServiceError(
            'invalid-response',
            null,
            'TDX token response did not include access_token. Refusing Visitor Mode because credentials are configured.'
        );
    }

    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in ?? 3600) * 1000 - 60000;

    return cachedToken;
}

export async function fetchTDXWithCache<T>(
    env: Env,
    path: string,
    options: TDXOptions = {}
): Promise<TDXResponse<T>> {
    const {
        searchParams = {},
        tier = 'basic',
        format = 'JSON',
        ifModifiedSince,
        caller = 'daily-timetable-refresh',
    } = options;

    const token = await getAccessToken(env);
    const url = new URL(`https://tdx.transportdata.tw/api/${tier}/${path}`);

    Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });
    url.searchParams.append('$format', format);

    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (ifModifiedSince) {
        headers['If-Modified-Since'] = ifModifiedSince;
    }

    const startedAt = Date.now();
    const response = await fetch(url.toString(), { headers });
    const durationMs = Date.now() - startedAt;

    if (response.status === 304) {
        logTDXRequest({
            path,
            tier,
            caller,
            status: response.status,
            notModified: true,
            durationMs,
            bytes: getResponseBytes(response),
            authenticated: Boolean(token),
        });

        return {
            data: null,
            lastModified: ifModifiedSince ?? null,
            notModified: true,
        };
    }

    if (!response.ok) {
        const errorBody = await response.text();
        logTDXRequest({
            path,
            tier,
            caller,
            status: response.status,
            notModified: false,
            durationMs,
            bytes: getResponseBytes(response, errorBody),
            authenticated: Boolean(token),
        });
        throw new TDXServiceError(
            classifyTDXStatus(response.status),
            response.status,
            `TDX API Error: ${response.status} ${response.statusText} - ${errorBody}`
        );
    }

    const responseBody = await response.text();
    logTDXRequest({
        path,
        tier,
        caller,
        status: response.status,
        notModified: false,
        durationMs,
        bytes: getResponseBytes(response, responseBody),
        authenticated: Boolean(token),
    });

    return {
        data: JSON.parse(responseBody) as T,
        lastModified: response.headers.get('Last-Modified'),
        notModified: false,
    };
}

export async function fetchTDX<T>(
    env: Env,
    path: string,
    options: TDXOptions = {}
): Promise<T> {
    const response = await fetchTDXWithCache<T>(env, path, options);

    if (!response.data) {
        throw new TDXServiceError(
            'invalid-response',
            null,
            `TDX returned no data for ${path}`
        );
    }

    return response.data;
}

function classifyTDXStatus(status: number): TDXServiceErrorKind {
    if (status === 429) {
        return 'capacity';
    }

    if (status === 401 || status === 403) {
        return 'authentication';
    }

    if (status >= 500) {
        return 'upstream';
    }

    return 'invalid-response';
}
