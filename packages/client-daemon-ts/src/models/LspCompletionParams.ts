/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CompletionContext } from './CompletionContext';
import type { LspPosition } from './LspPosition';
export type LspCompletionParams = {
    context?: CompletionContext;
    languageId: string;
    pathToProject: string;
    position: LspPosition;
    uri: string;
};

