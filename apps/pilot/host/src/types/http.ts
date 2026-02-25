/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// HTTP header map
// ---------------------------------------------------------------------------

export interface HttpHeaders {
  [header: string]: string;
}

// ---------------------------------------------------------------------------
// Connect URLs (LAN / mDNS discovery)
// ---------------------------------------------------------------------------

export interface ConnectUrls {
  connectUrl?: string;
  lanUrl?: string;
  mdnsUrl?: string;
}
