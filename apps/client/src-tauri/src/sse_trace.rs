use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;

const SSE_TRACE_FILE_NAME: &str = "sse-events.jsonl";
const MAX_TRACE_FILE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_FIELD_BYTES: usize = 8_000;

#[derive(serde::Deserialize, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SseTraceLogEntry {
    pub timestamp: u64,
    pub url: String,
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
    let path = resolve_log_path(app)?;
    truncate_if_oversized(&path)?;

    let sanitized = SseTraceLogEntry {
        timestamp: entry.timestamp,
        url: truncate(entry.url),
        summary: entry.summary.map(truncate),
        request_body: entry.request_body.map(truncate),
        response_body: entry.response_body.map(truncate),
        error: entry.error.map(truncate),
    };
    let line = serde_json::to_string(&sanitized).map_err(|e| e.to_string())?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("failed to open SSE trace file at {}: {e}", path.display()))?;
    writeln!(file, "{line}")
        .map_err(|e| format!("failed to write SSE trace file at {}: {e}", path.display()))
}

pub fn get_log_path(app: &tauri::AppHandle) -> Result<String, String> {
    resolve_log_path(app).map(|path| path.display().to_string())
}

fn resolve_log_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("failed to resolve app log dir: {e}"))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create app log dir {}: {e}", dir.display()))?;
    Ok(dir.join(SSE_TRACE_FILE_NAME))
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

fn truncate(value: String) -> String {
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
