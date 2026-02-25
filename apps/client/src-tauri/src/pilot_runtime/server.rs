use std::net::TcpListener;
use std::path::Path;
use std::time::{Duration, Instant};

use tauri::async_runtime::Receiver;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PILOT_SERVER_PORT: u16 = 8787;

#[derive(Debug, Clone)]
pub struct PilotServerSpawnOptions {
    pub workspace_paths: Vec<String>,
    pub port: u16,
    pub client_token: String,
    pub host_token: String,
    pub opencode_url: String,
    pub opencode_directory: String,
    pub opencode_username: Option<String>,
    pub opencode_password: Option<String>,
    pub bridge_health_port: Option<u16>,
}

pub fn resolve_pilot_server_port(preferred: Option<u16>) -> Result<u16, String> {
    if let Some(port) = preferred {
        if TcpListener::bind(("0.0.0.0", port)).is_ok() {
            return Ok(port);
        }
    }

    if TcpListener::bind(("0.0.0.0", DEFAULT_PILOT_SERVER_PORT)).is_ok() {
        return Ok(DEFAULT_PILOT_SERVER_PORT);
    }

    let listener = TcpListener::bind(("0.0.0.0", 0)).map_err(|error| error.to_string())?;
    listener
        .local_addr()
        .map(|address| address.port())
        .map_err(|error| error.to_string())
}

pub fn spawn_pilot_server(
    app: &AppHandle,
    options: &PilotServerSpawnOptions,
) -> Result<(Receiver<CommandEvent>, CommandChild), String> {
    let command = match app.shell().sidecar("pilot-server") {
        Ok(sidecar) => sidecar,
        Err(_) => app.shell().command("pilot-server"),
    };

    let mut args = vec![
        "--host".to_string(),
        "0.0.0.0".to_string(),
        "--port".to_string(),
        options.port.to_string(),
        "--token".to_string(),
        options.client_token.clone(),
        "--host-token".to_string(),
        options.host_token.clone(),
        "--cors".to_string(),
        "*".to_string(),
        "--approval".to_string(),
        "auto".to_string(),
    ];

    for workspace in &options.workspace_paths {
        let trimmed = workspace.trim();
        if trimmed.is_empty() {
            continue;
        }
        args.push("--workspace".to_string());
        args.push(trimmed.to_string());
    }

    args.push("--opencode-url".to_string());
    args.push(options.opencode_url.clone());

    let trimmed_directory = options.opencode_directory.trim();
    if !trimmed_directory.is_empty() {
        args.push("--opencode-directory".to_string());
        args.push(trimmed_directory.to_string());
    }

    let cwd = options
        .workspace_paths
        .first()
        .map(|path| Path::new(path))
        .unwrap_or_else(|| Path::new("."));

    let mut command = command.args(args).current_dir(cwd);

    if let Some(port) = options.bridge_health_port {
        command = command.env("PILOT_BRIDGE_HEALTH_PORT", port.to_string());
    }

    if let Some(username) = options.opencode_username.as_deref() {
        if !username.trim().is_empty() {
            command = command.env("DECK_OPENCODE_USERNAME", username);
        }
    }

    if let Some(password) = options.opencode_password.as_deref() {
        if !password.trim().is_empty() {
            command = command.env("DECK_OPENCODE_PASSWORD", password);
        }
    }

    command
        .spawn()
        .map_err(|error| format!("Failed to start pilot-server: {error}"))
}

pub fn wait_for_pilot_server_healthy(base_url: &str, timeout_ms: u64) -> Result<(), String> {
    let start = Instant::now();
    let mut last_error: Option<String> = None;
    let url = format!("{}/health", base_url.trim_end_matches('/'));

    while start.elapsed().as_millis() < u128::from(timeout_ms) {
        match ureq::get(&url).call() {
            Ok(response) if response.status() == 200 => return Ok(()),
            Ok(response) => {
                last_error = Some(format!("pilot-server health status: {}", response.status()));
            }
            Err(error) => {
                last_error = Some(format!("pilot-server health request failed: {error}"));
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    Err(last_error.unwrap_or_else(|| "Timed out waiting for pilot-server health".to_string()))
}

pub fn localhost_base_url(port: u16) -> String {
    format!("http://{DEFAULT_HOST}:{port}")
}
