/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BrowserOpenRequest } from '../models/BrowserOpenRequest';
import type { ComputerUseStartResponse } from '../models/ComputerUseStartResponse';
import type { ComputerUseStatusResponse } from '../models/ComputerUseStatusResponse';
import type { ComputerUseStopResponse } from '../models/ComputerUseStopResponse';
import type { DisplayInfoResponse } from '../models/DisplayInfoResponse';
import type { Empty } from '../models/Empty';
import type { KeyboardHotkeyRequest } from '../models/KeyboardHotkeyRequest';
import type { KeyboardPressRequest } from '../models/KeyboardPressRequest';
import type { KeyboardTypeRequest } from '../models/KeyboardTypeRequest';
import type { MouseClickRequest } from '../models/MouseClickRequest';
import type { MouseClickResponse } from '../models/MouseClickResponse';
import type { MouseDragRequest } from '../models/MouseDragRequest';
import type { MouseDragResponse } from '../models/MouseDragResponse';
import type { MouseMoveRequest } from '../models/MouseMoveRequest';
import type { MousePositionResponse } from '../models/MousePositionResponse';
import type { MouseScrollRequest } from '../models/MouseScrollRequest';
import type { ProcessErrorsResponse } from '../models/ProcessErrorsResponse';
import type { ProcessLogsResponse } from '../models/ProcessLogsResponse';
import type { ProcessRestartResponse } from '../models/ProcessRestartResponse';
import type { ProcessStatusResponse } from '../models/ProcessStatusResponse';
import type { ScreenshotResponse } from '../models/ScreenshotResponse';
import type { ScrollResponse } from '../models/ScrollResponse';
import type { WindowsResponse } from '../models/WindowsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ComputerUseService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Close browser
     * Force close the browser process and cleanup
     * @returns Empty OK
     * @throws ApiError
     */
    public closeBrowser(): CancelablePromise<Empty> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/browser/close',
        });
    }
    /**
     * Open or navigate browser
     * Open the browser to a specific URL or navigate if already open
     * @param request Browser open parameters
     * @returns Empty OK
     * @throws ApiError
     */
    public openBrowser(
        request: BrowserOpenRequest,
    ): CancelablePromise<Empty> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/browser/open',
            body: request,
        });
    }
    /**
     * Get display information
     * Get information about all available displays
     * @returns DisplayInfoResponse OK
     * @throws ApiError
     */
    public getDisplayInfo(): CancelablePromise<DisplayInfoResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/display/info',
        });
    }
    /**
     * Get windows information
     * Get information about all open windows
     * @returns WindowsResponse OK
     * @throws ApiError
     */
    public getWindows(): CancelablePromise<WindowsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/display/windows',
        });
    }
    /**
     * Press hotkey
     * Press a hotkey combination (e.g., ctrl+c, cmd+v)
     * @param request Hotkey press request
     * @returns Empty OK
     * @throws ApiError
     */
    public pressHotkey(
        request: KeyboardHotkeyRequest,
    ): CancelablePromise<Empty> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/keyboard/hotkey',
            body: request,
        });
    }
    /**
     * Press key
     * Press a key with optional modifiers
     * @param request Key press request
     * @returns Empty OK
     * @throws ApiError
     */
    public pressKey(
        request: KeyboardPressRequest,
    ): CancelablePromise<Empty> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/keyboard/key',
            body: request,
        });
    }
    /**
     * Type text
     * Type text with optional delay between keystrokes
     * @param request Text typing request
     * @returns Empty OK
     * @throws ApiError
     */
    public typeText(
        request: KeyboardTypeRequest,
    ): CancelablePromise<Empty> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/keyboard/type',
            body: request,
        });
    }
    /**
     * Click mouse button
     * Click the mouse button at the specified coordinates
     * @param request Mouse click request
     * @returns MouseClickResponse OK
     * @throws ApiError
     */
    public click(
        request: MouseClickRequest,
    ): CancelablePromise<MouseClickResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/mouse/click',
            body: request,
        });
    }
    /**
     * Drag mouse
     * Drag the mouse from start to end coordinates
     * @param request Mouse drag request
     * @returns MouseDragResponse OK
     * @throws ApiError
     */
    public drag(
        request: MouseDragRequest,
    ): CancelablePromise<MouseDragResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/mouse/drag',
            body: request,
        });
    }
    /**
     * Move mouse cursor
     * Move the mouse cursor to the specified coordinates
     * @param request Mouse move request
     * @returns MousePositionResponse OK
     * @throws ApiError
     */
    public moveMouse(
        request: MouseMoveRequest,
    ): CancelablePromise<MousePositionResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/mouse/move',
            body: request,
        });
    }
    /**
     * Get mouse position
     * Get the current mouse cursor position
     * @returns MousePositionResponse OK
     * @throws ApiError
     */
    public getMousePosition(): CancelablePromise<MousePositionResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/mouse/position',
        });
    }
    /**
     * Scroll mouse wheel
     * Scroll the mouse wheel at the specified coordinates
     * @param request Mouse scroll request
     * @returns ScrollResponse OK
     * @throws ApiError
     */
    public scroll(
        request: MouseScrollRequest,
    ): CancelablePromise<ScrollResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/mouse/scroll',
            body: request,
        });
    }
    /**
     * Get computer use process status
     * Get the status of all computer use processes
     * @returns ComputerUseStatusResponse OK
     * @throws ApiError
     */
    public getComputerUseStatus(): CancelablePromise<ComputerUseStatusResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/process-status',
        });
    }
    /**
     * Get process errors
     * Get errors for a specific computer use process
     * @param processName Process name to get errors for
     * @returns ProcessErrorsResponse OK
     * @throws ApiError
     */
    public getProcessErrors(
        processName: string,
    ): CancelablePromise<ProcessErrorsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/process/{processName}/errors',
            path: {
                'processName': processName,
            },
        });
    }
    /**
     * Get process logs
     * Get logs for a specific computer use process
     * @param processName Process name to get logs for
     * @returns ProcessLogsResponse OK
     * @throws ApiError
     */
    public getProcessLogs(
        processName: string,
    ): CancelablePromise<ProcessLogsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/process/{processName}/logs',
            path: {
                'processName': processName,
            },
        });
    }
    /**
     * Restart specific process
     * Restart a specific computer use process
     * @param processName Process name to restart
     * @returns ProcessRestartResponse OK
     * @throws ApiError
     */
    public restartProcess(
        processName: string,
    ): CancelablePromise<ProcessRestartResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/process/{processName}/restart',
            path: {
                'processName': processName,
            },
        });
    }
    /**
     * Get specific process status
     * Check if a specific computer use process is running
     * @param processName Process name to check
     * @returns ProcessStatusResponse OK
     * @throws ApiError
     */
    public getProcessStatus(
        processName: string,
    ): CancelablePromise<ProcessStatusResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/process/{processName}/status',
            path: {
                'processName': processName,
            },
        });
    }
    /**
     * Take a screenshot
     * Take a screenshot of the entire screen
     * @param showCursor Whether to show cursor in screenshot
     * @returns ScreenshotResponse OK
     * @throws ApiError
     */
    public takeScreenshot(
        showCursor?: boolean,
    ): CancelablePromise<ScreenshotResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/screenshot',
            query: {
                'showCursor': showCursor,
            },
        });
    }
    /**
     * Take a compressed screenshot
     * Take a compressed screenshot of the entire screen
     * @param showCursor Whether to show cursor in screenshot
     * @param format Image format (png or jpeg)
     * @param quality JPEG quality (1-100)
     * @param scale Scale factor (0.1-1.0)
     * @returns ScreenshotResponse OK
     * @throws ApiError
     */
    public takeCompressedScreenshot(
        showCursor?: boolean,
        format?: string,
        quality?: number,
        scale?: number,
    ): CancelablePromise<ScreenshotResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/screenshot/compressed',
            query: {
                'showCursor': showCursor,
                'format': format,
                'quality': quality,
                'scale': scale,
            },
        });
    }
    /**
     * Take a region screenshot
     * Take a screenshot of a specific region of the screen
     * @param x X coordinate of the region
     * @param y Y coordinate of the region
     * @param width Width of the region
     * @param height Height of the region
     * @param showCursor Whether to show cursor in screenshot
     * @returns ScreenshotResponse OK
     * @throws ApiError
     */
    public takeRegionScreenshot(
        x: number,
        y: number,
        width: number,
        height: number,
        showCursor?: boolean,
    ): CancelablePromise<ScreenshotResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/screenshot/region',
            query: {
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'showCursor': showCursor,
            },
        });
    }
    /**
     * Take a compressed region screenshot
     * Take a compressed screenshot of a specific region of the screen
     * @param x X coordinate of the region
     * @param y Y coordinate of the region
     * @param width Width of the region
     * @param height Height of the region
     * @param showCursor Whether to show cursor in screenshot
     * @param format Image format (png or jpeg)
     * @param quality JPEG quality (1-100)
     * @param scale Scale factor (0.1-1.0)
     * @returns ScreenshotResponse OK
     * @throws ApiError
     */
    public takeCompressedRegionScreenshot(
        x: number,
        y: number,
        width: number,
        height: number,
        showCursor?: boolean,
        format?: string,
        quality?: number,
        scale?: number,
    ): CancelablePromise<ScreenshotResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/screenshot/region/compressed',
            query: {
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'showCursor': showCursor,
                'format': format,
                'quality': quality,
                'scale': scale,
            },
        });
    }
    /**
     * Start computer use processes
     * Start all computer use processes and return their status
     * @returns ComputerUseStartResponse OK
     * @throws ApiError
     */
    public startComputerUse(): CancelablePromise<ComputerUseStartResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/start',
        });
    }
    /**
     * Get computer use status
     * Get the current status of the computer use system
     * @returns ComputerUseStatusResponse OK
     * @throws ApiError
     */
    public getComputerUseSystemStatus(): CancelablePromise<ComputerUseStatusResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/computeruse/status',
        });
    }
    /**
     * Stop computer use processes
     * Stop all computer use processes and return their status
     * @returns ComputerUseStopResponse OK
     * @throws ApiError
     */
    public stopComputerUse(): CancelablePromise<ComputerUseStopResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/computeruse/stop',
        });
    }
}
