/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// Log format & level
// ---------------------------------------------------------------------------

export type LogFormat = 'pretty' | 'json';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogOutput = 'stdout' | 'silent';

// ---------------------------------------------------------------------------
// Log attributes
// ---------------------------------------------------------------------------

export type LogAttributeValue = string | number | boolean | undefined;

export interface LogAttributes {
  [key: string]: LogAttributeValue;
}

// ---------------------------------------------------------------------------
// Logger interfaces
// ---------------------------------------------------------------------------

export interface LoggerChild {
  log: (level: LogLevel, message: string, attributes?: LogAttributes) => void;
  debug: (message: string, attributes?: LogAttributes) => void;
  info: (message: string, attributes?: LogAttributes) => void;
  warn: (message: string, attributes?: LogAttributes) => void;
  error: (message: string, attributes?: LogAttributes) => void;
}

export interface Logger {
  format: LogFormat;
  output: LogOutput;
  log: (
    level: LogLevel,
    message: string,
    attributes?: LogAttributes,
    component?: string,
  ) => void;
  debug: (
    message: string,
    attributes?: LogAttributes,
    component?: string,
  ) => void;
  info: (
    message: string,
    attributes?: LogAttributes,
    component?: string,
  ) => void;
  warn: (
    message: string,
    attributes?: LogAttributes,
    component?: string,
  ) => void;
  error: (
    message: string,
    attributes?: LogAttributes,
    component?: string,
  ) => void;
  child: (component: string, attributes?: LogAttributes) => LoggerChild;
}

export interface LogEvent {
  time: number;
  level: LogLevel;
  message: string;
  component?: string;
  attributes?: LogAttributes;
}

// ---------------------------------------------------------------------------
// OpenTelemetry resource attributes
// ---------------------------------------------------------------------------

export interface OtelResourceAttributeInput {
  [attribute: string]: string;
}
