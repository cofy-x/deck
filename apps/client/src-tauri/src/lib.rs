mod api_log;
mod credential_store;
mod external_editor;
mod opencode_bridge;
mod pilot_runtime;
mod sandbox;
mod sse_trace;

use serde::Deserialize;
use serde::Serialize;
use tauri::Manager;

use credential_store::{
    init_credential_store, list_credentials, list_custom_providers, remove_credential,
    remove_custom_provider, save_credential, save_custom_provider,
};
use external_editor::{OpenProjectInEditorInput, OpenProjectInEditorResult};
use log::{debug, error, info, warn};
use opencode_bridge::{
    start_bridge, stop_bridge, OpencodeBridgeManager, StartOpencodeWebBridgeInput,
    StopOpencodeWebBridgeInput,
};
use pilot_runtime::{
    pilot_runtime_health, pilot_runtime_start, pilot_runtime_status, pilot_runtime_stop,
    PilotRuntimeManager,
};
use tauri::Emitter;

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use sandbox::{
    DockerInfo, PullCancelToken, SandboxConfig, SandboxPorts, SandboxStartResult, SandboxStatus,
    SandboxStorageInfo,
};

#[derive(Debug, Clone, Serialize)]
struct SandboxStartupPhaseEvent {
    phase: String,
}

#[derive(Debug, Default)]
struct LocalProjectDetectManager {
    in_flight: Arc<Mutex<bool>>,
}

#[derive(Debug, Clone, Serialize)]
struct SandboxProjectDetectingEvent {
    trigger: String,
}

#[derive(Debug, Clone, Serialize)]
struct SandboxProjectDetectedEvent {
    trigger: String,
    directory: String,
    elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
struct SandboxProjectDetectTimeoutEvent {
    trigger: String,
    elapsed_ms: u64,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct OpencodePathResponse {
    directory: Option<String>,
}

fn start_local_project_detection(
    app: tauri::AppHandle,
    in_flight: Arc<Mutex<bool>>,
    trigger: &str,
    path_timeout_ms: u64,
) -> Result<bool, String> {
    {
        let mut guard = in_flight
            .lock()
            .map_err(|_| "Local project detection state lock poisoned".to_string())?;
        if *guard {
            info!(
                "[deck] Local project detection already in flight; skip trigger={}",
                trigger
            );
            return Ok(false);
        }
        *guard = true;
    }

    let trigger = trigger.to_string();
    std::thread::spawn(move || {
        let started_at = Instant::now();
        let url = format!(
            "http://127.0.0.1:{}/path",
            sandbox::SandboxPorts::default().opencode
        );

        let _ = app.emit(
            "sandbox-project-detecting",
            SandboxProjectDetectingEvent {
                trigger: trigger.clone(),
            },
        );

        let response = ureq::get(&url)
            .timeout(Duration::from_millis(path_timeout_ms))
            .call();
        let elapsed_ms = started_at.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => match resp.into_json::<OpencodePathResponse>() {
                Ok(path) => {
                    let directory = path.directory.unwrap_or_default().trim().to_string();
                    if directory.is_empty() {
                        let _ = app.emit(
                            "sandbox-project-detect-timeout",
                            SandboxProjectDetectTimeoutEvent {
                                trigger: trigger.clone(),
                                elapsed_ms,
                                reason: "OpenCode /path returned empty directory".to_string(),
                            },
                        );
                    } else {
                        let _ = app.emit(
                            "sandbox-project-detected",
                            SandboxProjectDetectedEvent {
                                trigger: trigger.clone(),
                                directory,
                                elapsed_ms,
                            },
                        );
                    }
                }
                Err(error) => {
                    let _ = app.emit(
                        "sandbox-project-detect-timeout",
                        SandboxProjectDetectTimeoutEvent {
                            trigger: trigger.clone(),
                            elapsed_ms,
                            reason: format!("Failed to parse OpenCode /path response: {error}"),
                        },
                    );
                }
            },
            Err(error) => {
                let _ = app.emit(
                    "sandbox-project-detect-timeout",
                    SandboxProjectDetectTimeoutEvent {
                        trigger: trigger.clone(),
                        elapsed_ms,
                        reason: format!("OpenCode /path request failed: {error}"),
                    },
                );
            }
        }

        if let Ok(mut guard) = in_flight.lock() {
            *guard = false;
        }
    });

    Ok(true)
}

fn resolve_timeout_ms_from_env(
    env_name: &str,
    default_timeout_ms: u64,
    min_timeout_ms: u64,
    max_timeout_ms: u64,
) -> u64 {
    let mut timeout_ms = std::env::var(env_name)
        .ok()
        .and_then(|raw| raw.trim().parse::<u64>().ok())
        .unwrap_or(default_timeout_ms);

    if timeout_ms < min_timeout_ms {
        timeout_ms = min_timeout_ms;
    } else if timeout_ms > max_timeout_ms {
        timeout_ms = max_timeout_ms;
    }

    timeout_ms
}

fn resolve_local_opencode_health_timeout_ms() -> u64 {
    const DEFAULT_TIMEOUT_MS: u64 = 60_000;
    const MIN_TIMEOUT_MS: u64 = 5_000;
    const MAX_TIMEOUT_MS: u64 = 300_000;
    const ENV_NAME: &str = "DECK_SANDBOX_OPENCODE_HEALTH_TIMEOUT_MS";
    resolve_timeout_ms_from_env(ENV_NAME, DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
}

fn resolve_local_project_path_timeout_ms() -> u64 {
    const DEFAULT_TIMEOUT_MS: u64 = 120_000;
    const MIN_TIMEOUT_MS: u64 = 5_000;
    const MAX_TIMEOUT_MS: u64 = 300_000;
    const ENV_NAME: &str = "DECK_SANDBOX_PROJECT_PATH_TIMEOUT_MS";
    resolve_timeout_ms_from_env(ENV_NAME, DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
}

fn log_startup_diagnostics() {
    info!(
        "[deck] OS: {} / {}",
        std::env::consts::OS,
        std::env::consts::ARCH
    );
    info!(
        "[deck] Executable: {:?}",
        std::env::current_exe().unwrap_or_default()
    );
    info!(
        "[deck] CWD: {:?}",
        std::env::current_dir().unwrap_or_default()
    );
    info!("[deck] PATH: {}", std::env::var("PATH").unwrap_or_default());

    let docker = sandbox::check_docker_available();
    info!(
        "[deck] Docker: available={} path={:?} error={:?}",
        docker.available, docker.resolved_path, docker.error
    );
}

fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown>".into());
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "<non-string panic>".into()
        };
        error!("[deck] PANIC at {}: {}", location, payload);
        default_hook(info);
    }));
}

// ---------------------------------------------------------------------------
// API logging (dev mode diagnostics)
// ---------------------------------------------------------------------------

#[tauri::command]
fn log_api_call(entry: api_log::ApiLogEntry) {
    api_log::print_summary(&entry);
}

#[tauri::command]
fn log_sse_trace_entry(
    app: tauri::AppHandle,
    entry: sse_trace::SseTraceLogEntry,
) -> Result<(), String> {
    sse_trace::append_entry(&app, entry)
}

#[tauri::command]
fn get_sse_trace_log_path(app: tauri::AppHandle) -> Result<String, String> {
    sse_trace::get_log_dir(&app)
}

// ---------------------------------------------------------------------------
// Frontend log bridge (production front-end log capture)
// ---------------------------------------------------------------------------

#[tauri::command]
fn log_frontend_message(level: String, tag: String, message: String) {
    match level.as_str() {
        "error" => error!("[deck-fe:{}] {}", tag, message),
        "warn" => warn!("[deck-fe:{}] {}", tag, message),
        "debug" => debug!("[deck-fe:{}] {}", tag, message),
        _ => info!("[deck-fe:{}] {}", tag, message),
    }
}

// ---------------------------------------------------------------------------
// OpenCode Web bridge commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn start_opencode_web_bridge(
    app: tauri::AppHandle,
    state: tauri::State<'_, OpencodeBridgeManager>,
    input: StartOpencodeWebBridgeInput,
) -> Result<opencode_bridge::OpencodeWebBridgeInfo, String> {
    start_bridge(app, state, input).await
}

#[tauri::command]
async fn stop_opencode_web_bridge(
    state: tauri::State<'_, OpencodeBridgeManager>,
    input: Option<StopOpencodeWebBridgeInput>,
) -> Result<(), String> {
    stop_bridge(state, input).await
}

// ---------------------------------------------------------------------------
// Sandbox commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn check_docker() -> DockerInfo {
    info!("[deck] Command: check_docker");
    sandbox::check_docker_available()
}

#[tauri::command]
fn get_sandbox_status() -> SandboxStatus {
    sandbox::get_container_status(None)
}

#[tauri::command]
fn get_sandbox_storage_info(
    app: tauri::AppHandle,
    config: Option<SandboxConfig>,
) -> Result<SandboxStorageInfo, String> {
    let cfg = config.unwrap_or_default();
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;
    let storage_root = sandbox::resolve_storage_root(&app_data_dir, &cfg);
    Ok(sandbox::sandbox_storage_info(None, &storage_root))
}

#[tauri::command]
async fn start_sandbox(
    app: tauri::AppHandle,
    state: tauri::State<'_, sandbox::SharedPullCancelToken>,
    project_detect_state: tauri::State<'_, LocalProjectDetectManager>,
    config: Option<SandboxConfig>,
) -> Result<SandboxStartResult, String> {
    info!("[deck] Command: start_sandbox, config: {:?}", config);
    let opencode_health_timeout_ms = resolve_local_opencode_health_timeout_ms();
    let project_path_timeout_ms = resolve_local_project_path_timeout_ms();
    info!(
        "[deck] OpenCode startup timeouts: health={}ms, path={}ms",
        opencode_health_timeout_ms, project_path_timeout_ms
    );
    let cfg = config.unwrap_or_default();
    let image = cfg.image().to_string();
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;
    let storage_root = sandbox::resolve_storage_root(&app_data_dir, &cfg);
    let token = Arc::clone(&state);
    let project_detect_in_flight = Arc::clone(&project_detect_state.in_flight);

    tokio::task::spawn_blocking(move || {
        info!("[deck] Step 1: Checking image {}...", image);

        if !sandbox::image_exists(&image) {
            info!("[deck] Image not found, pulling...");
            match sandbox::pull_image_with_progress(&image, &token, |progress| {
                let _ = app.emit("sandbox-pull-progress", progress);
            }) {
                Ok(msg) => info!("[deck] Pull result: {}", msg),
                Err(msg) => return Err(format!("Failed to pull image: {}", msg)),
            }
        } else {
            info!("[deck] Image already exists, skipping pull");
        }

        info!("[deck] Step 2: Starting container...");
        let _ = app.emit(
            "sandbox-startup-phase",
            SandboxStartupPhaseEvent {
                phase: "starting_container".to_string(),
            },
        );
        let start_result = sandbox::start_container(&cfg, &storage_root)?;

        info!("[deck] Step 3: Waiting for OpenCode health...");
        let _ = app.emit(
            "sandbox-startup-phase",
            SandboxStartupPhaseEvent {
                phase: "waiting_opencode_health".to_string(),
            },
        );
        let ports = SandboxPorts::default();
        sandbox::wait_for_opencode_healthy(ports.opencode, opencode_health_timeout_ms)?;
        let _ = app.emit(
            "sandbox-startup-phase",
            SandboxStartupPhaseEvent {
                phase: "opencode_healthy".to_string(),
            },
        );
        let _ = start_local_project_detection(
            app.clone(),
            Arc::clone(&project_detect_in_flight),
            "start_sandbox",
            project_path_timeout_ms,
        );

        Ok(start_result)
    })
    .await
    .map_err(|e| {
        let msg = format!("Task join error: {}", e);
        error!("[deck] {}", msg);
        msg
    })?
}

#[tauri::command]
fn retry_local_project_detection(
    app: tauri::AppHandle,
    state: tauri::State<'_, LocalProjectDetectManager>,
) -> Result<(), String> {
    let status = sandbox::get_container_status(None);
    if !status.running {
        return Err("Sandbox is not running".to_string());
    }
    let project_path_timeout_ms = resolve_local_project_path_timeout_ms();
    let _ = start_local_project_detection(
        app,
        Arc::clone(&state.in_flight),
        "manual_retry",
        project_path_timeout_ms,
    )?;
    Ok(())
}

#[tauri::command]
fn cancel_sandbox_start(state: tauri::State<'_, sandbox::SharedPullCancelToken>) {
    info!("[deck] Command: cancel_sandbox_start");
    state.cancel();
}

#[tauri::command]
async fn stop_sandbox() -> Result<String, String> {
    info!("[deck] Command: stop_sandbox");
    tokio::task::spawn_blocking(|| sandbox::stop_container(None))
        .await
        .map_err(|e| {
            let msg = format!("Task join error: {}", e);
            error!("[deck] {}", msg);
            msg
        })?
}

#[tauri::command]
async fn reset_sandbox_storage(
    app: tauri::AppHandle,
    config: Option<SandboxConfig>,
) -> Result<String, String> {
    info!("[deck] Command: reset_sandbox_storage");
    let cfg = config.unwrap_or_default();
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;
    let storage_root = sandbox::resolve_storage_root(&app_data_dir, &cfg);
    let container_name = cfg.container_name().to_string();
    tokio::task::spawn_blocking(move || {
        sandbox::reset_sandbox(Some(&container_name), &storage_root)
    })
    .await
    .map_err(|e| {
        let msg = format!("Task join error: {}", e);
        error!("[deck] {}", msg);
        msg
    })?
}

// ---------------------------------------------------------------------------
// Application log path command
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_app_log_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_log_dir()
        .map(|p| p.display().to_string())
        .map_err(|e| format!("Failed to resolve app log dir: {}", e))
}

#[tauri::command]
fn open_project_in_editor(
    app: tauri::AppHandle,
    input: OpenProjectInEditorInput,
) -> Result<OpenProjectInEditorResult, String> {
    external_editor::open_project_in_editor(&app, input)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_plugin = tauri_plugin_log::Builder::new()
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::LogDir {
                file_name: Some("deck".into()),
            },
        ))
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::Stdout,
        ))
        .max_file_size(5_000_000)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
        .level(log::LevelFilter::Info)
        .build();

    tauri::Builder::default()
        .plugin(log_plugin)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            install_panic_hook();
            info!("[deck] Starting Deck application...");
            log_startup_diagnostics();
            let store = init_credential_store(app).expect("failed to initialise credential store");
            app.manage(store);
            Ok(())
        })
        .manage(OpencodeBridgeManager::default())
        .manage(PilotRuntimeManager::default())
        .manage(Arc::new(PullCancelToken::default()) as sandbox::SharedPullCancelToken)
        .manage(LocalProjectDetectManager::default())
        .invoke_handler(tauri::generate_handler![
            check_docker,
            get_sandbox_status,
            get_sandbox_storage_info,
            start_sandbox,
            retry_local_project_detection,
            stop_sandbox,
            reset_sandbox_storage,
            cancel_sandbox_start,
            get_app_log_dir,
            open_project_in_editor,
            log_api_call,
            log_sse_trace_entry,
            get_sse_trace_log_path,
            log_frontend_message,
            start_opencode_web_bridge,
            stop_opencode_web_bridge,
            pilot_runtime_start,
            pilot_runtime_stop,
            pilot_runtime_status,
            pilot_runtime_health,
            save_credential,
            list_credentials,
            remove_credential,
            save_custom_provider,
            list_custom_providers,
            remove_custom_provider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
