/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GitAddRequest } from '../models/GitAddRequest';
import type { GitBranchRequest } from '../models/GitBranchRequest';
import type { GitCheckoutRequest } from '../models/GitCheckoutRequest';
import type { GitCloneRequest } from '../models/GitCloneRequest';
import type { GitCommitInfo } from '../models/GitCommitInfo';
import type { GitCommitRequest } from '../models/GitCommitRequest';
import type { GitCommitResponse } from '../models/GitCommitResponse';
import type { GitDeleteBranchRequest } from '../models/GitDeleteBranchRequest';
import type { GitRepoRequest } from '../models/GitRepoRequest';
import type { GitStatus } from '../models/GitStatus';
import type { ListBranchResponse } from '../models/ListBranchResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class GitService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Add files to Git staging
     * Add files to the Git staging area
     * @param request Add files request
     * @returns any OK
     * @throws ApiError
     */
    public addFiles(
        request: GitAddRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/add',
            body: request,
        });
    }
    /**
     * List branches
     * Get a list of all branches in the Git repository
     * @param path Repository path
     * @returns ListBranchResponse OK
     * @throws ApiError
     */
    public listBranches(
        path: string,
    ): CancelablePromise<ListBranchResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/branches',
            query: {
                'path': path,
            },
        });
    }
    /**
     * Create a new branch
     * Create a new branch in the Git repository
     * @param request Create branch request
     * @returns any Created
     * @throws ApiError
     */
    public createBranch(
        request: GitBranchRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/branches',
            body: request,
        });
    }
    /**
     * Delete a branch
     * Delete a branch from the Git repository
     * @param request Delete branch request
     * @returns void
     * @throws ApiError
     */
    public deleteBranch(
        request: GitDeleteBranchRequest,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/git/branches',
            body: request,
        });
    }
    /**
     * Checkout branch or commit
     * Switch to a different branch or commit in the Git repository
     * @param request Checkout request
     * @returns any OK
     * @throws ApiError
     */
    public checkoutBranch(
        request: GitCheckoutRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/checkout',
            body: request,
        });
    }
    /**
     * Clone a Git repository
     * Clone a Git repository to the specified path
     * @param request Clone repository request
     * @returns any OK
     * @throws ApiError
     */
    public cloneRepository(
        request: GitCloneRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/clone',
            body: request,
        });
    }
    /**
     * Commit changes
     * Commit staged changes to the Git repository
     * @param request Commit request
     * @returns GitCommitResponse OK
     * @throws ApiError
     */
    public commitChanges(
        request: GitCommitRequest,
    ): CancelablePromise<GitCommitResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/commit',
            body: request,
        });
    }
    /**
     * Get commit history
     * Get the commit history of the Git repository
     * @param path Repository path
     * @returns GitCommitInfo OK
     * @throws ApiError
     */
    public getCommitHistory(
        path: string,
    ): CancelablePromise<Array<GitCommitInfo>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/history',
            query: {
                'path': path,
            },
        });
    }
    /**
     * Pull changes from remote
     * Pull changes from the remote Git repository
     * @param request Pull request
     * @returns any OK
     * @throws ApiError
     */
    public pullChanges(
        request: GitRepoRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/pull',
            body: request,
        });
    }
    /**
     * Push changes to remote
     * Push local changes to the remote Git repository
     * @param request Push request
     * @returns any OK
     * @throws ApiError
     */
    public pushChanges(
        request: GitRepoRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/push',
            body: request,
        });
    }
    /**
     * Get Git status
     * Get the Git status of the repository at the specified path
     * @param path Repository path
     * @returns GitStatus OK
     * @throws ApiError
     */
    public getStatus(
        path: string,
    ): CancelablePromise<GitStatus> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/status',
            query: {
                'path': path,
            },
        });
    }
}
