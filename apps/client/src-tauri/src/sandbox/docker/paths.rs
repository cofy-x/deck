use std::fs;
use std::path::{Path, PathBuf};

pub(super) const DEFAULT_STORAGE_ROOT_RELATIVE: &str = "sandbox/local";
pub(super) const CONTAINER_WORKSPACE_DIR: &str = "/home/deck/workspace";
const CONTAINER_DECK_STATE_DIR: &str = "/home/deck/.deck";
const CONTAINER_OPENCODE_SHARE_DIR: &str = "/home/deck/.local/share/opencode";
const CONTAINER_OPENCODE_STATE_DIR: &str = "/home/deck/.local/state/opencode";

pub(super) const REQUIRED_MOUNT_DESTINATIONS: [&str; 4] = [
    CONTAINER_WORKSPACE_DIR,
    CONTAINER_DECK_STATE_DIR,
    CONTAINER_OPENCODE_SHARE_DIR,
    CONTAINER_OPENCODE_STATE_DIR,
];

#[derive(Debug, Clone)]
pub(super) struct SandboxMountPaths {
    workspace_host: PathBuf,
    deck_state_host: PathBuf,
    opencode_share_host: PathBuf,
    opencode_state_host: PathBuf,
}

impl SandboxMountPaths {
    pub(super) fn from_root(root: &Path) -> Self {
        Self {
            workspace_host: root.join("workspace"),
            deck_state_host: root.join("deck-state"),
            opencode_share_host: root.join("opencode-share"),
            opencode_state_host: root.join("opencode-state"),
        }
    }

    pub(super) fn ensure_dirs(&self) -> Result<(), String> {
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

    pub(super) fn mount_specs(&self) -> Vec<String> {
        vec![
            mount_spec(&self.workspace_host, CONTAINER_WORKSPACE_DIR),
            mount_spec(&self.deck_state_host, CONTAINER_DECK_STATE_DIR),
            mount_spec(&self.opencode_share_host, CONTAINER_OPENCODE_SHARE_DIR),
            mount_spec(&self.opencode_state_host, CONTAINER_OPENCODE_STATE_DIR),
        ]
    }
}

fn mount_spec(source: &Path, target: &str) -> String {
    format!("type=bind,source={},target={target}", source.display())
}
