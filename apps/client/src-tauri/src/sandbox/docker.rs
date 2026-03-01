use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use log::{debug, error, info, warn};
use serde::Deserialize;
use serde::Serialize;

use super::config::{
    DockerInfo, SandboxConfig, SandboxPorts, SandboxStorageInfo, DEFAULT_CONTAINER_NAME,
};

const DEFAULT_STORAGE_ROOT_RELATIVE: &str = "sandbox/local";
const CONTAINER_WORKSPACE_DIR: &str = "/home/deck/workspace";
const CONTAINER_DECK_STATE_DIR: &str = "/home/deck/.deck";
const CONTAINER_OPENCODE_SHARE_DIR: &str = "/home/deck/.local/share/opencode";
const CONTAINER_OPENCODE_STATE_DIR: &str = "/home/deck/.local/state/opencode";
const REQUIRED_MOUNT_DESTINATIONS: [&str; 4] = [
    CONTAINER_WORKSPACE_DIR,
    CONTAINER_DECK_STATE_DIR,
    CONTAINER_OPENCODE_SHARE_DIR,
    CONTAINER_OPENCODE_STATE_DIR,
];

// ---------------------------------------------------------------------------
// Docker binary resolution
//
// macOS / Linux GUI apps often lack /usr/local/bin in PATH.
// Windows GUI apps inherit a full PATH but Docker Desktop may install to
// a Program Files location that is not always present.
// ---------------------------------------------------------------------------

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

fn docker_cmd() -> Command {
    Command::new(resolve_docker_bin())
}

#[derive(Debug, Clone)]
struct SandboxMountPaths {
    workspace_host: PathBuf,
    deck_state_host: PathBuf,
    opencode_share_host: PathBuf,
    opencode_state_host: PathBuf,
}

impl SandboxMountPaths {
    fn from_root(root: &Path) -> Self {
        Self {
            workspace_host: root.join("workspace"),
            deck_state_host: root.join("deck-state"),
            opencode_share_host: root.join("opencode-share"),
            opencode_state_host: root.join("opencode-state"),
        }
    }

    fn ensure_dirs(&self) -> Result<(), String> {
        for path in [
            &self.workspace_host,
            &self.deck_state_host,
            &self.opencode_share_host,
            &self.opencode_state_host,
        ] {
            fs::create_dir_all(path).map_err(|error| {
                format!(
                    "Failed to prepare sandbox storage at {}: {error}",
                    path.display()
                )
            })?;
        }
        Ok(())
    }

    fn mount_specs(&self) -> Vec<String> {
        vec![
            mount_spec(&self.workspace_host, CONTAINER_WORKSPACE_DIR),
            mount_spec(&self.deck_state_host, CONTAINER_DECK_STATE_DIR),
            mount_spec(&self.opencode_share_host, CONTAINER_OPENCODE_SHARE_DIR),
            mount_spec(&self.opencode_state_host, CONTAINER_OPENCODE_STATE_DIR),
        ]
    }
}

#[derive(Debug, Deserialize)]
struct DockerInspectMount {
    #[serde(rename = "Destination")]
    destination: String,
}

fn mount_spec(source: &Path, target: &str) -> String {
    format!("type=bind,source={},target={target}", source.display())
}

pub fn resolve_storage_root(app_data_dir: &Path, config: &SandboxConfig) -> PathBuf {
    let persistence = config.persistence();
    if let Some(root) = persistence.root.as_deref() {
        let trimmed = root.trim();
        if !trimmed.is_empty() {
            let candidate = PathBuf::from(trimmed);
            if candidate.is_absolute() {
                return candidate;
            }
            return app_data_dir.join(candidate);
        }
    }
    app_data_dir.join(DEFAULT_STORAGE_ROOT_RELATIVE)
}

fn parse_storage_root(root: &Path) -> String {
    root.display().to_string()
}

// ---------------------------------------------------------------------------
// Pull cancellation token
// ---------------------------------------------------------------------------

#[derive(Debug, Default)]
pub struct PullCancelToken {
    cancelled: AtomicBool,
    child_pid: AtomicU32,
}

impl PullCancelToken {
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        let pid = self.child_pid.load(Ordering::SeqCst);
        if pid != 0 {
            #[cfg(unix)]
            {
                // SIGTERM for graceful shutdown
                unsafe {
                    libc::kill(pid as i32, libc::SIGTERM);
                }
            }
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F"])
                    .output();
            }
        }
    }

    pub fn reset(&self) {
        self.cancelled.store(false, Ordering::SeqCst);
        self.child_pid.store(0, Ordering::SeqCst);
    }

    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    fn set_child_pid(&self, pid: u32) {
        self.child_pid.store(pid, Ordering::SeqCst);
    }
}

pub type SharedPullCancelToken = Arc<PullCancelToken>;

// ---------------------------------------------------------------------------
// Pull progress types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct PullProgress {
    pub stage: String,
    pub message: String,
    pub percent: u8,
    pub layers_done: u32,
    pub layers_total: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum LayerState {
    Waiting,
    Downloading,
    Extracting,
    Complete,
}

fn layer_state_from_status(status: &str) -> LayerState {
    let s = status.trim().to_lowercase();
    if s.starts_with("pull complete") || s.starts_with("already exists") {
        LayerState::Complete
    } else if s.starts_with("extracting") || s.starts_with("verifying") {
        LayerState::Extracting
    } else if s.starts_with("downloading") || s.starts_with("download complete") {
        LayerState::Downloading
    } else {
        LayerState::Waiting
    }
}

fn compute_pull_progress(layers: &HashMap<String, LayerState>) -> (u32, u32, u8) {
    if layers.is_empty() {
        return (0, 0, 0);
    }
    let total = layers.len() as u32;
    let done = layers
        .values()
        .filter(|s| **s == LayerState::Complete)
        .count() as u32;

    let weighted: u32 = layers
        .values()
        .map(|s| match s {
            LayerState::Waiting => 0u32,
            LayerState::Downloading => 33,
            LayerState::Extracting => 66,
            LayerState::Complete => 100,
        })
        .sum();
    let percent = (weighted / total).min(100) as u8;
    (done, total, percent)
}

fn parse_exact_container_id_from_ps_output(output: &str, expected_name: &str) -> Option<String> {
    output
        .lines()
        .filter_map(|line| {
            let (id, name) = line.split_once('\t')?;
            let id = id.trim();
            let name = name.trim();
            if id.is_empty() || name.is_empty() {
                return None;
            }
            if name == expected_name {
                return Some(id.to_string());
            }
            None
        })
        .next()
}

fn container_id_by_exact_name(name: &str, all: bool) -> Option<String> {
    let mut command = docker_cmd();
    command.arg("ps");
    if all {
        command.arg("-a");
    }
    let output = command
        .args(["--format", "{{.ID}}\t{{.Names}}"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_exact_container_id_from_ps_output(&stdout, name)
}

fn running_container_id_by_exact_name(name: &str) -> Option<String> {
    container_id_by_exact_name(name, false)
}

fn container_exists(name: &str) -> bool {
    container_id_by_exact_name(name, true).is_some()
}

fn inspect_container_mount_destinations(name: &str) -> Result<Vec<String>, String> {
    let output = docker_cmd()
        .args(["inspect", "--format", "{{json .Mounts}}", name])
        .output()
        .map_err(|error| format!("Failed to inspect container mounts: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to inspect container mounts: {stderr}"));
    }

    let mounts: Vec<DockerInspectMount> = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Failed to parse container mount data: {error}"))?;
    Ok(mounts.into_iter().map(|mount| mount.destination).collect())
}

fn container_has_required_mounts(name: &str) -> Result<bool, String> {
    let destinations = inspect_container_mount_destinations(name)?;
    Ok(REQUIRED_MOUNT_DESTINATIONS
        .iter()
        .all(|required| destinations.iter().any(|dest| dest == required)))
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
        Err(e) => {
            let current_path = std::env::var("PATH").unwrap_or_default();
            error!(
                "[deck-docker] Docker binary not found: {} (resolved={}, PATH={})",
                e, resolved, current_path
            );
            DockerInfo {
                available: false,
                error: Some(format!(
                    "Docker not found at '{}': {}. Ensure Docker Desktop is installed.",
                    resolved, e
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
        Err(e) => {
            error!("[deck-docker] Failed to check image: {}", e);
            false
        }
    }
}

pub fn is_container_running(name: &str) -> bool {
    let running = running_container_id_by_exact_name(name).is_some();
    debug!("[deck-docker] Container '{}' running: {}", name, running);
    running
}

pub fn get_container_status(name: Option<&str>) -> super::config::SandboxStatus {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    let container_id = running_container_id_by_exact_name(container_name);
    let running = container_id.is_some();

    super::config::SandboxStatus {
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

fn dir_size_bytes(path: &Path) -> u64 {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return 0,
    };

    let mut total = 0u64;
    for entry in entries.flatten() {
        let entry_path = entry.path();
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.is_dir() {
            total = total.saturating_add(dir_size_bytes(&entry_path));
        } else if metadata.is_file() {
            total = total.saturating_add(metadata.len());
        }
    }
    total
}

pub fn sandbox_storage_info(name: Option<&str>, root_dir: &Path) -> SandboxStorageInfo {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    let exists = root_dir.exists();
    let size_bytes = if exists { dir_size_bytes(root_dir) } else { 0 };

    let available = exists || fs::create_dir_all(root_dir).is_ok();
    let has_container = container_exists(container_name);
    let legacy_container_detected = if has_container {
        match container_has_required_mounts(container_name) {
            Ok(has_required_mounts) => !has_required_mounts,
            Err(error) => {
                warn!(
                    "[deck-docker] Failed to inspect container mounts for '{}': {}",
                    container_name, error
                );
                true
            }
        }
    } else {
        false
    };

    SandboxStorageInfo {
        root_dir: parse_storage_root(root_dir),
        exists,
        size_bytes,
        available,
        legacy_container_detected,
    }
}

#[cfg(test)]
mod tests {
    use super::parse_exact_container_id_from_ps_output;

    #[test]
    fn parse_exact_container_id_ignores_name_prefix_matches() {
        let output = "abc123\tdeck-desktop-sandbox-ai-remote\n";
        let result = parse_exact_container_id_from_ps_output(output, "deck-desktop-sandbox-ai");
        assert!(result.is_none());
    }

    #[test]
    fn parse_exact_container_id_returns_exact_name_match() {
        let output = "abc123\tdeck-desktop-sandbox-ai-remote\ndef456\tdeck-desktop-sandbox-ai\n";
        let result = parse_exact_container_id_from_ps_output(output, "deck-desktop-sandbox-ai");
        assert_eq!(result.as_deref(), Some("def456"));
    }
}

pub fn pull_image_with_progress<F>(
    image: &str,
    cancel_token: &PullCancelToken,
    on_progress: F,
) -> Result<String, String>
where
    F: Fn(&PullProgress),
{
    info!("[deck-docker] Pulling image: {}...", image);
    cancel_token.reset();

    on_progress(&PullProgress {
        stage: "pulling".into(),
        message: format!("Pulling {}...", image),
        percent: 0,
        layers_done: 0,
        layers_total: 0,
    });

    let mut child = docker_cmd()
        .args(["pull", image])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            let msg = format!("Failed to execute docker pull: {}", e);
            error!("[deck-docker] {}", msg);
            msg
        })?;

    cancel_token.set_child_pid(child.id());

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let mut layers: HashMap<String, LayerState> = HashMap::new();

    if let Some(out) = stdout {
        let reader = BufReader::new(out);
        for line in reader.lines() {
            if cancel_token.is_cancelled() {
                info!("[deck-docker] Pull cancelled by user");
                let _ = child.kill();
                let _ = child.wait();
                return Err("Pull cancelled".to_string());
            }

            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            debug!("[deck-docker] {}", trimmed);

            if let Some((layer_id, status)) = trimmed.split_once(':') {
                let layer_id = layer_id.trim();
                let status_text = status.trim();
                if !layer_id.is_empty()
                    && layer_id.len() <= 12
                    && layer_id.chars().all(|c| c.is_ascii_hexdigit())
                {
                    let state = layer_state_from_status(status_text);
                    layers.insert(layer_id.to_string(), state);

                    let (done, total, percent) = compute_pull_progress(&layers);
                    on_progress(&PullProgress {
                        stage: "pulling".into(),
                        message: format!("{}: {}", layer_id, status_text),
                        percent,
                        layers_done: done,
                        layers_total: total,
                    });
                    continue;
                }
            }

            let (done, total, percent) = compute_pull_progress(&layers);
            on_progress(&PullProgress {
                stage: "pulling".into(),
                message: trimmed.to_string(),
                percent,
                layers_done: done,
                layers_total: total,
            });
        }
    }

    cancel_token.set_child_pid(0);

    if cancel_token.is_cancelled() {
        let _ = child.kill();
        let _ = child.wait();
        return Err("Pull cancelled".to_string());
    }

    let status = child.wait().map_err(|e| {
        let msg = format!("Failed to wait for docker pull: {}", e);
        error!("[deck-docker] {}", msg);
        msg
    })?;

    if status.success() {
        let msg = format!("Successfully pulled {}", image);
        info!("[deck-docker] {}", msg);
        on_progress(&PullProgress {
            stage: "complete".into(),
            message: msg.clone(),
            percent: 100,
            layers_done: layers.len() as u32,
            layers_total: layers.len() as u32,
        });
        Ok(msg)
    } else {
        if cancel_token.is_cancelled() {
            return Err("Pull cancelled".to_string());
        }
        let mut err_output = String::new();
        if let Some(err) = stderr {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                if !err_output.is_empty() {
                    err_output.push('\n');
                }
                err_output.push_str(&line);
            }
        }
        let msg = format!("Failed to pull {}: {}", image, err_output);
        error!("[deck-docker] {}", msg);
        on_progress(&PullProgress {
            stage: "error".into(),
            message: msg.clone(),
            percent: 0,
            layers_done: 0,
            layers_total: 0,
        });
        Err(msg)
    }
}

pub fn start_container(config: &SandboxConfig, storage_root: &Path) -> Result<String, String> {
    let image = config.image();
    let name = config.container_name();
    let persistence = config.persistence();
    let ports = SandboxPorts::default();

    info!(
        "[deck-docker] Starting sandbox container '{}' with image '{}'",
        name, image
    );

    let has_container = container_exists(name);
    if has_container {
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

        if let Some(container_id) = running_container_id_by_exact_name(name) {
            info!(
                "[deck-docker] Container '{}' already running (ID: {})",
                name, container_id
            );
            return Ok(container_id);
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

        if let Some(container_id) = running_container_id_by_exact_name(name) {
            return Ok(container_id);
        }
        let stdout = String::from_utf8_lossy(&start_output.stdout)
            .trim()
            .to_string();
        if !stdout.is_empty() {
            return Ok(stdout);
        }
        return Err("Container started but ID could not be resolved".to_string());
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
        "DECK_LOG_LEVEL=debug".to_string(),
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
        "--print-logs".to_string(),
        "--log-level".to_string(),
        "DEBUG".to_string(),
    ]);

    let output = docker_cmd().args(args).output().map_err(|e| {
        let msg = format!("Failed to start container: {}", e);
        error!("[deck-docker] {}", msg);
        msg
    })?;

    if output.status.success() {
        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        info!(
            "[deck-docker] Container started successfully, ID: {}",
            container_id
        );
        Ok(container_id)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let msg = format!("Failed to start container: {}", stderr);
        error!("[deck-docker] {}", msg);
        Err(msg)
    }
}

pub fn stop_container(name: Option<&str>) -> Result<String, String> {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    info!("[deck-docker] Stopping container '{}'...", container_name);

    if !container_exists(container_name) {
        let msg = format!("Container {} not found", container_name);
        info!("[deck-docker] {}", msg);
        return Ok(msg);
    }

    if !is_container_running(container_name) {
        let msg = format!("Container {} is already stopped", container_name);
        info!("[deck-docker] {}", msg);
        return Ok(msg);
    }

    let stop_output = docker_cmd()
        .args(["stop", container_name])
        .output()
        .map_err(|e| {
            let msg = format!("Failed to stop container: {}", e);
            error!("[deck-docker] {}", msg);
            msg
        })?;

    if !stop_output.status.success() {
        let stderr = String::from_utf8_lossy(&stop_output.stderr).to_string();
        let msg = format!("Failed to stop container: {}", stderr);
        error!("[deck-docker] {}", msg);
        return Err(msg);
    }

    let msg = format!("Container {} stopped", container_name);
    info!("[deck-docker] {}", msg);
    Ok(msg)
}

pub fn reset_sandbox(name: Option<&str>, storage_root: &Path) -> Result<String, String> {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    info!(
        "[deck-docker] Resetting sandbox '{}' with storage root '{}'",
        container_name,
        storage_root.display()
    );

    if container_exists(container_name) {
        let rm_output = docker_cmd()
            .args(["rm", "-f", container_name])
            .output()
            .map_err(|e| {
                let msg = format!("Failed to remove container '{}': {}", container_name, e);
                error!("[deck-docker] {}", msg);
                msg
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
        fs::remove_dir_all(storage_root).map_err(|e| {
            let msg = format!(
                "Failed to remove sandbox storage '{}': {}",
                storage_root.display(),
                e
            );
            error!("[deck-docker] {}", msg);
            msg
        })?;
    }

    Ok(format!(
        "Sandbox '{}' reset and storage removed at '{}'",
        container_name,
        storage_root.display()
    ))
}
