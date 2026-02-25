use std::process::Command;

use super::config::{DockerInfo, SandboxConfig, SandboxPorts, DEFAULT_CONTAINER_NAME};

fn parse_exact_container_id_from_ps_output(output: &str, expected_name: &str) -> Option<String> {
    output
        .lines()
        .filter_map(|line| {
            let (id, name) = line.split_once('\t')?;
            let id = id.trim();
            let name = name.trim();
            if id.is_empty() || name.is_empty() {
                return None;
            }
            if name == expected_name {
                return Some(id.to_string());
            }
            None
        })
        .next()
}

fn running_container_id_by_exact_name(name: &str) -> Option<String> {
    let output = Command::new("docker")
        .args(["ps", "--format", "{{.ID}}\t{{.Names}}"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_exact_container_id_from_ps_output(&stdout, name)
}

pub fn check_docker_available() -> DockerInfo {
    println!("[deck-docker] Checking Docker availability...");
    match Command::new("docker").arg("info").output() {
        Ok(output) => {
            if output.status.success() {
                println!("[deck-docker] Docker is available");
                DockerInfo {
                    available: true,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                eprintln!("[deck-docker] Docker not available: {}", stderr);
                DockerInfo {
                    available: false,
                    error: Some(stderr),
                }
            }
        }
        Err(e) => {
            eprintln!("[deck-docker] Docker binary not found: {}", e);
            DockerInfo {
                available: false,
                error: Some(format!("Docker not found: {}", e)),
            }
        }
    }
}

pub fn image_exists(image: &str) -> bool {
    match Command::new("docker")
        .args([
            "images",
            "--format",
            "{{.Repository}}:{{.Tag}}",
            "--filter",
            &format!("reference={}", image),
        ])
        .output()
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let exists = stdout.lines().any(|line| line.trim() == image);
            println!("[deck-docker] Image '{}' exists: {}", image, exists);
            exists
        }
        Err(e) => {
            eprintln!("[deck-docker] Failed to check image: {}", e);
            false
        }
    }
}

pub fn is_container_running(name: &str) -> bool {
    let running = running_container_id_by_exact_name(name).is_some();
    println!("[deck-docker] Container '{}' running: {}", name, running);
    running
}

pub fn get_container_status(name: Option<&str>) -> super::config::SandboxStatus {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    let container_id = running_container_id_by_exact_name(container_name);
    let running = container_id.is_some();

    super::config::SandboxStatus {
        running,
        container_name: if running {
            Some(container_name.to_string())
        } else {
            None
        },
        container_id,
        ports: SandboxPorts::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::parse_exact_container_id_from_ps_output;

    #[test]
    fn parse_exact_container_id_ignores_name_prefix_matches() {
        let output = "abc123\tdeck-desktop-sandbox-ai-remote\n";
        let result = parse_exact_container_id_from_ps_output(output, "deck-desktop-sandbox-ai");
        assert!(result.is_none());
    }

    #[test]
    fn parse_exact_container_id_returns_exact_name_match() {
        let output = "abc123\tdeck-desktop-sandbox-ai-remote\ndef456\tdeck-desktop-sandbox-ai\n";
        let result = parse_exact_container_id_from_ps_output(output, "deck-desktop-sandbox-ai");
        assert_eq!(result.as_deref(), Some("def456"));
    }
}

pub fn pull_image(image: &str) -> Result<String, String> {
    println!("[deck-docker] Pulling image: {}...", image);
    let output = Command::new("docker")
        .args(["pull", image])
        .output()
        .map_err(|e| {
            let msg = format!("Failed to execute docker pull: {}", e);
            eprintln!("[deck-docker] {}", msg);
            msg
        })?;

    if output.status.success() {
        let msg = format!("Successfully pulled {}", image);
        println!("[deck-docker] {}", msg);
        Ok(msg)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let msg = format!("Failed to pull {}: {}", image, stderr);
        eprintln!("[deck-docker] {}", msg);
        Err(msg)
    }
}

pub fn start_container(config: &SandboxConfig) -> Result<String, String> {
    let image = config.image();
    let name = config.container_name();
    let ports = SandboxPorts::default();

    println!(
        "[deck-docker] Starting sandbox container '{}' with image '{}'",
        name, image
    );

    if is_container_running(name) {
        println!("[deck-docker] Existing container found, stopping...");
        let _ = stop_container(Some(name));
    }

    println!(
        "[deck-docker] Removing any stopped container with name '{}'",
        name
    );
    let _ = Command::new("docker").args(["rm", "-f", name]).output();

    println!(
        "[deck-docker] Running docker run with ports: opencode={}, vnc={}, novnc={}, daemon={}, ssh={}, web_terminal={}",
        ports.opencode, ports.vnc, ports.novnc, ports.daemon, ports.ssh, ports.web_terminal
    );

    let output = Command::new("docker")
        .args([
            "run",
            "--platform",
            "linux/amd64",
            "--name",
            name,
            "-d",
            "-p",
            &format!("{}:{}", ports.opencode, ports.opencode),
            "-p",
            &format!("{}:{}", ports.vnc, ports.vnc),
            "-p",
            &format!("{}:{}", ports.novnc, ports.novnc),
            "-p",
            &format!("{}:{}", ports.daemon, ports.daemon),
            "-p",
            &format!("{}:{}", ports.ssh, ports.ssh),
            "-p",
            &format!("{}:{}", ports.web_terminal, ports.web_terminal),
            "-e",
            "DISPLAY=:1",
            "-e",
            &format!("VNC_PORT={}", ports.vnc),
            "-e",
            &format!("NO_VNC_PORT={}", ports.novnc),
            "-e",
            "VNC_RESOLUTION=1280x720",
            "-e",
            "VNC_USER=deck",
            "-e",
            "DECK_LOG_LEVEL=debug",
            image,
            "opencode",
            "serve",
            "--hostname",
            "0.0.0.0",
            "--port",
            &ports.opencode.to_string(),
            "--print-logs",
            "--log-level",
            "DEBUG",
        ])
        .output()
        .map_err(|e| {
            let msg = format!("Failed to start container: {}", e);
            eprintln!("[deck-docker] {}", msg);
            msg
        })?;

    if output.status.success() {
        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        println!(
            "[deck-docker] Container started successfully, ID: {}",
            container_id
        );
        Ok(container_id)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let msg = format!("Failed to start container: {}", stderr);
        eprintln!("[deck-docker] {}", msg);
        Err(msg)
    }
}

pub fn stop_container(name: Option<&str>) -> Result<String, String> {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    println!("[deck-docker] Stopping container '{}'...", container_name);

    let stop_output = Command::new("docker")
        .args(["stop", container_name])
        .output()
        .map_err(|e| {
            let msg = format!("Failed to stop container: {}", e);
            eprintln!("[deck-docker] {}", msg);
            msg
        })?;

    if !stop_output.status.success() {
        let stderr = String::from_utf8_lossy(&stop_output.stderr).to_string();
        let msg = format!("Failed to stop container: {}", stderr);
        eprintln!("[deck-docker] {}", msg);
        return Err(msg);
    }

    println!("[deck-docker] Container stopped, removing...");

    let rm_output = Command::new("docker")
        .args(["rm", container_name])
        .output()
        .map_err(|e| {
            let msg = format!("Failed to remove container: {}", e);
            eprintln!("[deck-docker] {}", msg);
            msg
        })?;

    if rm_output.status.success() {
        let msg = format!("Container {} stopped and removed", container_name);
        println!("[deck-docker] {}", msg);
        Ok(msg)
    } else {
        let msg = format!("Container {} stopped (removal warning)", container_name);
        println!("[deck-docker] {}", msg);
        Ok(msg)
    }
}
