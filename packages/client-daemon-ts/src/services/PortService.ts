/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IsPortInUseResponse } from '../models/IsPortInUseResponse';
import type { PortList } from '../models/PortList';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class PortService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get active ports
     * Get a list of all currently active ports
     * @returns PortList OK
     * @throws ApiError
     */
    public getPorts(): CancelablePromise<PortList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/port',
        });
    }
    /**
     * Check if port is in use
     * Check if a specific port is currently in use
     * @param port Port number (3000-9999)
     * @returns IsPortInUseResponse OK
     * @throws ApiError
     */
    public isPortInUse(
        port: number,
    ): CancelablePromise<IsPortInUseResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/port/{port}/in-use',
            path: {
                'port': port,
            },
        });
    }
}
