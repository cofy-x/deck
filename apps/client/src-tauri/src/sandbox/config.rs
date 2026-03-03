use serde::{Deserialize, Serialize};

const DEFAULT_IMAGE: &str = "ghcr.io/cofy-x/deck/desktop-sandbox-ai:latest";
const CONTAINER_NAME: &str = "deck-desktop-sandbox-ai";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxPersistenceConfig {
    pub enabled: Option<bool>,
    pub root: Option<String>,
}

impl Default for SandboxPersistenceConfig {
    fn default() -> Self {
        Self {
            enabled: Some(true),
            root: None,
        }
    }
}

impl SandboxPersistenceConfig {
    pub fn enabled(&self) -> bool {
        self.enabled.unwrap_or(true)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    pub image: Option<String>,
    pub container_name: Option<String>,
    pub persistence: Option<SandboxPersistenceConfig>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            image: None,
            container_name: None,
            persistence: Some(SandboxPersistenceConfig::default()),
        }
    }
}

impl SandboxConfig {
    pub fn image(&self) -> &str {
        self.image.as_deref().unwrap_or(DEFAULT_IMAGE)
    }

    pub fn container_name(&self) -> &str {
        self.container_name.as_deref().unwrap_or(CONTAINER_NAME)
    }

    pub fn persistence(&self) -> SandboxPersistenceConfig {
        self.persistence.clone().unwrap_or_default()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxPorts {
    pub opencode: u16,
    pub vnc: u16,
    pub novnc: u16,
    pub daemon: u16,
    pub ssh: u16,
    pub web_terminal: u16,
}

impl Default for SandboxPorts {
    fn default() -> Self {
        Self {
            opencode: 4096,
            vnc: 5901,
            novnc: 6080,
            daemon: 2280,
            ssh: 22220,
            web_terminal: 22222,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxStatus {
    pub running: bool,
    pub container_name: Option<String>,
    pub container_id: Option<String>,
    pub ports: SandboxPorts,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxStartResult {
    pub container_id: String,
    pub created_fresh: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerInfo {
    pub available: bool,
    pub error: Option<String>,
    pub resolved_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxStorageInfo {
    pub root_dir: String,
    pub exists: bool,
    pub size_bytes: u64,
    pub available: bool,
    pub legacy_container_detected: bool,
}

pub const DEFAULT_CONTAINER_NAME: &str = CONTAINER_NAME;
