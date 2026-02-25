use std::env;
use std::net::TcpListener;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::async_runtime::Receiver;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEFAULT_HOST: &str = "127.0.0.1";

#[derive(Debug, Clone)]
pub struct PilotHostSpawnOptions {
    pub data_dir: String,
    pub daemon_port: u16,
    pub workspace_path: String,
    pub opencode_host: String,
    pub opencode_port: u16,
    pub opencode_username: String,
    pub opencode_password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotHostOpencodeState {
    pub pid: u32,
    pub port: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotHostHealthSnapshot {
    pub ok: bool,
    pub opencode: Option<PilotHostOpencodeState>,
}

pub fn resolve_pilot_host_data_dir(input: Option<&str>) -> String {
    if let Some(explicit) = input {
        let trimmed = explicit.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    if let Ok(dir) = env::var("PILOT_HOST_DATA_DIR") {
        if !dir.trim().is_empty() {
            return dir;
        }
    }

    if let Ok(dir) = env::var("DECK_DATA_DIR") {
        if !dir.trim().is_empty() {
            return dir;
        }
    }

    if let Ok(home) = env::var("HOME") {
        return PathBuf::from(home)
            .join(".deck")
            .join("pilot-host")
            .to_string_lossy()
            .to_string();
    }

    if let Ok(profile) = env::var("USERPROFILE") {
        return PathBuf::from(profile)
            .join(".deck")
            .join("pilot-host")
            .to_string_lossy()
            .to_string();
    }

    ".deck/pilot-host".to_string()
}

pub fn resolve_free_local_port() -> Result<u16, String> {
    let listener = TcpListener::bind((DEFAULT_HOST, 0)).map_err(|error| error.to_string())?;
    listener
        .local_addr()
        .map(|address| address.port())
        .map_err(|error| error.to_string())
}

pub fn spawn_pilot_host_daemon(
    app: &AppHandle,
    options: &PilotHostSpawnOptions,
) -> Result<(Receiver<CommandEvent>, CommandChild), String> {
    let command = match app.shell().sidecar("pilot-host") {
        Ok(sidecar) => sidecar,
        Err(_) => app.shell().command("pilot-host"),
    };

    let args = vec![
        "daemon".to_string(),
        "run".to_string(),
        "--data-dir".to_string(),
        options.data_dir.clone(),
        "--daemon-host".to_string(),
        DEFAULT_HOST.to_string(),
        "--daemon-port".to_string(),
        options.daemon_port.to_string(),
        "--opencode-workdir".to_string(),
        options.workspace_path.clone(),
        "--opencode-host".to_string(),
        options.opencode_host.clone(),
        "--opencode-port".to_string(),
        options.opencode_port.to_string(),
        "--opencode-username".to_string(),
        options.opencode_username.clone(),
        "--opencode-password".to_string(),
        options.opencode_password.clone(),
        "--cors".to_string(),
        "*".to_string(),
    ];

    command
        .args(args)
        .spawn()
        .map_err(|error| format!("Failed to start pilot-host: {error}"))
}

pub fn fetch_pilot_host_health(base_url: &str) -> Result<PilotHostHealthSnapshot, String> {
    let url = format!("{}/health", base_url.trim_end_matches('/'));
    let response = ureq::get(&url)
        .set("Accept", "application/json")
        .call()
        .map_err(|error| format!("pilot-host health request failed: {error}"))?;

    response
        .into_json::<PilotHostHealthSnapshot>()
        .map_err(|error| format!("Failed to parse pilot-host health: {error}"))
}

pub fn wait_for_pilot_host(
    base_url: &str,
    timeout_ms: u64,
) -> Result<PilotHostHealthSnapshot, String> {
    let start = Instant::now();
    let mut last_error: Option<String> = None;

    while start.elapsed().as_millis() < u128::from(timeout_ms) {
        match fetch_pilot_host_health(base_url) {
            Ok(snapshot) if snapshot.ok => return Ok(snapshot),
            Ok(_) => {
                last_error = Some("pilot-host reported unhealthy status".to_string());
            }
            Err(error) => {
                last_error = Some(error);
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    Err(last_error.unwrap_or_else(|| "Timed out waiting for pilot-host health".to_string()))
}
