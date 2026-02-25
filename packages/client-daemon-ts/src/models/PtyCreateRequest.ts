/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PtyCreateRequest = {
    cols?: number;
    cwd?: string;
    envs?: Record<string, string>;
    id?: string;
    /**
     * Don't start PTY until first client connects
     */
    lazyStart?: boolean;
    rows?: number;
};

