/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FileInfo } from '../models/FileInfo';
import type { FilesDownloadRequest } from '../models/FilesDownloadRequest';
import type { H } from '../models/H';
import type { Match } from '../models/Match';
import type { ReplaceRequest } from '../models/ReplaceRequest';
import type { ReplaceResult } from '../models/ReplaceResult';
import type { SearchFilesResponse } from '../models/SearchFilesResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class FileSystemService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List files and directories
     * List files and directories in the specified path
     * @param path Directory path to list (defaults to working directory)
     * @returns FileInfo OK
     * @throws ApiError
     */
    public listFiles(
        path?: string,
    ): CancelablePromise<Array<FileInfo>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/files',
            query: {
                'path': path,
            },
        });
    }
    /**
     * Delete a file or directory
     * Delete a file or directory at the specified path
     * @param path File or directory path to delete
     * @param recursive Enable recursive deletion for directories
     * @returns void
     * @throws ApiError
     */
    public deleteFile(
        path: string,
        recursive?: boolean,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/files',
            query: {
                'path': path,
                'recursive': recursive,
            },
        });
    }
    /**
     * Download multiple files
     * Download multiple files by providing their paths
     * @param downloadFiles Paths of files to download
     * @returns H OK
     * @throws ApiError
     */
    public downloadFiles(
        downloadFiles: FilesDownloadRequest,
    ): CancelablePromise<H> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/files/bulk-download',
            body: downloadFiles,
        });
    }
    /**
     * Upload multiple files
     * Upload multiple files with their destination paths
     * @returns any OK
     * @throws ApiError
     */
    public uploadFiles(): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/files/bulk-upload',
        });
    }
    /**
     * Download a file
     * Download a file by providing its path
     * @param path File path to download
     * @returns binary OK
     * @throws ApiError
     */
    public downloadFile(
        path: string,
    ): CancelablePromise<Blob> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/files/download',
            query: {
                'path': path,
            },
        });
    }
    /**
     * Find text in files
     * Search for text pattern within files in a directory
     * @param path Directory path to search in
     * @param pattern Text pattern to search for
     * @returns Match OK
     * @throws ApiError
     */
    public findInFiles(
        path: string,
        pattern: string,
    ): CancelablePromise<Array<Match>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/files/find',
            query: {
                'path': path,
                'pattern': pattern,
            },
        });
    }
    /**
     * Create a folder
     * Create a folder with the specified path and optional permissions
     * @param path Folder path to create
     * @param mode Octal permission mode (default: 0755)
     * @returns any Created
     * @throws ApiError
     */
    public createFolder(
        path: string,
        mode: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/files/folder',
            query: {
                'path': path,
                'mode': mode,
            },
        });
    }
    /**
     * Get file information
     * Get detailed information about a file or directory
     * @param path File or directory path
     * @returns FileInfo OK
     * @throws ApiError
     */
    public getFileInfo(
        path: string,
    ): CancelablePromise<FileInfo> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/files/info',
            query: {
                'path': path,
            },
        });
    }
    /**
     * Move or rename file/directory
     * Move or rename a file or directory from source to destination
     * @param source Source file or directory path
     * @param destination Destination file or directory path
     * @returns any OK
     * @throws ApiError
     */
    public moveFile(
        source: string,
        destination: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/files/move',
            query: {
                'source': source,
                'destination': destination,
            },
        });
    }
    /**
     * Set file permissions
     * Set file permissions, ownership, and group for a file or directory
     * @param path File or directory path
     * @param owner Owner (username or UID)
     * @param group Group (group name or GID)
     * @param mode File mode in octal format (e.g., 0755)
     * @returns any OK
     * @throws ApiError
     */
    public setFilePermissions(
        path: string,
        owner?: string,
        group?: string,
        mode?: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/files/permissions',
            query: {
                'path': path,
                'owner': owner,
                'group': group,
                'mode': mode,
            },
        });
    }
    /**
     * Replace text in files
     * Replace text pattern with new value in multiple files
     * @param request Replace request
     * @returns ReplaceResult OK
     * @throws ApiError
     */
    public replaceInFiles(
        request: ReplaceRequest,
    ): CancelablePromise<Array<ReplaceResult>> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/files/replace',
            body: request,
        });
    }
    /**
     * Search files by pattern
     * Search for files matching a specific pattern in a directory
     * @param path Directory path to search in
     * @param pattern File pattern to match (e.g., *.txt, *.go)
     * @returns SearchFilesResponse OK
     * @throws ApiError
     */
    public searchFiles(
        path: string,
        pattern: string,
    ): CancelablePromise<SearchFilesResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/files/search',
            query: {
                'path': path,
                'pattern': pattern,
            },
        });
    }
    /**
     * Upload a file
     * Upload a file to the specified path
     * @param path Destination path for the uploaded file
     * @param file File to upload
     * @returns H OK
     * @throws ApiError
     */
    public uploadFile(
        path: string,
        file: Blob,
    ): CancelablePromise<H> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/files/upload',
            query: {
                'path': path,
            },
            formData: {
                'file': file,
            },
        });
    }
}
