use std::sync::{Arc, Mutex};

use tauri_plugin_shell::process::CommandChild;

use super::{PilotComponentStatus, PilotRuntimeComponentsStatus, PilotRuntimeStateStatus};

#[derive(Default)]
pub struct PilotRuntimeManager {
    pub inner: Arc<Mutex<PilotRuntimeState>>,
}

#[derive(Default)]
pub struct PilotProcessState {
    pub child: Option<CommandChild>,
    pub child_exited: bool,
    pub url: Option<String>,
    pub last_stdout: Option<String>,
    pub last_stderr: Option<String>,
}

#[derive(Default)]
pub struct PilotRuntimeState {
    pub host: PilotProcessState,
    pub server: PilotProcessState,
    pub bridge: PilotProcessState,
    pub workspace_path: Option<String>,
    pub opencode_url: Option<String>,
    pub opencode_username: Option<String>,
    pub opencode_password: Option<String>,
    pub host_data_dir: Option<String>,
    pub bridge_health_port: Option<u16>,
}

fn component_snapshot(state: &mut PilotProcessState) -> PilotComponentStatus {
    let (running, pid) = match state.child.as_ref() {
        None => (false, None),
        Some(child) if state.child_exited => {
            state.child = None;
            (false, None)
        }
        Some(child) => (true, Some(child.pid())),
    };

    PilotComponentStatus {
        running,
        pid,
        url: state.url.clone(),
        last_stdout: state.last_stdout.clone(),
        last_stderr: state.last_stderr.clone(),
    }
}

impl PilotRuntimeManager {
    pub fn stop_locked(state: &mut PilotRuntimeState) {
        if let Some(child) = state.bridge.child.take() {
            let _ = child.kill();
        }
        if let Some(child) = state.server.child.take() {
            let _ = child.kill();
        }
        if let Some(child) = state.host.child.take() {
            let _ = child.kill();
        }

        state.bridge.child_exited = true;
        state.server.child_exited = true;
        state.host.child_exited = true;

        state.bridge.url = None;
        state.server.url = None;
        state.host.url = None;

        state.bridge.last_stdout = None;
        state.bridge.last_stderr = None;
        state.server.last_stdout = None;
        state.server.last_stderr = None;
        state.host.last_stdout = None;
        state.host.last_stderr = None;

        state.workspace_path = None;
        state.opencode_url = None;
        state.opencode_username = None;
        state.opencode_password = None;
        state.host_data_dir = None;
        state.bridge_health_port = None;
    }

    pub fn snapshot_locked(state: &mut PilotRuntimeState) -> PilotRuntimeStateStatus {
        let host = component_snapshot(&mut state.host);
        let server = component_snapshot(&mut state.server);
        let bridge = component_snapshot(&mut state.bridge);

        PilotRuntimeStateStatus {
            running: host.running || server.running || bridge.running,
            workspace_path: state.workspace_path.clone(),
            opencode_url: state.opencode_url.clone(),
            opencode_username: state.opencode_username.clone(),
            opencode_password: state.opencode_password.clone(),
            host_data_dir: state.host_data_dir.clone(),
            bridge_health_port: state.bridge_health_port,
            components: PilotRuntimeComponentsStatus {
                host,
                server,
                bridge,
            },
        }
    }
}
