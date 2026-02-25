use std::net::TcpListener;
use std::path::Path;
use std::time::{Duration, Instant};

use serde_json::Value;
use tauri::async_runtime::Receiver;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEFAULT_PILOT_BRIDGE_HEALTH_PORT: u16 = 3005;

#[derive(Debug, Clone)]
pub struct PilotBridgeSpawnOptions {
    pub workspace_path: String,
    pub opencode_url: String,
    pub opencode_username: Option<String>,
    pub opencode_password: Option<String>,
    pub health_port: u16,
}

pub fn resolve_pilot_bridge_health_port(preferred: Option<u16>) -> Result<u16, String> {
    if let Some(port) = preferred {
        if TcpListener::bind(("0.0.0.0", port)).is_ok() {
            return Ok(port);
        }
    }

    if TcpListener::bind(("0.0.0.0", DEFAULT_PILOT_BRIDGE_HEALTH_PORT)).is_ok() {
        return Ok(DEFAULT_PILOT_BRIDGE_HEALTH_PORT);
    }

    let listener = TcpListener::bind(("0.0.0.0", 0)).map_err(|error| error.to_string())?;
    listener
        .local_addr()
        .map(|address| address.port())
        .map_err(|error| error.to_string())
}

pub fn spawn_pilot_bridge(
    app: &AppHandle,
    options: &PilotBridgeSpawnOptions,
) -> Result<(Receiver<CommandEvent>, CommandChild), String> {
    let command = match app.shell().sidecar("pilot-bridge") {
        Ok(sidecar) => sidecar,
        Err(_) => app.shell().command("pilot-bridge"),
    };

    let args = vec![
        "start".to_string(),
        options.workspace_path.clone(),
        "--opencode-url".to_string(),
        options.opencode_url.clone(),
    ];

    let mut command = command
        .args(args)
        .current_dir(Path::new(options.workspace_path.as_str()))
        .env("PILOT_BRIDGE_HEALTH_PORT", options.health_port.to_string());

    if let Some(username) = options.opencode_username.as_deref() {
        if !username.trim().is_empty() {
            command = command.env("OPENCODE_SERVER_USERNAME", username);
        }
    }

    if let Some(password) = options.opencode_password.as_deref() {
        if !password.trim().is_empty() {
            command = command.env("OPENCODE_SERVER_PASSWORD", password);
        }
    }

    command
        .spawn()
        .map_err(|error| format!("Failed to start pilot-bridge: {error}"))
}

pub fn fetch_bridge_health_payload(base_url: &str) -> Result<Value, String> {
    let url = format!("{}/health", base_url.trim_end_matches('/'));
    let response = ureq::get(&url)
        .set("Accept", "application/json")
        .call()
        .map_err(|error| format!("pilot-bridge health request failed: {error}"))?;

    response
        .into_json::<Value>()
        .map_err(|error| format!("Failed to parse pilot-bridge health: {error}"))
}

pub fn wait_for_pilot_bridge_healthy(base_url: &str, timeout_ms: u64) -> Result<Value, String> {
    let start = Instant::now();
    let mut last_error: Option<String> = None;

    while start.elapsed().as_millis() < u128::from(timeout_ms) {
        match fetch_bridge_health_payload(base_url) {
            Ok(payload) => {
                if payload
                    .as_object()
                    .and_then(|map| map.get("ok"))
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
                    return Ok(payload);
                }
                last_error = Some("pilot-bridge reported unhealthy status".to_string());
            }
            Err(error) => {
                last_error = Some(error);
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    Err(last_error.unwrap_or_else(|| "Timed out waiting for pilot-bridge health".to_string()))
}

pub fn localhost_health_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}
