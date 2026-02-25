use std::time::Duration;

use reqwest::Url;
use tauri::AppHandle;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use tokio::time::timeout;

use super::OpencodeWebBridgeInfo;

#[derive(Clone)]
pub(super) struct BridgeContext {
    pub(super) app: AppHandle,
    pub(super) profile_id: String,
    pub(super) upstream_base_url: Url,
    pub(super) auth_header: String,
    pub(super) forced_directory: Option<String>,
    pub(super) directory_header: Option<String>,
    pub(super) client: reqwest::Client,
}

pub(super) struct BridgeRuntime {
    pub(super) profile_id: String,
    pub(super) upstream_base_url: String,
    pub(super) auth_header: String,
    pub(super) forced_directory: Option<String>,
    pub(super) iframe_base_url: String,
    pub(super) port: u16,
    pub(super) shutdown_tx: Option<oneshot::Sender<()>>,
    pub(super) task: JoinHandle<()>,
}

impl BridgeRuntime {
    pub(super) fn info(&self) -> OpencodeWebBridgeInfo {
        OpencodeWebBridgeInfo {
            running: true,
            profile_id: self.profile_id.clone(),
            upstream_base_url: self.upstream_base_url.clone(),
            iframe_base_url: self.iframe_base_url.clone(),
            port: self.port,
        }
    }

    pub(super) async fn stop(mut self) {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            let _ = shutdown_tx.send(());
        }

        let mut task = self.task;
        if timeout(Duration::from_secs(2), &mut task).await.is_err() {
            task.abort();
            let _ = task.await;
        }
    }

    pub(super) fn matches_start_request(
        &self,
        profile_id: &str,
        upstream_base_url: &str,
        auth_header: &str,
        forced_directory: Option<&str>,
    ) -> bool {
        self.profile_id == profile_id
            && self.upstream_base_url == upstream_base_url
            && self.auth_header == auth_header
            && self.forced_directory.as_deref() == forced_directory
    }
}
