/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateContextRequest } from '../models/CreateContextRequest';
import type { InterpreterContext } from '../models/InterpreterContext';
import type { ListContextsResponse } from '../models/ListContextsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class InterpreterService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List all user-created interpreter contexts
     * Returns information about all user-created interpreter contexts (excludes default context)
     * @returns ListContextsResponse OK
     * @throws ApiError
     */
    public listInterpreterContexts(): CancelablePromise<ListContextsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/interpreter/context',
        });
    }
    /**
     * Create a new interpreter context
     * Creates a new isolated interpreter context with optional working directory and language
     * @param request Context configuration
     * @returns InterpreterContext OK
     * @throws ApiError
     */
    public createInterpreterContext(
        request: CreateContextRequest,
    ): CancelablePromise<InterpreterContext> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/process/interpreter/context',
            body: request,
            errors: {
                400: `Bad Request`,
                500: `Internal Server Error`,
            },
        });
    }
    /**
     * Delete an interpreter context
     * Deletes an interpreter context and shuts down its worker process
     * @param id Context ID
     * @returns string OK
     * @throws ApiError
     */
    public deleteInterpreterContext(
        id: string,
    ): CancelablePromise<Record<string, string>> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/process/interpreter/context/{id}',
            path: {
                'id': id,
            },
            errors: {
                400: `Bad Request`,
                404: `Not Found`,
            },
        });
    }
    /**
     * Execute code in an interpreter context
     * Executes code in a specified context (or default context if not specified) via WebSocket streaming
     * @returns void
     * @throws ApiError
     */
    public executeInterpreterCode(): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/process/interpreter/execute',
        });
    }
}
