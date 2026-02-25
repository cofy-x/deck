/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import axios, {
  type AxiosError,
  type AxiosInstance,
  type CreateAxiosDefaults,
  isAxiosError,
  isCancel,
} from 'axios';
import { toast } from 'sonner';

/**
 * Standard API error response structure from backend
 */
export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  code?: string;
  error?: string;
  timestamp?: string;
  path?: string;
  method?: string;
}

/**
 * Options for error toast deduplication
 */
export interface ErrorToastOptions {
  /** Toast ID for deduplication - same ID will only show one toast */
  toastId?: string;
  /** Whether to show toast (default: true) */
  showToast?: boolean;
}

// Track shown toast IDs to prevent duplicates within a time window
const shownToastIds = new Map<string, number>();
const TOAST_DEDUP_WINDOW_MS = 2000; // 2 seconds

/**
 * Show error toast with deduplication support
 */
function showErrorToast(message: string, options?: ErrorToastOptions): void {
  if (options?.showToast === false) return;

  const toastId = options?.toastId;

  if (toastId) {
    const lastShown = shownToastIds.get(toastId);
    const now = Date.now();

    // Skip if same toast was shown within dedup window
    if (lastShown && now - lastShown < TOAST_DEDUP_WINDOW_MS) {
      return;
    }

    shownToastIds.set(toastId, now);
    toast.error(message, { id: toastId });
  } else {
    toast.error(message);
  }
}

/**
 * Parse error message from various error response formats
 */
export function parseErrorMessage(error: unknown): string {
  // Handle AxiosError
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const data = axiosError.response?.data;

    // Try to extract message from response data
    if (data) {
      if (typeof data === 'string') {
        return data;
      }
      if (data.message) {
        return data.message;
      }
      if (data.error) {
        return data.error;
      }
    }

    // Fallback to axios error message
    return axiosError.message || 'Request failed';
  }

  // Handle standard Error
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

/**
 * Create error response interceptor with toast support
 */
function createErrorInterceptor(options?: {
  /** Toast ID prefix for deduplication */
  toastIdPrefix?: string;
}) {
  return (error: AxiosError<ApiErrorResponse>) => {
    const message = parseErrorMessage(error);
    const status = error.response?.status;

    // Generate toast ID for deduplication
    const toastId = options?.toastIdPrefix
      ? `${options.toastIdPrefix}-${message}`
      : undefined;

    // Show toast for all errors except cancelled requests
    if (!isCancel(error)) {
      // Customize message based on status code
      if (status === 401) {
        showErrorToast('Unauthorized: Please log in again', { toastId });
      } else if (status === 403) {
        showErrorToast('Forbidden: You do not have permission', { toastId });
      } else if (status === 404) {
        showErrorToast(`Not found: ${message}`, { toastId });
      } else if (status === 500) {
        showErrorToast(`Server error: ${message}`, { toastId });
      } else if (status && status >= 400) {
        showErrorToast(message, { toastId });
      } else if (error.code === 'ERR_NETWORK') {
        showErrorToast('Network error: Unable to connect to server', {
          toastId,
        });
      } else {
        showErrorToast(message, { toastId });
      }
    }

    // Re-throw error so callers can still handle it
    return Promise.reject(error);
  };
}

/**
 * Axios instance configured for Deck API (NestJS backend)
 */
export const AXIOS_INSTANCE = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

// Add error interceptor
AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  createErrorInterceptor(),
);

/**
 * Create a custom axios instance with error handling
 * Useful for different API endpoints (e.g., Runner Toolbox API)
 */
export function createAxiosInstance(
  config: CreateAxiosDefaults & {
    /** Toast ID prefix for error deduplication */
    toastIdPrefix?: string;
  },
): AxiosInstance {
  const { toastIdPrefix, ...axiosConfig } = config;
  const instance = axios.create(axiosConfig);

  instance.interceptors.response.use(
    (response) => response,
    createErrorInterceptor({ toastIdPrefix }),
  );

  return instance;
}

/**
 * Custom axios instance for orval-generated API client.
 *
 * Orval generates response types that include { data, status, headers }.
 * This custom instance wraps axios response to match orval's expected format.
 *
 * @param url - The API endpoint URL
 * @param options - RequestInit-like options (method, body, headers, etc.)
 */
export const customInstance = <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const controller = new AbortController();

  // Convert RequestInit to axios config and return orval-compatible response
  const promise = AXIOS_INSTANCE({
    url,
    method: options?.method as string,
    data: options?.body,
    headers: options?.headers as Record<string, string>,
    signal: controller.signal,
  }).then((response) => {
    // Convert axios headers to Headers object for orval compatibility
    const headers = new Headers();
    Object.entries(response.headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        headers.set(key, String(value));
      }
    });

    // Return orval-expected response structure: { data, status, headers }
    return {
      data: response.data,
      status: response.status,
      headers,
    } as T;
  });

  // @ts-expect-error - Adding cancel method to promise for React Query
  promise.cancel = () => {
    controller.abort();
  };

  return promise;
};

/**
 * Type for API errors
 */
export type ErrorType<Error> = AxiosError<Error>;

/**
 * Type for request body
 */
export type BodyType<BodyData> = BodyData;
