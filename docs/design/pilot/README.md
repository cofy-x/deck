# Pilot Design Overview

This directory documents the runtime design of the Pilot suite:

- `host.md` (`pilot-host`): orchestrator and health aggregation
- `bridge.md` (`pilot-bridge`): multi-channel message bridge
- `dingtalk-setup.md`: DingTalk custom robot setup and troubleshooting for `pilot-bridge`
- `server.md` (`pilot-server`): workspace API + approval gateway
- `client-sunset-migration.md`: sunset decision and migration record for consolidating Pilot desktop runtime into `apps/client` (historical record only)

## Runtime Topology

```mermaid
sequenceDiagram
    participant User
    participant Host as pilot-host
    participant OC as OpenCode
    participant PS as pilot-server
    participant PB as pilot-bridge
    participant Msg as Messaging Platforms

    User->>Host: start
    Host->>OC: spawn + wait health
    Host->>PS: spawn + verify workspace
    Host->>PB: spawn + wait health
    Msg->>PB: inbound messages
    PB->>OC: prompt/tool flow
    OC->>PS: workspace operations
    PS-->>OC: file/config responses
    PB-->>Msg: outbound replies
    Host-->>User: status/diagnostics
```

## Design Goals

- Keep host/server/bridge responsibilities clearly separated.
- Make bridge channel expansion additive and observable.
- Keep approval and audit boundaries in server-side write paths.
- Keep operational diagnostics available via health/status endpoints.
