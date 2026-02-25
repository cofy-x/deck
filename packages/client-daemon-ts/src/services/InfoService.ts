/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserHomeDirResponse } from '../models/UserHomeDirResponse';
import type { WorkDirResponse } from '../models/WorkDirResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class InfoService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get user home directory
     * Get the current user home directory path.
     * @returns UserHomeDirResponse OK
     * @throws ApiError
     */
    public getUserHomeDir(): CancelablePromise<UserHomeDirResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/user-home-dir',
        });
    }
    /**
     * Get version
     * Get the current daemon version
     * @returns string OK
     * @throws ApiError
     */
    public getVersion(): CancelablePromise<Record<string, string>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/version',
        });
    }
    /**
     * Get working directory
     * Get the current working directory path. This is default directory used for running commands.
     * @returns WorkDirResponse OK
     * @throws ApiError
     */
    public getWorkDir(): CancelablePromise<WorkDirResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/work-dir',
        });
    }
}
