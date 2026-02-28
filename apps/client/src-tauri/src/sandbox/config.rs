use serde::{Deserialize, Serialize};

const DEFAULT_IMAGE: &str = "ghcr.io/cofy-x/deck/desktop-sandbox-ai:latest";
const CONTAINER_NAME: &str = "deck-desktop-sandbox-ai";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    pub image: Option<String>,
    pub container_name: Option<String>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            image: None,
            container_name: None,
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
pub struct DockerInfo {
    pub available: bool,
    pub error: Option<String>,
    pub resolved_path: Option<String>,
}

pub const DEFAULT_CONTAINER_NAME: &str = CONTAINER_NAME;
