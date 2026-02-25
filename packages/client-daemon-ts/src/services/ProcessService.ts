/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Command } from '../models/Command';
import type { CreateSessionRequest } from '../models/CreateSessionRequest';
import type { ExecuteRequest } from '../models/ExecuteRequest';
import type { ExecuteResponse } from '../models/ExecuteResponse';
import type { H } from '../models/H';
import type { PtyCreateRequest } from '../models/PtyCreateRequest';
import type { PtyCreateResponse } from '../models/PtyCreateResponse';
import type { PtyListResponse } from '../models/PtyListResponse';
import type { PtyResizeRequest } from '../models/PtyResizeRequest';
import type { PtySessionInfo } from '../models/PtySessionInfo';
import type { Session } from '../models/Session';
import type { SessionExecuteRequest } from '../models/SessionExecuteRequest';
import type { SessionExecuteResponse } from '../models/SessionExecuteResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ProcessService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Execute a command
     * Execute a shell command and return the output and exit code
     * @param request Command execution request
     * @returns ExecuteResponse OK
     * @throws ApiError
     */
    public executeCommand(
        request: ExecuteRequest,
    ): CancelablePromise<ExecuteResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/process/execute',
            body: request,
        });
    }
    /**
     * List all PTY sessions
     * Get a list of all active pseudo-terminal sessions
     * @returns PtyListResponse OK
     * @throws ApiError
     */
    public listPtySessions(): CancelablePromise<PtyListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/pty',
        });
    }
    /**
     * Create a new PTY session
     * Create a new pseudo-terminal session with specified configuration
     * @param request PTY session creation request
     * @returns PtyCreateResponse Created
     * @throws ApiError
     */
    public createPtySession(
        request: PtyCreateRequest,
    ): CancelablePromise<PtyCreateResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/process/pty',
            body: request,
        });
    }
    /**
     * Get PTY session information
     * Get detailed information about a specific pseudo-terminal session
     * @param sessionId PTY session ID
     * @returns PtySessionInfo OK
     * @throws ApiError
     */
    public getPtySession(
        sessionId: string,
    ): CancelablePromise<PtySessionInfo> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/pty/{sessionId}',
            path: {
                'sessionId': sessionId,
            },
        });
    }
    /**
     * Delete a PTY session
     * Delete a pseudo-terminal session and terminate its process
     * @param sessionId PTY session ID
     * @returns H OK
     * @throws ApiError
     */
    public deletePtySession(
        sessionId: string,
    ): CancelablePromise<H> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/process/pty/{sessionId}',
            path: {
                'sessionId': sessionId,
            },
        });
    }
    /**
     * Connect to PTY session via WebSocket
     * Establish a WebSocket connection to interact with a pseudo-terminal session
     * @param sessionId PTY session ID
     * @returns void
     * @throws ApiError
     */
    public connectPtySession(
        sessionId: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/pty/{sessionId}/connect',
            path: {
                'sessionId': sessionId,
            },
        });
    }
    /**
     * Resize a PTY session
     * Resize the terminal dimensions of a pseudo-terminal session
     * @param sessionId PTY session ID
     * @param request Resize request with new dimensions
     * @returns PtySessionInfo OK
     * @throws ApiError
     */
    public resizePtySession(
        sessionId: string,
        request: PtyResizeRequest,
    ): CancelablePromise<PtySessionInfo> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/process/pty/{sessionId}/resize',
            path: {
                'sessionId': sessionId,
            },
            body: request,
        });
    }
    /**
     * List all sessions
     * Get a list of all active shell sessions
     * @returns Session OK
     * @throws ApiError
     */
    public listSessions(): CancelablePromise<Array<Session>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/session',
        });
    }
    /**
     * Create a new session
     * Create a new shell session for command execution
     * @param request Session creation request
     * @returns any Created
     * @throws ApiError
     */
    public createSession(
        request: CreateSessionRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/process/session',
            body: request,
        });
    }
    /**
     * Get session details
     * Get details of a specific session including its commands
     * @param sessionId Session ID
     * @returns Session OK
     * @throws ApiError
     */
    public getSession(
        sessionId: string,
    ): CancelablePromise<Session> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/session/{sessionId}',
            path: {
                'sessionId': sessionId,
            },
        });
    }
    /**
     * Delete a session
     * Delete an existing shell session
     * @param sessionId Session ID
     * @returns void
     * @throws ApiError
     */
    public deleteSession(
        sessionId: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/process/session/{sessionId}',
            path: {
                'sessionId': sessionId,
            },
        });
    }
    /**
     * Get session command details
     * Get details of a specific command within a session
     * @param sessionId Session ID
     * @param commandId Command ID
     * @returns Command OK
     * @throws ApiError
     */
    public getSessionCommand(
        sessionId: string,
        commandId: string,
    ): CancelablePromise<Command> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/session/{sessionId}/command/{commandId}',
            path: {
                'sessionId': sessionId,
                'commandId': commandId,
            },
        });
    }
    /**
     * Get session command logs
     * Get logs for a specific command within a session. Supports both HTTP and WebSocket streaming.
     * @param sessionId Session ID
     * @param commandId Command ID
     * @param follow Follow logs in real-time (WebSocket only)
     * @returns string Log content
     * @throws ApiError
     */
    public getSessionCommandLogs(
        sessionId: string,
        commandId: string,
        follow?: boolean,
    ): CancelablePromise<string> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/session/{sessionId}/command/{commandId}/logs',
            path: {
                'sessionId': sessionId,
                'commandId': commandId,
            },
            query: {
                'follow': follow,
            },
        });
    }
    /**
     * Execute command in session
     * Execute a command within an existing shell session
     * @param sessionId Session ID
     * @param request Command execution request
     * @returns SessionExecuteResponse OK
     * @throws ApiError
     */
    public sessionExecuteCommand(
        sessionId: string,
        request: SessionExecuteRequest,
    ): CancelablePromise<SessionExecuteResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/process/session/{sessionId}/exec',
            path: {
                'sessionId': sessionId,
            },
            body: request,
        });
    }
}
