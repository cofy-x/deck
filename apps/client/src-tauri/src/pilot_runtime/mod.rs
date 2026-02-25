mod bridge;
mod health_normalize;
mod host;
mod manager;
mod server;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_shell::process::CommandEvent;
use uuid::Uuid;

use self::bridge::{
    localhost_health_url, resolve_pilot_bridge_health_port, spawn_pilot_bridge,
    wait_for_pilot_bridge_healthy, PilotBridgeSpawnOptions,
};
use self::health_normalize::{normalize_bridge_health_snapshot, PilotBridgeHealthSnapshot};
use self::host::{
    fetch_pilot_host_health, resolve_free_local_port, resolve_pilot_host_data_dir,
    spawn_pilot_host_daemon, wait_for_pilot_host, PilotHostSpawnOptions,
};
use self::manager::{PilotProcessState, PilotRuntimeState};
use self::server::{
    localhost_base_url, resolve_pilot_server_port, spawn_pilot_server,
    wait_for_pilot_server_healthy, PilotServerSpawnOptions,
};

pub use self::manager::PilotRuntimeManager;

const OPENCODE_DEFAULT_USERNAME: &str = "opencode";

// ---------------------------------------------------------------------------
// Public runtime types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotRuntimeStartInput {
    pub workspace_path: String,
    pub opencode_url: Option<String>,
    pub opencode_username: Option<String>,
    pub opencode_password: Option<String>,
    pub bridge_health_port: Option<u16>,
    pub pilot_server_port: Option<u16>,
    pub host_data_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotComponentStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub url: Option<String>,
    pub last_stdout: Option<String>,
    pub last_stderr: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotRuntimeComponentsStatus {
    pub host: PilotComponentStatus,
    pub server: PilotComponentStatus,
    pub bridge: PilotComponentStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotRuntimeStateStatus {
    pub running: bool,
    pub workspace_path: Option<String>,
    pub opencode_url: Option<String>,
    pub opencode_username: Option<String>,
    pub opencode_password: Option<String>,
    pub host_data_dir: Option<String>,
    pub bridge_health_port: Option<u16>,
    pub components: PilotRuntimeComponentsStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotRuntimeComponents {
    pub host: PilotComponentStatus,
    pub server: PilotComponentStatus,
    pub bridge: PilotComponentStatus,
    pub opencode: PilotComponentStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotRuntimeStatus {
    pub running: bool,
    pub workspace_path: Option<String>,
    pub opencode_url: Option<String>,
    pub opencode_username: Option<String>,
    pub opencode_password: Option<String>,
    pub host_data_dir: Option<String>,
    pub bridge_health_port: Option<u16>,
    pub components: PilotRuntimeComponents,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotServiceHealthStatus {
    pub ok: bool,
    pub url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotBridgeServiceHealthStatus {
    pub ok: bool,
    pub url: Option<String>,
    pub error: Option<String>,
    pub snapshot: Option<PilotBridgeHealthSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotRuntimeHealth {
    pub ok: bool,
    pub host: PilotServiceHealthStatus,
    pub server: PilotServiceHealthStatus,
    pub bridge: PilotBridgeServiceHealthStatus,
}

// ---------------------------------------------------------------------------
// Runtime command internals
// ---------------------------------------------------------------------------

#[derive(Clone, Copy)]
enum ProcessKind {
    Host,
    Server,
    Bridge,
}

fn truncate_output(input: &str, max_chars: usize) -> String {
    let chars: Vec<char> = input.chars().collect();
    if chars.len() <= max_chars {
        return input.to_string();
    }
    chars[chars.len() - max_chars..].iter().collect()
}

fn process_state_mut<'a>(
    state: &'a mut PilotRuntimeState,
    kind: ProcessKind,
) -> &'a mut PilotProcessState {
    match kind {
        ProcessKind::Host => &mut state.host,
        ProcessKind::Server => &mut state.server,
        ProcessKind::Bridge => &mut state.bridge,
    }
}

fn spawn_process_monitor(
    state_handle: std::sync::Arc<std::sync::Mutex<PilotRuntimeState>>,
    kind: ProcessKind,
    mut rx: tauri::async_runtime::Receiver<CommandEvent>,
) {
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes).to_string();
                    if let Ok(mut state) = state_handle.try_lock() {
                        let process = process_state_mut(&mut state, kind);
                        let next = process
                            .last_stdout
                            .as_deref()
                            .unwrap_or_default()
                            .to_string()
                            + &line;
                        process.last_stdout = Some(truncate_output(&next, 8000));
                    }
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes).to_string();
                    if let Ok(mut state) = state_handle.try_lock() {
                        let process = process_state_mut(&mut state, kind);
                        let next = process
                            .last_stderr
                            .as_deref()
                            .unwrap_or_default()
                            .to_string()
                            + &line;
                        process.last_stderr = Some(truncate_output(&next, 8000));
                    }
                }
                CommandEvent::Terminated(payload) => {
                    if let Ok(mut state) = state_handle.try_lock() {
                        let process = process_state_mut(&mut state, kind);
                        process.child_exited = true;
                        if let Some(code) = payload.code {
                            process.last_stderr = Some(truncate_output(
                                &format!("process exited with code {code}"),
                                8000,
                            ));
                        }
                    }
                }
                CommandEvent::Error(message) => {
                    if let Ok(mut state) = state_handle.try_lock() {
                        let process = process_state_mut(&mut state, kind);
                        process.child_exited = true;
                        let next = process
                            .last_stderr
                            .as_deref()
                            .unwrap_or_default()
                            .to_string()
                            + &message;
                        process.last_stderr = Some(truncate_output(&next, 8000));
                    }
                }
                _ => {}
            }
        }
    });
}

fn trim_non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn derive_opencode_component(
    snapshot: &PilotRuntimeStateStatus,
    host_component: &PilotComponentStatus,
) -> PilotComponentStatus {
    let mut component = PilotComponentStatus {
        running: false,
        pid: None,
        url: snapshot.opencode_url.clone(),
        last_stdout: None,
        last_stderr: None,
    };

    if !host_component.running {
        return component;
    }

    let Some(host_url) = host_component.url.as_deref() else {
        return component;
    };

    match fetch_pilot_host_health(host_url) {
        Ok(health) if health.ok => {
            if let Some(opencode) = health.opencode {
                component.running = true;
                component.pid = Some(opencode.pid);
                component.url = Some(format!("http://127.0.0.1:{}", opencode.port));
            }
        }
        Ok(_) => {
            component.last_stderr = Some("pilot-host reported unhealthy status".to_string());
        }
        Err(error) => {
            component.last_stderr = Some(error);
        }
    }

    component
}

fn build_runtime_status(snapshot: PilotRuntimeStateStatus) -> PilotRuntimeStatus {
    let opencode = derive_opencode_component(&snapshot, &snapshot.components.host);
    PilotRuntimeStatus {
        running: snapshot.running,
        workspace_path: snapshot.workspace_path,
        opencode_url: snapshot.opencode_url,
        opencode_username: snapshot.opencode_username,
        opencode_password: snapshot.opencode_password,
        host_data_dir: snapshot.host_data_dir,
        bridge_health_port: snapshot.bridge_health_port,
        components: PilotRuntimeComponents {
            host: snapshot.components.host,
            server: snapshot.components.server,
            bridge: snapshot.components.bridge,
            opencode,
        },
    }
}

fn make_component_health(
    url: Option<String>,
    check: Result<(), String>,
) -> PilotServiceHealthStatus {
    match check {
        Ok(()) => PilotServiceHealthStatus {
            ok: true,
            url,
            error: None,
        },
        Err(error) => PilotServiceHealthStatus {
            ok: false,
            url,
            error: Some(error),
        },
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn pilot_runtime_start(
    app: AppHandle,
    manager: State<'_, PilotRuntimeManager>,
    input: PilotRuntimeStartInput,
) -> Result<PilotRuntimeStatus, String> {
    let workspace_path = input.workspace_path.trim().to_string();
    if workspace_path.is_empty() {
        return Err("workspacePath is required".to_string());
    }

    std::fs::create_dir_all(&workspace_path)
        .map_err(|error| format!("Failed to create workspace directory: {error}"))?;

    let opencode_password =
        trim_non_empty(input.opencode_password).unwrap_or_else(|| Uuid::new_v4().to_string());
    let opencode_username = trim_non_empty(input.opencode_username)
        .unwrap_or_else(|| OPENCODE_DEFAULT_USERNAME.to_string());

    let host_data_dir = resolve_pilot_host_data_dir(input.host_data_dir.as_deref());
    let host_daemon_port = resolve_free_local_port()?;
    let opencode_port = resolve_free_local_port()?;
    let bridge_health_port = resolve_pilot_bridge_health_port(input.bridge_health_port)?;
    let pilot_server_port = resolve_pilot_server_port(input.pilot_server_port)?;

    {
        let mut state = manager
            .inner
            .lock()
            .map_err(|_| "pilot runtime mutex poisoned".to_string())?;
        PilotRuntimeManager::stop_locked(&mut state);
        state.workspace_path = Some(workspace_path.clone());
        state.opencode_username = Some(opencode_username.clone());
        state.opencode_password = Some(opencode_password.clone());
        state.host_data_dir = Some(host_data_dir.clone());
        state.bridge_health_port = Some(bridge_health_port);
    }

    let host_options = PilotHostSpawnOptions {
        data_dir: host_data_dir,
        daemon_port: host_daemon_port,
        workspace_path: workspace_path.clone(),
        opencode_host: "0.0.0.0".to_string(),
        opencode_port,
        opencode_username: opencode_username.clone(),
        opencode_password: opencode_password.clone(),
    };

    let host_base_url = format!("http://127.0.0.1:{host_daemon_port}");
    let (host_rx, host_child) = spawn_pilot_host_daemon(&app, &host_options)?;
    {
        let mut state = manager
            .inner
            .lock()
            .map_err(|_| "pilot runtime mutex poisoned".to_string())?;
        state.host.child = Some(host_child);
        state.host.child_exited = false;
        state.host.url = Some(host_base_url.clone());
        state.host.last_stdout = None;
        state.host.last_stderr = None;
    }
    spawn_process_monitor(manager.inner.clone(), ProcessKind::Host, host_rx);

    let host_health = match wait_for_pilot_host(&host_base_url, 10_000) {
        Ok(health) => health,
        Err(error) => {
            if let Ok(mut state) = manager.inner.lock() {
                PilotRuntimeManager::stop_locked(&mut state);
            }
            return Err(error);
        }
    };

    let resolved_opencode_url = trim_non_empty(input.opencode_url).unwrap_or_else(|| {
        host_health
            .opencode
            .as_ref()
            .map(|opencode| format!("http://127.0.0.1:{}", opencode.port))
            .unwrap_or_else(|| format!("http://127.0.0.1:{opencode_port}"))
    });

    let server_options = PilotServerSpawnOptions {
        workspace_paths: vec![workspace_path.clone()],
        port: pilot_server_port,
        client_token: Uuid::new_v4().to_string(),
        host_token: Uuid::new_v4().to_string(),
        opencode_url: resolved_opencode_url.clone(),
        opencode_directory: workspace_path.clone(),
        opencode_username: Some(opencode_username.clone()),
        opencode_password: Some(opencode_password.clone()),
        bridge_health_port: Some(bridge_health_port),
    };

    let server_base_url = localhost_base_url(pilot_server_port);
    let (server_rx, server_child) = match spawn_pilot_server(&app, &server_options) {
        Ok(result) => result,
        Err(error) => {
            if let Ok(mut state) = manager.inner.lock() {
                PilotRuntimeManager::stop_locked(&mut state);
            }
            return Err(error);
        }
    };

    {
        let mut state = manager
            .inner
            .lock()
            .map_err(|_| "pilot runtime mutex poisoned".to_string())?;
        state.server.child = Some(server_child);
        state.server.child_exited = false;
        state.server.url = Some(server_base_url.clone());
        state.server.last_stdout = None;
        state.server.last_stderr = None;
    }
    spawn_process_monitor(manager.inner.clone(), ProcessKind::Server, server_rx);

    if let Err(error) = wait_for_pilot_server_healthy(&server_base_url, 10_000) {
        if let Ok(mut state) = manager.inner.lock() {
            PilotRuntimeManager::stop_locked(&mut state);
        }
        return Err(error);
    }

    let bridge_options = PilotBridgeSpawnOptions {
        workspace_path: workspace_path.clone(),
        opencode_url: resolved_opencode_url.clone(),
        opencode_username: Some(opencode_username),
        opencode_password: Some(opencode_password),
        health_port: bridge_health_port,
    };

    let bridge_base_url = localhost_health_url(bridge_health_port);
    let (bridge_rx, bridge_child) = match spawn_pilot_bridge(&app, &bridge_options) {
        Ok(result) => result,
        Err(error) => {
            if let Ok(mut state) = manager.inner.lock() {
                PilotRuntimeManager::stop_locked(&mut state);
            }
            return Err(error);
        }
    };

    {
        let mut state = manager
            .inner
            .lock()
            .map_err(|_| "pilot runtime mutex poisoned".to_string())?;
        state.bridge.child = Some(bridge_child);
        state.bridge.child_exited = false;
        state.bridge.url = Some(bridge_base_url.clone());
        state.bridge.last_stdout = None;
        state.bridge.last_stderr = None;
        state.opencode_url = Some(resolved_opencode_url);
    }
    spawn_process_monitor(manager.inner.clone(), ProcessKind::Bridge, bridge_rx);

    if let Err(error) = wait_for_pilot_bridge_healthy(&bridge_base_url, 10_000) {
        if let Ok(mut state) = manager.inner.lock() {
            PilotRuntimeManager::stop_locked(&mut state);
        }
        return Err(error);
    }

    pilot_runtime_status(manager)
}

#[tauri::command]
pub fn pilot_runtime_stop(
    manager: State<'_, PilotRuntimeManager>,
) -> Result<PilotRuntimeStatus, String> {
    {
        let mut state = manager
            .inner
            .lock()
            .map_err(|_| "pilot runtime mutex poisoned".to_string())?;
        PilotRuntimeManager::stop_locked(&mut state);
    }

    pilot_runtime_status(manager)
}

#[tauri::command]
pub fn pilot_runtime_status(
    manager: State<'_, PilotRuntimeManager>,
) -> Result<PilotRuntimeStatus, String> {
    let snapshot = {
        let mut state = manager
            .inner
            .lock()
            .map_err(|_| "pilot runtime mutex poisoned".to_string())?;
        PilotRuntimeManager::snapshot_locked(&mut state)
    };

    Ok(build_runtime_status(snapshot))
}

#[tauri::command]
pub fn pilot_runtime_health(
    manager: State<'_, PilotRuntimeManager>,
) -> Result<PilotRuntimeHealth, String> {
    let snapshot = {
        let mut state = manager
            .inner
            .lock()
            .map_err(|_| "pilot runtime mutex poisoned".to_string())?;
        PilotRuntimeManager::snapshot_locked(&mut state)
    };

    let host_health = if snapshot.components.host.running {
        let check = snapshot
            .components
            .host
            .url
            .as_deref()
            .ok_or_else(|| "pilot-host url missing".to_string())
            .and_then(|url| fetch_pilot_host_health(url).map(|_| ()))
            .map_err(|error| error.to_string());
        make_component_health(snapshot.components.host.url.clone(), check)
    } else {
        PilotServiceHealthStatus {
            ok: false,
            url: snapshot.components.host.url.clone(),
            error: Some("pilot-host is not running".to_string()),
        }
    };

    let server_health = if snapshot.components.server.running {
        let check = snapshot
            .components
            .server
            .url
            .as_deref()
            .ok_or_else(|| "pilot-server url missing".to_string())
            .and_then(|url| wait_for_pilot_server_healthy(url, 2_000));
        make_component_health(snapshot.components.server.url.clone(), check)
    } else {
        PilotServiceHealthStatus {
            ok: false,
            url: snapshot.components.server.url.clone(),
            error: Some("pilot-server is not running".to_string()),
        }
    };

    let bridge_health = if snapshot.components.bridge.running {
        let check = snapshot
            .components
            .bridge
            .url
            .as_deref()
            .ok_or_else(|| "pilot-bridge url missing".to_string())
            .and_then(|url| bridge::fetch_bridge_health_payload(url))
            .and_then(normalize_bridge_health_snapshot);

        match check {
            Ok(snapshot_payload) => PilotBridgeServiceHealthStatus {
                ok: true,
                url: snapshot.components.bridge.url.clone(),
                error: None,
                snapshot: Some(snapshot_payload),
            },
            Err(error) => PilotBridgeServiceHealthStatus {
                ok: false,
                url: snapshot.components.bridge.url.clone(),
                error: Some(error),
                snapshot: None,
            },
        }
    } else {
        PilotBridgeServiceHealthStatus {
            ok: false,
            url: snapshot.components.bridge.url.clone(),
            error: Some("pilot-bridge is not running".to_string()),
            snapshot: None,
        }
    };

    Ok(PilotRuntimeHealth {
        ok: host_health.ok && server_health.ok && bridge_health.ok,
        host: host_health,
        server: server_health,
        bridge: bridge_health,
    })
}
