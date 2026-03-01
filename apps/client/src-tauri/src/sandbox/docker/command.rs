use std::path::Path;
use std::process::Command;

use log::{debug, error, info};

use crate::sandbox::config::DockerInfo;

// macOS / Linux GUI apps often lack /usr/local/bin in PATH.
// Windows GUI apps inherit a full PATH but Docker Desktop may install to
// a Program Files location that is not always present.
#[cfg(not(target_os = "windows"))]
fn platform_docker_candidates() -> Vec<String> {
    let mut candidates: Vec<String> = vec![
        "/usr/local/bin/docker".into(),
        "/opt/homebrew/bin/docker".into(),
        "/usr/bin/docker".into(),
    ];
    if let Ok(home) = std::env::var("HOME") {
        candidates.push(format!("{}/.docker/bin/docker", home));
    }
    candidates
}

#[cfg(target_os = "windows")]
fn platform_docker_candidates() -> Vec<String> {
    let mut candidates = Vec::new();
    if let Ok(pf) = std::env::var("ProgramFiles") {
        candidates.push(format!(
            "{}\\Docker\\Docker\\resources\\bin\\docker.exe",
            pf
        ));
    }
    if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
        candidates.push(format!(
            "{}\\Docker\\Docker\\resources\\bin\\docker.exe",
            pf86
        ));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        candidates.push(format!(
            "{}\\Docker\\Docker\\resources\\bin\\docker.exe",
            local
        ));
    }
    candidates
}

fn resolve_docker_bin() -> String {
    for candidate in platform_docker_candidates() {
        if Path::new(&candidate).is_file() {
            debug!("[deck-docker] Resolved docker binary: {}", candidate);
            return candidate;
        }
    }

    debug!("[deck-docker] Docker binary not found in known paths, falling back to PATH lookup");
    if cfg!(target_os = "windows") {
        "docker.exe".to_string()
    } else {
        "docker".to_string()
    }
}

pub(super) fn docker_cmd() -> Command {
    Command::new(resolve_docker_bin())
}

pub fn check_docker_available() -> DockerInfo {
    let resolved = resolve_docker_bin();
    info!(
        "[deck-docker] Checking Docker availability (binary: {})...",
        resolved
    );
    match Command::new(&resolved).arg("info").output() {
        Ok(output) => {
            if output.status.success() {
                info!("[deck-docker] Docker is available at {}", resolved);
                DockerInfo {
                    available: true,
                    error: None,
                    resolved_path: Some(resolved),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                error!("[deck-docker] Docker not available: {}", stderr);
                DockerInfo {
                    available: false,
                    error: Some(stderr),
                    resolved_path: Some(resolved),
                }
            }
        }
        Err(error) => {
            let current_path = std::env::var("PATH").unwrap_or_default();
            error!(
                "[deck-docker] Docker binary not found: {} (resolved={}, PATH={})",
                error, resolved, current_path
            );
            DockerInfo {
                available: false,
                error: Some(format!(
                    "Docker not found at '{}': {}. Ensure Docker Desktop is installed.",
                    resolved, error
                )),
                resolved_path: None,
            }
        }
    }
}

pub fn image_exists(image: &str) -> bool {
    match docker_cmd()
        .args([
            "images",
            "--format",
            "{{.Repository}}:{{.Tag}}",
            "--filter",
            &format!("reference={}", image),
        ])
        .output()
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let exists = stdout.lines().any(|line| line.trim() == image);
            info!("[deck-docker] Image '{}' exists: {}", image, exists);
            exists
        }
        Err(error) => {
            error!("[deck-docker] Failed to check image: {}", error);
            false
        }
    }
}
