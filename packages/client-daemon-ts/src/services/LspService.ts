/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CompletionList } from '../models/CompletionList';
import type { LspCompletionParams } from '../models/LspCompletionParams';
import type { LspDocumentRequest } from '../models/LspDocumentRequest';
import type { LspServerRequest } from '../models/LspServerRequest';
import type { LspSymbol } from '../models/LspSymbol';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class LspService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get code completions
     * Get code completion suggestions from the LSP server
     * @param request Completion request
     * @returns CompletionList OK
     * @throws ApiError
     */
    public completions(
        request: LspCompletionParams,
    ): CancelablePromise<CompletionList> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/lsp/completions',
            body: request,
        });
    }
    /**
     * Notify document closed
     * Notify the LSP server that a document has been closed
     * @param request Document request
     * @returns any OK
     * @throws ApiError
     */
    public didClose(
        request: LspDocumentRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/lsp/did-close',
            body: request,
        });
    }
    /**
     * Notify document opened
     * Notify the LSP server that a document has been opened
     * @param request Document request
     * @returns any OK
     * @throws ApiError
     */
    public didOpen(
        request: LspDocumentRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/lsp/did-open',
            body: request,
        });
    }
    /**
     * Get document symbols
     * Get symbols (functions, classes, etc.) from a document
     * @param languageId Language ID (e.g., python, typescript)
     * @param pathToProject Path to project
     * @param uri Document URI
     * @returns LspSymbol OK
     * @throws ApiError
     */
    public documentSymbols(
        languageId: string,
        pathToProject: string,
        uri: string,
    ): CancelablePromise<Array<LspSymbol>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/lsp/document-symbols',
            query: {
                'languageId': languageId,
                'pathToProject': pathToProject,
                'uri': uri,
            },
        });
    }
    /**
     * Start LSP server
     * Start a Language Server Protocol server for the specified language
     * @param request LSP server request
     * @returns any OK
     * @throws ApiError
     */
    public start(
        request: LspServerRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/lsp/start',
            body: request,
        });
    }
    /**
     * Stop LSP server
     * Stop a Language Server Protocol server
     * @param request LSP server request
     * @returns any OK
     * @throws ApiError
     */
    public stop(
        request: LspServerRequest,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/lsp/stop',
            body: request,
        });
    }
    /**
     * Get workspace symbols
     * Search for symbols across the entire workspace
     * @param query Search query
     * @param languageId Language ID (e.g., python, typescript)
     * @param pathToProject Path to project
     * @returns LspSymbol OK
     * @throws ApiError
     */
    public workspaceSymbols(
        query: string,
        languageId: string,
        pathToProject: string,
    ): CancelablePromise<Array<LspSymbol>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/lsp/workspacesymbols',
            query: {
                'query': query,
                'languageId': languageId,
                'pathToProject': pathToProject,
            },
        });
    }
}
