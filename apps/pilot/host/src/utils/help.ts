/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_OPENCODE_USERNAME } from './process.js';

// ---------------------------------------------------------------------------
// Attach command builder
// ---------------------------------------------------------------------------

interface AttachCommandInput {
  url: string;
  workspace: string;
  username?: string;
  password?: string;
}

export function buildAttachCommand(input: AttachCommandInput): string {
  const parts: string[] = [];
  if (
    input.username &&
    input.password &&
    input.username !== DEFAULT_OPENCODE_USERNAME
  ) {
    parts.push(`OPENCODE_SERVER_USERNAME=${input.username}`);
  }
  if (input.password) {
    parts.push(`OPENCODE_SERVER_PASSWORD=${input.password}`);
  }
  parts.push('opencode', 'attach', input.url, '--dir', input.workspace);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// CLI help text
// ---------------------------------------------------------------------------

export function printHelp(): void {
  const message = [
    'pilot-host',
    '',
    'Usage:',
    '  pilot-host start [--workspace <path>] [options]',
    '  pilot-host serve [--workspace <path>] [options]',
    '  pilot-host daemon [run|start|stop|status] [options]',
    '  pilot-host workspace <action> [options]',
    '  pilot-host instance dispose <id> [options]',
    '  pilot-host approvals list --pilot-url <url> --host-token <token>',
    '  pilot-host approvals reply <id> --allow|--deny --pilot-url <url> --host-token <token>',
    '  pilot-host status [--pilot-url <url>] [--opencode-url <url>] [--bridge-url <url>]',
    '',
    'Commands:',
    '  start                   Start OpenCode + Pilot server + Bridge',
    '  serve                   Start services and stream logs (no TUI)',
    '  daemon                  Run router daemon (multi-workspace)',
    '  workspace               Manage workspaces (add/list/switch/path)',
    '  instance                Manage workspace instances (dispose)',
    '  approvals list          List pending approval requests',
    '  approvals reply <id>    Approve or deny a request',
    '  status                  Check OpenCode/Pilot/Bridge health (non-zero exit on failure)',
    '',
    'Options:',
    '  --workspace <path>        Workspace directory (default: cwd)',
    '  --data-dir <path>         Data dir for router state',
    '  --daemon-host <host>      Host for router daemon (default: 127.0.0.1)',
    '  --daemon-port <port>      Port for router daemon (default: random)',
    '  --opencode-bin <path>     Path to opencode binary (requires --allow-external)',
    '  --opencode-url <url>      Use an existing OpenCode server (skip spawning opencode)',
    '  --opencode-host <host>    Bind host for opencode serve (default: 0.0.0.0)',
    '  --opencode-port <port>    Port for opencode serve (default: random)',
    '  --opencode-workdir <p>    Workdir for router-managed opencode serve',
    '  --opencode-auth           Enable OpenCode basic auth (default: true)',
    '  --no-opencode-auth        Disable OpenCode basic auth',
    '  --opencode-username <u>   OpenCode basic auth username',
    '  --opencode-password <p>   OpenCode basic auth password',
    '  --pilot-host <host>       Bind host for pilot-server (default: 0.0.0.0)',
    '  --pilot-port <port>       Port for pilot-server (default: 8787)',
    '  --pilot-url <url>         Use an existing Pilot server (skip spawning pilot-server)',
    '  --pilot-token <token>     Client token for pilot-server',
    '  --pilot-host-token <t>    Host token for approvals',
    '  --bridge-url <url>        Bridge health URL (skip spawning bridge in start/serve; also used by status)',
    '  --approval <mode>         manual | auto (default: manual)',
    '  --approval-timeout <ms>   Approval timeout in ms',
    '  --read-only               Start Pilot server in read-only mode',
    '  --cors <origins>          Comma-separated CORS origins or *',
    '  --connect-host <host>     Override LAN host used for pairing URLs',
    '  --pilot-server-bin <p>    Path to pilot-server binary (requires --allow-external)',
    '  --bridge-bin <path>       Path to bridge binary (requires --allow-external)',
    '  --bridge-health-port <p>  Health server port for bridge (default: 3005)',
    '  --no-bridge               Disable bridge sidecar',
    '  --bridge-required         Exit if bridge stops',
    '  --allow-external          Allow external sidecar binaries',
    '  --sidecar-dir <path>      Cache directory for downloaded sidecars',
    '  --sidecar-base-url <url>  Base URL for sidecar downloads',
    '  --sidecar-manifest <url>  Override sidecar manifest URL',
    '  --sidecar-source <mode>   auto | bundled | downloaded | external',
    '  --opencode-source <mode>  auto | bundled | downloaded | external',
    '  --check                   Run health checks then exit',
    '  --check-events            Verify SSE events during check',
    '  --detach                  Detach after start and keep services running',
    '  --json                    Output JSON when applicable (single JSON document only)',
    '  --verbose                 Print additional diagnostics',
    '  --log-format <format>     Log output format: pretty | json',
    '  --color                   Force ANSI color output',
    '  --no-color                Disable ANSI color output',
    '  --run-id <id>             Correlation id for logs (default: random UUID)',
    '',
    'Conflicts:',
    '  --opencode-url with --opencode-host/--opencode-port',
    '  --pilot-url with --pilot-host/--pilot-port/--pilot-server-bin',
    '  --bridge-url with --bridge-bin/--bridge-health-port/--no-bridge',
    '  --help                    Show help',
    '  --version                 Show version',
  ].join('\n');
  process.stdout.write(`${message}\n`);
}
