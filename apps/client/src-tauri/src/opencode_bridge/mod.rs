mod context;
mod http_io;
mod lifecycle;
mod proxy;
mod routing;

use std::sync::Arc;

use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{oneshot, Mutex};

use context::{BridgeContext, BridgeRuntime};
use lifecycle::{
    bind_bridge_listener, build_auth_header, parse_upstream_base_url, validate_start_input,
};
use proxy::handle_client_connection;
use routing::{build_iframe_entry_path, encode_directory_header, normalize_optional_directory};

const BRIDGE_HOST: &str = "127.0.0.1";
const BRIDGE_IFRAME_PATH: &str = "/opencode";
const BRIDGE_PORT_START: u16 = 43100;
const BRIDGE_PORT_RANGE: u16 = 200;
const MAX_HEADER_BYTES: usize = 64 * 1024;
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;
const DIRECTORY_HEADER_NAME: &str = "x-opencode-directory";

pub const EVENT_BRIDGE_STARTED: &str = "deck://opencode-bridge-started";
pub const EVENT_BRIDGE_UPSTREAM_FAILURE: &str = "deck://opencode-bridge-upstream-failure";
pub const EVENT_BRIDGE_AUTH_FAILURE: &str = "deck://opencode-bridge-auth-failure";

#[derive(Default)]
pub struct OpencodeBridgeManager {
    inner: Arc<Mutex<Option<BridgeRuntime>>>,
    lifecycle: Arc<Mutex<()>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOpencodeWebBridgeInput {
    pub profile_id: String,
    pub upstream_base_url: String,
    pub username: String,
    pub password: String,
    pub directory: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopOpencodeWebBridgeInput {
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpencodeWebBridgeInfo {
    pub running: bool,
    pub profile_id: String,
    pub upstream_base_url: String,
    pub iframe_base_url: String,
    pub port: u16,
}

pub async fn start_bridge(
    app: AppHandle,
    state: State<'_, OpencodeBridgeManager>,
    input: StartOpencodeWebBridgeInput,
) -> Result<OpencodeWebBridgeInfo, String> {
    let _lifecycle_guard = state.lifecycle.lock().await;
    validate_start_input(&input)?;

    let profile_id = input.profile_id.trim().to_string();
    let upstream_base_url = parse_upstream_base_url(&input.upstream_base_url)?;
    let upstream_base_url_for_compare = upstream_base_url.to_string();
    let auth_header = build_auth_header(&input.username, &input.password);
    let requested_directory = normalize_optional_directory(input.directory);
    let effective_directory = requested_directory.clone();
    let directory_header = effective_directory.as_deref().map(encode_directory_header);

    {
        let guard = state.inner.lock().await;
        if let Some(runtime) = guard.as_ref() {
            if runtime.matches_start_request(
                &profile_id,
                &upstream_base_url_for_compare,
                &auth_header,
                effective_directory.as_deref(),
            ) {
                return Ok(runtime.info());
            }
        }
    }

    let previous_runtime = {
        let mut guard = state.inner.lock().await;
        guard.take()
    };
    if let Some(runtime) = previous_runtime {
        runtime.stop().await;
    }

    let (listener, port) = bind_bridge_listener(&profile_id).await?;

    let iframe_path = build_iframe_entry_path(requested_directory.as_deref());
    let iframe_base_url = format!("http://{BRIDGE_HOST}:{port}{iframe_path}");

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| format!("Failed to build bridge HTTP client: {error}"))?;

    let directory_header_for_log = directory_header.clone();
    let context = Arc::new(BridgeContext {
        app: app.clone(),
        profile_id: profile_id.clone(),
        upstream_base_url: upstream_base_url.clone(),
        auth_header: auth_header.clone(),
        forced_directory: effective_directory.clone(),
        directory_header,
        client,
    });

    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
    let task = tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = &mut shutdown_rx => {
                    break;
                }
                accepted = listener.accept() => {
                    let Ok((stream, _peer_addr)) = accepted else {
                        break;
                    };
                    let connection_context = Arc::clone(&context);
                    tokio::spawn(async move {
                        if let Err(error) = handle_client_connection(Arc::clone(&connection_context), stream).await {
                            proxy::emit_upstream_failure(&connection_context, "bridge-connection-error", error);
                        }
                    });
                }
            }
        }
    });

    let runtime = BridgeRuntime {
        profile_id: profile_id.clone(),
        upstream_base_url: upstream_base_url_for_compare,
        auth_header,
        forced_directory: effective_directory,
        iframe_base_url: iframe_base_url.clone(),
        port,
        shutdown_tx: Some(shutdown_tx),
        task,
    };

    let info = runtime.info();

    {
        let mut guard = state.inner.lock().await;
        *guard = Some(runtime);
    }

    let _ = app.emit(
        EVENT_BRIDGE_STARTED,
        json!({
            "profileId": profile_id,
            "upstreamBaseUrl": info.upstream_base_url,
            "iframeBaseUrl": info.iframe_base_url,
            "port": info.port,
        }),
    );

    info!(
        "[opencode-bridge] started profile={} port={} upstream={} directoryHeader={}",
        info.profile_id,
        info.port,
        info.upstream_base_url,
        directory_header_for_log.as_deref().unwrap_or("<none>")
    );

    Ok(info)
}

pub async fn stop_bridge(
    state: State<'_, OpencodeBridgeManager>,
    input: Option<StopOpencodeWebBridgeInput>,
) -> Result<(), String> {
    let _lifecycle_guard = state.lifecycle.lock().await;
    let target_profile_id = input
        .and_then(|value| value.profile_id)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let runtime = {
        let mut guard = state.inner.lock().await;
        if let (Some(target_profile), Some(current)) =
            (target_profile_id.as_deref(), guard.as_ref())
        {
            if current.profile_id != target_profile {
                return Ok(());
            }
        }
        guard.take()
    };

    if let Some(runtime) = runtime {
        runtime.stop().await;
    }

    Ok(())
}
