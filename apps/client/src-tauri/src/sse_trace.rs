use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use log::{debug, warn};
use tauri::Manager;

const SESSIONS_DIR_NAME: &str = "sessions";
const UNSCOPED_FILE_NAME: &str = "_unscoped.jsonl";
const MAX_TRACE_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_SESSIONS_DIR_BYTES: u64 = 50 * 1024 * 1024;
const MAX_SESSION_AGE_SECS: u64 = 7 * 24 * 60 * 60;
const CLEANUP_INTERVAL: u64 = 100;
const MAX_FIELD_BYTES: usize = 8_000;

static WRITE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(serde::Deserialize, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SseTraceLogEntry {
    pub timestamp: u64,
    pub url: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub request_body: Option<String>,
    #[serde(default)]
    pub response_body: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

pub fn append_entry(app: &tauri::AppHandle, entry: SseTraceLogEntry) -> Result<(), String> {
    let sessions_dir = resolve_sessions_dir(app)?;
    let path = session_file_path(&sessions_dir, entry.session_id.as_deref());
    truncate_if_oversized(&path)?;

    let sanitized = SseTraceLogEntry {
        timestamp: entry.timestamp,
        url: truncate_field(entry.url),
        session_id: entry.session_id,
        summary: entry.summary.map(truncate_field),
        request_body: entry.request_body.map(truncate_field),
        response_body: entry.response_body.map(truncate_field),
        error: entry.error.map(truncate_field),
    };
    let line = serde_json::to_string(&sanitized).map_err(|e| e.to_string())?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("failed to open SSE trace file at {}: {e}", path.display()))?;
    writeln!(file, "{line}")
        .map_err(|e| format!("failed to write SSE trace file at {}: {e}", path.display()))?;

    let count = WRITE_COUNTER.fetch_add(1, Ordering::Relaxed);
    if count % CLEANUP_INTERVAL == 0 {
        cleanup_old_sessions(&sessions_dir);
    }

    Ok(())
}

pub fn get_log_dir(app: &tauri::AppHandle) -> Result<String, String> {
    resolve_sessions_dir(app).map(|p| p.display().to_string())
}

fn resolve_sessions_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("failed to resolve app log dir: {e}"))?
        .join(SESSIONS_DIR_NAME);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create sessions dir {}: {e}", dir.display()))?;
    Ok(dir)
}

fn session_file_path(sessions_dir: &Path, session_id: Option<&str>) -> PathBuf {
    match session_id {
        Some(id) if !id.is_empty() => {
            let safe_name: String = id
                .chars()
                .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
                .collect();
            sessions_dir.join(format!("{safe_name}.jsonl"))
        }
        _ => sessions_dir.join(UNSCOPED_FILE_NAME),
    }
}

fn truncate_if_oversized(path: &Path) -> Result<(), String> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return Ok(()),
    };
    if metadata.len() <= MAX_TRACE_FILE_BYTES {
        return Ok(());
    }
    fs::write(path, b"").map_err(|e| format!("failed to truncate SSE trace file: {e}"))
}

fn cleanup_old_sessions(sessions_dir: &Path) {
    let entries = match fs::read_dir(sessions_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    let now = std::time::SystemTime::now();
    let mut files: Vec<(PathBuf, u64, std::time::SystemTime)> = Vec::new();
    let mut total_bytes: u64 = 0;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        let meta = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
        let size = meta.len();
        total_bytes += size;

        let age = now.duration_since(modified).unwrap_or_default();
        if age.as_secs() > MAX_SESSION_AGE_SECS {
            debug!("[deck-sse-trace] Removing expired session log: {}", path.display());
            let _ = fs::remove_file(&path);
            total_bytes = total_bytes.saturating_sub(size);
            continue;
        }

        files.push((path, size, modified));
    }

    if total_bytes <= MAX_SESSIONS_DIR_BYTES {
        return;
    }

    files.sort_by_key(|(_, _, modified)| *modified);

    for (path, size, _) in &files {
        if total_bytes <= MAX_SESSIONS_DIR_BYTES {
            break;
        }
        debug!("[deck-sse-trace] Evicting session log for space: {}", path.display());
        if fs::remove_file(path).is_ok() {
            total_bytes = total_bytes.saturating_sub(*size);
        }
    }

    if total_bytes > MAX_SESSIONS_DIR_BYTES {
        warn!(
            "[deck-sse-trace] Sessions dir still exceeds budget after cleanup: {} bytes",
            total_bytes
        );
    }
}

fn truncate_field(value: String) -> String {
    if value.len() <= MAX_FIELD_BYTES {
        return value;
    }
    let mut end = MAX_FIELD_BYTES;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    let truncated = &value[..end];
    format!("{truncated}\n...(truncated)")
}
