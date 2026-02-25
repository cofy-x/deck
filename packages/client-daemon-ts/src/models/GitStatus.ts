/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FileStatus } from './FileStatus';
export type GitStatus = {
    ahead?: number;
    behind?: number;
    branchPublished?: boolean;
    currentBranch: string;
    fileStatus: Array<FileStatus>;
};

