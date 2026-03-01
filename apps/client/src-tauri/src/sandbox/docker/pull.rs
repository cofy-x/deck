use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use log::{debug, error, info};
use serde::Serialize;

use super::command::docker_cmd;

#[cfg(windows)]
use std::process::Command;

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
    let normalized = status.trim().to_lowercase();
    if normalized.starts_with("pull complete") || normalized.starts_with("already exists") {
        LayerState::Complete
    } else if normalized.starts_with("extracting") || normalized.starts_with("verifying") {
        LayerState::Extracting
    } else if normalized.starts_with("downloading") || normalized.starts_with("download complete") {
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
        .filter(|state| **state == LayerState::Complete)
        .count() as u32;

    let weighted: u32 = layers
        .values()
        .map(|state| match state {
            LayerState::Waiting => 0u32,
            LayerState::Downloading => 33,
            LayerState::Extracting => 66,
            LayerState::Complete => 100,
        })
        .sum();
    let percent = (weighted / total).min(100) as u8;
    (done, total, percent)
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
        .map_err(|error| {
            let message = format!("Failed to execute docker pull: {}", error);
            error!("[deck-docker] {}", message);
            message
        })?;

    cancel_token.set_child_pid(child.id());

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let mut layers: HashMap<String, LayerState> = HashMap::new();

    if let Some(stdout) = stdout {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if cancel_token.is_cancelled() {
                info!("[deck-docker] Pull cancelled by user");
                let _ = child.kill();
                let _ = child.wait();
                return Err("Pull cancelled".to_string());
            }

            let line = match line {
                Ok(line) => line,
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
                    && layer_id
                        .chars()
                        .all(|character| character.is_ascii_hexdigit())
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

    let status = child.wait().map_err(|error| {
        let message = format!("Failed to wait for docker pull: {}", error);
        error!("[deck-docker] {}", message);
        message
    })?;

    if status.success() {
        let message = format!("Successfully pulled {}", image);
        info!("[deck-docker] {}", message);
        on_progress(&PullProgress {
            stage: "complete".into(),
            message: message.clone(),
            percent: 100,
            layers_done: layers.len() as u32,
            layers_total: layers.len() as u32,
        });
        Ok(message)
    } else {
        if cancel_token.is_cancelled() {
            return Err("Pull cancelled".to_string());
        }
        let mut err_output = String::new();
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if !err_output.is_empty() {
                    err_output.push('\n');
                }
                err_output.push_str(&line);
            }
        }
        let message = format!("Failed to pull {}: {}", image, err_output);
        error!("[deck-docker] {}", message);
        on_progress(&PullProgress {
            stage: "error".into(),
            message: message.clone(),
            percent: 0,
            layers_done: 0,
            layers_total: 0,
        });
        Err(message)
    }
}
