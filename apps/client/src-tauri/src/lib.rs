mod api_log;
mod credential_store;
mod opencode_bridge;
mod pilot_runtime;
mod sandbox;
mod sse_trace;

use tauri::Manager;

use credential_store::{
    init_credential_store, list_credentials, list_custom_providers, remove_credential,
    remove_custom_provider, save_credential, save_custom_provider,
};
use opencode_bridge::{
    start_bridge, stop_bridge, OpencodeBridgeManager, StartOpencodeWebBridgeInput,
    StopOpencodeWebBridgeInput,
};
use pilot_runtime::{
    pilot_runtime_health, pilot_runtime_start, pilot_runtime_status, pilot_runtime_stop,
    PilotRuntimeManager,
};
use log::{error, info};
use tauri::Emitter;

use std::sync::Arc;

use sandbox::{DockerInfo, PullCancelToken, SandboxConfig, SandboxStatus};

fn log_startup_diagnostics() {
    info!("[deck] OS: {} / {}", std::env::consts::OS, std::env::consts::ARCH);
    info!("[deck] Executable: {:?}", std::env::current_exe().unwrap_or_default());
    info!("[deck] CWD: {:?}", std::env::current_dir().unwrap_or_default());
    info!("[deck] PATH: {}", std::env::var("PATH").unwrap_or_default());

    let docker = sandbox::check_docker_available();
    info!(
        "[deck] Docker: available={} path={:?} error={:?}",
        docker.available,
        docker.resolved_path,
        docker.error
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
    sse_trace::get_log_path(&app)
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
async fn start_sandbox(
    app: tauri::AppHandle,
    state: tauri::State<'_, sandbox::SharedPullCancelToken>,
    config: Option<SandboxConfig>,
) -> Result<String, String> {
    info!("[deck] Command: start_sandbox, config: {:?}", config);
    let cfg = config.unwrap_or_default();
    let image = cfg.image().to_string();
    let token = Arc::clone(&state);

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
        sandbox::start_container(&cfg)
    })
    .await
    .map_err(|e| {
        let msg = format!("Task join error: {}", e);
        error!("[deck] {}", msg);
        msg
    })?
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_plugin = tauri_plugin_log::Builder::new()
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::LogDir { file_name: Some("deck".into()) },
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
            let store = init_credential_store(app)
                .expect("failed to initialise credential store");
            app.manage(store);
            Ok(())
        })
        .manage(OpencodeBridgeManager::default())
        .manage(PilotRuntimeManager::default())
        .manage(Arc::new(PullCancelToken::default()) as sandbox::SharedPullCancelToken)
        .invoke_handler(tauri::generate_handler![
            check_docker,
            get_sandbox_status,
            start_sandbox,
            stop_sandbox,
            cancel_sandbox_start,
            get_app_log_dir,
            log_api_call,
            log_sse_trace_entry,
            get_sse_trace_log_path,
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
