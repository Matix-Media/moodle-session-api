"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginError = exports.AttendanceUpdateError = void 0;
const axios_1 = __importDefault(require("axios"));
const qs_1 = __importDefault(require("qs"));
const tough_cookie_1 = require("tough-cookie");
const LOGIN_TOKEN_MATCH_REGEX = /<input type="hidden" name="logintoken" value="([^"]*)">/i;
const LOGIN_ERROR_MATCH_REGEX = /<a href="#" id="loginerrormessage" class="sr-only">([^"]*)<\/a>/i;
const ATTENDANCE_ERROR_MATCH_REGEX = /<p class="errormessage">([^"]*)<\/p>/i;
const VERBOSE = false;
class MoodleSession {
    constructor(options) {
        this.cookies = new tough_cookie_1.CookieJar();
        this.options = options;
        this.client = axios_1.default.create({
            maxRedirects: 0,
            headers: {
                Host: new URL(this.options.baseUrl).host,
            },
        });
        this.client.interceptors.request.use((config) => {
            config.headers["Cookie"] = this.cookies.getCookieStringSync(config.url);
            return config;
        });
        this.client.interceptors.response.use((res) => {
            res.headers["set-cookie"]?.forEach((cookie) => {
                this.cookies.setCookieSync(cookie, res.config.url);
            });
            return res;
        }, (error) => {
            if (!axios_1.default.isAxiosError(error))
                return Promise.reject(error);
            error.response?.headers["set-cookie"]?.forEach((cookie) => {
                this.cookies.setCookieSync(cookie, error.config.url);
            });
            if (![301, 302, 303, 307, 308].includes(error.response?.status ?? 500))
                return Promise.reject(error);
            const redirectUrl = error.response?.headers["location"];
            if (!redirectUrl)
                return Promise.reject(error);
            return this.client.get(redirectUrl);
        });
    }
    buildUrl(path, params) {
        const url = this.options.baseUrl.replace(/\/$/, "") + "/" + path;
        if (params == null)
            return url;
        const partialUrl = new URL(url);
        if (partialUrl.search)
            params = { ...qs_1.default.parse(partialUrl.search, { ignoreQueryPrefix: true }), ...params };
        if (params != null && Object.keys(params).length > 0) {
            const query = qs_1.default.stringify(params);
            if (query.length > 0)
                path += "?" + query;
        }
        return url;
    }
    async login(username, password) {
        const loginUrl = this.buildUrl("/login/index.php");
        try {
            const loginTokenRes = await this.client.get(loginUrl);
            const loginTokenMatch = LOGIN_TOKEN_MATCH_REGEX.exec(loginTokenRes.data);
            if (loginTokenMatch == null || loginTokenMatch?.length < 1) {
                throw new Error("Could not find login token");
            }
            const loginRes = await this.client.post(loginUrl, qs_1.default.stringify({ username, password, logintoken: loginTokenMatch[1] }), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
            if (!loginRes || loginRes.config.url !== this.buildUrl("/")) {
                const loginErrorMatch = LOGIN_ERROR_MATCH_REGEX.exec(loginRes?.data ?? "");
                if (loginErrorMatch != null && loginErrorMatch?.length > 1) {
                    throw new LoginError("Login failed", loginErrorMatch[1]);
                }
                else
                    throw new LoginError("Login failed");
            }
        }
        catch (err) {
            if (err instanceof LoginError)
                throw err;
            if (axios_1.default.isAxiosError(err) && err.response) {
                const loginErrorMatch = LOGIN_ERROR_MATCH_REGEX.exec(err.response.data ?? "");
                if (loginErrorMatch != null && loginErrorMatch?.length > 1)
                    throw new LoginError("Login failed", loginErrorMatch[1]);
                else
                    throw new LoginError("Login failed", err.message);
            }
            else
                throw new LoginError("Login failed", String(err));
        }
    }
    async updateAttendance(qrPass, sessId) {
        const attendanceUrl = this.buildUrl("/mod/attendance/attendance.php?qrpass=" + qrPass + "&sessid=" + sessId);
        try {
            await this.client.get(attendanceUrl);
        }
        catch (err) {
            if (axios_1.default.isAxiosError(err) && err.response) {
                const attendanceErrorMatch = ATTENDANCE_ERROR_MATCH_REGEX.exec(err.response.data ?? "");
                if (attendanceErrorMatch != null && attendanceErrorMatch?.length > 1) {
                    throw new AttendanceUpdateError("Attendance update failed", attendanceErrorMatch[1]);
                }
                else
                    throw new AttendanceUpdateError("Attendance update failed", err.message);
            }
            else
                throw new AttendanceUpdateError("Attendance update failed", String(err));
        }
    }
}
exports.default = MoodleSession;
class AttendanceUpdateError extends Error {
    constructor(message, reason) {
        super(message);
        this.name = "AttendanceUpdateError";
        this.reason = reason;
    }
}
exports.AttendanceUpdateError = AttendanceUpdateError;
class LoginError extends Error {
    constructor(message, reason) {
        super(message);
        this.name = "LoginError";
        this.reason = reason;
    }
}
exports.LoginError = LoginError;
