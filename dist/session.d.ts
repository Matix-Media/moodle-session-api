export interface MoodleSessionOptions {
    baseUrl: string;
}
export default class MoodleSession {
    private options;
    private client;
    private cookies;
    constructor(options: MoodleSessionOptions);
    private buildUrl;
    login(username: string, password: string): Promise<void>;
    updateAttendance(qrPass: string, sessId: string): Promise<void>;
}
export declare class AttendanceUpdateError extends Error {
    reason: string | undefined;
    constructor(message: string, reason?: string);
}
export declare class LoginError extends Error {
    reason: string | undefined;
    constructor(message: string, reason?: string);
}
