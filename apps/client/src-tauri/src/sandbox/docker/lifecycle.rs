use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

use log::{error, info};
use serde::Deserialize;

use crate::sandbox::config::{
    SandboxConfig, SandboxPorts, SandboxStartResult, SandboxStatus, DEFAULT_CONTAINER_NAME,
};

use super::command::docker_cmd;
use super::paths::{SandboxMountPaths, CONTAINER_WORKSPACE_DIR};
use super::probe::{
    container_exists_checked, container_has_required_mounts, container_image_checked,
    container_image_id_checked, image_id_checked, running_container_id_by_exact_name,
    running_container_id_by_exact_name_checked,
};

#[derive(Debug, Deserialize)]
struct OpencodeHealth {
    healthy: bool,
}

fn env_non_empty(name: &str) -> Option<String> {
    std::env::var(name).ok().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn env_bool(name: &str, default: bool) -> bool {
    let Some(value) = env_non_empty(name) else {
        return default;
    };
    matches!(
        value.to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn resolve_opencode_log_level() -> String {
    let Some(raw) = env_non_empty("DECK_SANDBOX_OPENCODE_LOG_LEVEL") else {
        return "INFO".to_string();
    };
    let normalized = raw.to_ascii_uppercase();
    match normalized.as_str() {
        "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" => normalized,
        _ => "INFO".to_string(),
    }
}

pub fn wait_for_opencode_healthy(port: u16, timeout_ms: u64) -> Result<(), String> {
    let start = Instant::now();
    let mut last_error: Option<String> = None;
    let url = format!("http://127.0.0.1:{port}/global/health");

    while start.elapsed().as_millis() < u128::from(timeout_ms) {
        match ureq::get(&url).call() {
            Ok(response) if response.status() == 200 => {
                match response.into_json::<OpencodeHealth>() {
                    Ok(health) if health.healthy => return Ok(()),
                    Ok(_) => {
                        last_error =
                            Some("OpenCode health endpoint reported unhealthy".to_string());
                    }
                    Err(error) => {
                        last_error =
                            Some(format!("Failed to parse OpenCode health response: {error}"));
                    }
                }
            }
            Ok(response) => {
                last_error = Some(format!(
                    "OpenCode health endpoint status: {}",
                    response.status()
                ));
            }
            Err(error) => {
                last_error = Some(format!("OpenCode health request failed: {error}"));
            }
        }
        std::thread::sleep(Duration::from_millis(250));
    }

    Err(last_error.unwrap_or_else(|| format!("Timed out waiting for OpenCode health: {url}")))
}

pub fn get_container_status(name: Option<&str>) -> SandboxStatus {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    let container_id = running_container_id_by_exact_name(container_name);
    let running = container_id.is_some();

    SandboxStatus {
        running,
        container_name: if running {
            Some(container_name.to_string())
        } else {
            None
        },
        container_id,
        ports: SandboxPorts::default(),
    }
}

pub fn start_container(
    config: &SandboxConfig,
    storage_root: &Path,
) -> Result<SandboxStartResult, String> {
    let image = config.image();
    let name = config.container_name();
    let persistence = config.persistence();
    let ports = SandboxPorts::default();
    let daemon_log_level =
        env_non_empty("DECK_SANDBOX_DAEMON_LOG_LEVEL").unwrap_or_else(|| "info".to_string());
    let opencode_log_level = resolve_opencode_log_level();
    let opencode_print_logs = env_bool("DECK_SANDBOX_OPENCODE_PRINT_LOGS", false);

    info!(
        "[deck-docker] Starting sandbox container '{}' with image '{}'",
        name, image
    );

    let has_container = container_exists_checked(name)?;
    if has_container {
        let existing_image = container_image_checked(name)?;
        let existing_image_id = container_image_id_checked(name)?;
        let requested_image_id = image_id_checked(image)?;

        let should_recreate = match &existing_image {
            Some(existing_ref) if existing_ref != image => {
                info!(
                    "[deck-docker] Existing container '{}' image '{}' differs from requested '{}', recreating container",
                    name, existing_ref, image
                );
                true
            }
            _ => match (&existing_image_id, &requested_image_id) {
                (Some(existing_id), Some(requested_id)) if existing_id != requested_id => {
                    info!(
                        "[deck-docker] Existing container '{}' image ID '{}' differs from requested image ID '{}', recreating container",
                        name, existing_id, requested_id
                    );
                    true
                }
                _ => false,
            },
        };

        if should_recreate {
            let rm_output = docker_cmd()
                .args(["rm", "-f", name])
                .output()
                .map_err(|error| format!("Failed to recreate existing container: {error}"))?;
            if !rm_output.status.success() {
                let stderr = String::from_utf8_lossy(&rm_output.stderr);
                return Err(format!(
                    "Failed to recreate existing container '{}': {}",
                    name,
                    stderr.trim()
                ));
            }
        }

        let has_container = container_exists_checked(name)?;
        if !has_container {
            info!(
                "[deck-docker] Container '{}' removed for recreation, creating a fresh one",
                name
            );
        } else {
            if persistence.enabled() {
                match container_has_required_mounts(name) {
                    Ok(true) => {}
                    Ok(false) => {
                        return Err(
                        "Existing sandbox container was created without persistent mounts. Please use \"Reset Local Sandbox Data\" in Settings before starting again."
                            .to_string(),
                    );
                    }
                    Err(error) => {
                        return Err(format!(
                            "Failed to validate existing sandbox container mounts: {}",
                            error
                        ));
                    }
                }
            }

            if let Some(container_id) = running_container_id_by_exact_name_checked(name)? {
                info!(
                    "[deck-docker] Container '{}' already running (ID: {})",
                    name, container_id
                );
                return Ok(SandboxStartResult {
                    container_id,
                    created_fresh: false,
                });
            }

            info!(
                "[deck-docker] Container '{}' exists and is stopped, starting...",
                name
            );
            let start_output = docker_cmd()
                .args(["start", name])
                .output()
                .map_err(|error| format!("Failed to start existing container: {error}"))?;
            if !start_output.status.success() {
                let stderr = String::from_utf8_lossy(&start_output.stderr);
                return Err(format!("Failed to start existing container: {stderr}"));
            }

            if let Some(container_id) = running_container_id_by_exact_name_checked(name)? {
                return Ok(SandboxStartResult {
                    container_id,
                    created_fresh: false,
                });
            }
            let stdout = String::from_utf8_lossy(&start_output.stdout)
                .trim()
                .to_string();
            if !stdout.is_empty() {
                return Ok(SandboxStartResult {
                    container_id: stdout,
                    created_fresh: false,
                });
            }
            return Err("Container started but ID could not be resolved".to_string());
        }
    }

    let mount_paths = SandboxMountPaths::from_root(storage_root);
    if persistence.enabled() {
        mount_paths.ensure_dirs()?;
    }

    info!(
        "[deck-docker] Running docker run with ports: opencode={}, vnc={}, novnc={}, daemon={}, ssh={}, web_terminal={}",
        ports.opencode, ports.vnc, ports.novnc, ports.daemon, ports.ssh, ports.web_terminal
    );

    let mut args = vec![
        "run".to_string(),
        "--platform".to_string(),
        "linux/amd64".to_string(),
        "--name".to_string(),
        name.to_string(),
        "-d".to_string(),
        "-p".to_string(),
        format!("{}:{}", ports.opencode, ports.opencode),
        "-p".to_string(),
        format!("{}:{}", ports.vnc, ports.vnc),
        "-p".to_string(),
        format!("{}:{}", ports.novnc, ports.novnc),
        "-p".to_string(),
        format!("{}:{}", ports.daemon, ports.daemon),
        "-p".to_string(),
        format!("{}:{}", ports.ssh, ports.ssh),
        "-p".to_string(),
        format!("{}:{}", ports.web_terminal, ports.web_terminal),
        "-e".to_string(),
        "DISPLAY=:1".to_string(),
        "-e".to_string(),
        format!("VNC_PORT={}", ports.vnc),
        "-e".to_string(),
        format!("NO_VNC_PORT={}", ports.novnc),
        "-e".to_string(),
        "VNC_RESOLUTION=1280x720".to_string(),
        "-e".to_string(),
        "VNC_USER=deck".to_string(),
        "-e".to_string(),
        format!("DECK_LOG_LEVEL={daemon_log_level}"),
    ];

    if persistence.enabled() {
        for mount in mount_paths.mount_specs() {
            args.push("--mount".to_string());
            args.push(mount);
        }
        args.push("-w".to_string());
        args.push(CONTAINER_WORKSPACE_DIR.to_string());
    }

    args.extend([
        image.to_string(),
        "opencode".to_string(),
        "serve".to_string(),
        "--hostname".to_string(),
        "0.0.0.0".to_string(),
        "--port".to_string(),
        ports.opencode.to_string(),
        "--log-level".to_string(),
        opencode_log_level,
    ]);
    if opencode_print_logs {
        args.push("--print-logs".to_string());
    }

    let output = docker_cmd().args(args).output().map_err(|error| {
        let message = format!("Failed to start container: {}", error);
        error!("[deck-docker] {}", message);
        message
    })?;

    if output.status.success() {
        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        info!(
            "[deck-docker] Container started successfully, ID: {}",
            container_id
        );
        Ok(SandboxStartResult {
            container_id,
            created_fresh: true,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let message = format!("Failed to start container: {}", stderr);
        error!("[deck-docker] {}", message);
        Err(message)
    }
}

pub fn stop_container(name: Option<&str>) -> Result<String, String> {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    info!("[deck-docker] Stopping container '{}'...", container_name);

    if !container_exists_checked(container_name)? {
        let message = format!("Container {} not found", container_name);
        info!("[deck-docker] {}", message);
        return Ok(message);
    }

    if running_container_id_by_exact_name_checked(container_name)?.is_none() {
        let message = format!("Container {} is already stopped", container_name);
        info!("[deck-docker] {}", message);
        return Ok(message);
    }

    let stop_output = docker_cmd()
        .args(["stop", container_name])
        .output()
        .map_err(|error| {
            let message = format!("Failed to stop container: {}", error);
            error!("[deck-docker] {}", message);
            message
        })?;

    if !stop_output.status.success() {
        let stderr = String::from_utf8_lossy(&stop_output.stderr).to_string();
        let message = format!("Failed to stop container: {}", stderr);
        error!("[deck-docker] {}", message);
        return Err(message);
    }

    let message = format!("Container {} stopped", container_name);
    info!("[deck-docker] {}", message);
    Ok(message)
}

pub fn reset_sandbox(name: Option<&str>, storage_root: &Path) -> Result<String, String> {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    info!(
        "[deck-docker] Resetting sandbox '{}' with storage root '{}'",
        container_name,
        storage_root.display()
    );

    if container_exists_checked(container_name)? {
        let rm_output = docker_cmd()
            .args(["rm", "-f", container_name])
            .output()
            .map_err(|error| {
                let message = format!("Failed to remove container '{}': {}", container_name, error);
                error!("[deck-docker] {}", message);
                message
            })?;
        if !rm_output.status.success() {
            let stderr = String::from_utf8_lossy(&rm_output.stderr).to_string();
            return Err(format!(
                "Failed to remove container '{}': {}",
                container_name, stderr
            ));
        }
    }

    if storage_root.exists() {
        fs::remove_dir_all(storage_root).map_err(|error| {
            let message = format!(
                "Failed to remove sandbox storage '{}': {}",
                storage_root.display(),
                error
            );
            error!("[deck-docker] {}", message);
            message
        })?;
    }

    Ok(format!(
        "Sandbox '{}' reset and storage removed at '{}'",
        container_name,
        storage_root.display()
    ))
}
