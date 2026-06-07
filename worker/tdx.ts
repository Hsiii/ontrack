import type { Env, TDXOptions, TDXResponse } from './types';

const TOKEN_URL =
    'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

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
        console.warn(
            `Failed to get TDX token: ${response.status} ${errorText}. Falling back to Visitor Mode.`
        );
        return null;
    }

    const data = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
    };

    if (!data.access_token) {
        return null;
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

    const response = await fetch(url.toString(), { headers });

    if (response.status === 304) {
        return {
            data: null,
            lastModified: ifModifiedSince ?? null,
            notModified: true,
        };
    }

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `TDX API Error: ${response.status} ${response.statusText} - ${errorBody}`
        );
    }

    return {
        data: (await response.json()) as T,
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
        throw new Error(`TDX returned no data for ${path}`);
    }

    return response.data;
}
