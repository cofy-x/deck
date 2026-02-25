/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { ADAPTER_REGISTRY } from '../../../adapters/index.js';
import type { AdapterRegistration } from '../../../adapters/index.js';
import { BridgeStore } from '../../../db.js';
import type { Config } from '../../../types/index.js';

export interface StoreBootstrapInput {
  config: Config;
  store?: BridgeStore;
  adapterRegistry?: AdapterRegistration[];
}

export function bootstrapStore(input: StoreBootstrapInput): BridgeStore {
  const store = input.store ?? new BridgeStore(input.config.dbPath);
  const registry = input.adapterRegistry ?? ADAPTER_REGISTRY;

  for (const registration of registry) {
    const peers = registration.seedAllowlist?.(input.config);
    if (peers) {
      store.seedAllowlist(registration.name, peers);
    }
  }
  store.prunePairingRequests();

  return store;
}
