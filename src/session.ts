import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import qs, { ParsedQs } from "qs";
import { CookieJar } from "tough-cookie";

const LOGIN_TOKEN_MATCH_REGEX = /<input type="hidden" name="logintoken" value="([^"]*)">/i;
const LOGIN_ERROR_MATCH_REGEX = /<a href="#" id="loginerrormessage" class="sr-only">([^"]*)<\/a>/i;

export interface MoodleSessionOptions {
    baseUrl: string;
}

export default class MoodleSession {
    private options: MoodleSessionOptions;
    private _client: AxiosInstance;
    private cookies = new CookieJar();

    public get client(): AxiosInstance {
        return this.client;
    }

    constructor(options: MoodleSessionOptions) {
        this.options = options;
        this._client = axios.create({
            maxRedirects: 0,
            headers: {
                Host: new URL(this.options.baseUrl).host,
            },
        });

        this._client.interceptors.request.use((config) => {
            config.headers["Cookie"] = this.cookies.getCookieStringSync(config.url!);
            return config;
        });

        this._client.interceptors.response.use(
            (res) => {
                res.headers["set-cookie"]?.forEach((cookie) => {
                    this.cookies.setCookieSync(cookie, res.config.url!);
                });
                return res;
            },
            (error) => {
                if (!axios.isAxiosError(error)) return Promise.reject(error);

                error.response?.headers["set-cookie"]?.forEach((cookie) => {
                    this.cookies.setCookieSync(cookie, error.config!.url!);
                });

                if (![301, 302, 303, 307, 308].includes(error.response?.status ?? 500)) return Promise.reject(error);
                const redirectUrl = error.response?.headers["location"];
                if (!redirectUrl) return Promise.reject(error);

                return this._client.get(redirectUrl);
            },
        );
    }

    private buildUrl(path: string, params?: ParsedQs) {
        const url = this.options.baseUrl.replace(/\/$/, "") + "/" + path;
        if (params == null) return url;

        const partialUrl = new URL(url);
        if (partialUrl.search) params = { ...qs.parse(partialUrl.search, { ignoreQueryPrefix: true }), ...params };

        if (params != null && Object.keys(params).length > 0) {
            const query = qs.stringify(params);
            if (query.length > 0) path += "?" + query;
        }
        return url;
    }

    async login(username: string, password: string) {
        const loginUrl = this.buildUrl("/login/index.php");

        try {
            const loginTokenRes = await this._client.get(loginUrl);
            const loginTokenMatch = LOGIN_TOKEN_MATCH_REGEX.exec(loginTokenRes.data);
            if (loginTokenMatch == null || loginTokenMatch?.length < 1) {
                throw new Error("Could not find login token");
            }

            const loginRes = await this._client.post(loginUrl, qs.stringify({ username, password, logintoken: loginTokenMatch[1] }), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            if (!loginRes || loginRes.config.url !== this.buildUrl("/")) {
                const loginErrorMatch = LOGIN_ERROR_MATCH_REGEX.exec(loginRes?.data ?? "");
                if (loginErrorMatch != null && loginErrorMatch?.length > 1) {
                    throw new MoodleLoginError("Login failed", loginErrorMatch[1]);
                } else throw new MoodleLoginError("Login failed");
            }
        } catch (err) {
            if (err instanceof MoodleLoginError) throw err;
            if (axios.isAxiosError(err) && err.response) {
                const loginErrorMatch = LOGIN_ERROR_MATCH_REGEX.exec(err.response.data ?? "");
                if (loginErrorMatch != null && loginErrorMatch?.length > 1) throw new MoodleLoginError("Login failed", loginErrorMatch[1]);
                else throw new MoodleLoginError("Login failed", err.message);
            } else throw new MoodleLoginError("Login failed", String(err));
        }
    }

    public async get(path: string, config?: AxiosRequestConfig) {
        return this._client.get(this.buildUrl(path), config);
    }

    public async post(path: string, data?: Record<string, string>, config?: AxiosRequestConfig) {
        return this._client.post(this.buildUrl(path), data, config);
    }

    public async put(path: string, data?: Record<string, string>, config?: AxiosRequestConfig) {
        return this._client.put(this.buildUrl(path), data, config);
    }

    public async delete(path: string, config?: AxiosRequestConfig) {
        return this._client.delete(this.buildUrl(path), config);
    }
}

export class MoodleLoginError extends Error {
    public reason: string | undefined;
    constructor(message: string, reason?: string) {
        super(message);
        this.name = "MoodleLoginError";
        this.reason = reason;
    }
}
