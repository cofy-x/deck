/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PtySessionInfo = {
    active?: boolean;
    cols?: number;
    createdAt?: string;
    cwd?: string;
    envs?: Record<string, string>;
    id?: string;
    /**
     * Whether this session uses lazy start
     */
    lazyStart?: boolean;
    rows?: number;
};

