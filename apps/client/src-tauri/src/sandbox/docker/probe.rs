use log::warn;
use serde::Deserialize;

use super::command::docker_cmd;
use super::paths::REQUIRED_MOUNT_DESTINATIONS;

#[derive(Debug, Deserialize)]
struct DockerInspectMount {
    #[serde(rename = "Destination")]
    destination: String,
}

fn parse_exact_container_id_from_ps_output(output: &str, expected_name: &str) -> Option<String> {
    output.lines().find_map(|line| {
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
}

fn container_id_by_exact_name(name: &str, all: bool) -> Result<Option<String>, String> {
    let mut command = docker_cmd();
    command.arg("ps");
    if all {
        command.arg("-a");
    }
    let output = command
        .args(["--format", "{{.ID}}\t{{.Names}}"])
        .output()
        .map_err(|error| format!("Failed to probe Docker containers: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("Docker container probe failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_exact_container_id_from_ps_output(&stdout, name))
}

pub(super) fn running_container_id_by_exact_name(name: &str) -> Option<String> {
    match container_id_by_exact_name(name, false) {
        Ok(container_id) => container_id,
        Err(error) => {
            warn!(
                "[deck-docker] Failed to probe running container '{}': {}",
                name, error
            );
            None
        }
    }
}

pub(super) fn running_container_id_by_exact_name_checked(
    name: &str,
) -> Result<Option<String>, String> {
    container_id_by_exact_name(name, false)
}

pub(super) fn container_exists_checked(name: &str) -> Result<bool, String> {
    Ok(container_id_by_exact_name(name, true)?.is_some())
}

pub(super) fn container_image_checked(name: &str) -> Result<Option<String>, String> {
    let output = docker_cmd()
        .args(["inspect", "--format", "{{.Config.Image}}", name])
        .output()
        .map_err(|error| format!("Failed to inspect container image: {error}"))?;

    if output.status.success() {
        let image = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if image.is_empty() {
            return Ok(None);
        }
        return Ok(Some(image));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stderr = stderr.trim();
    if stderr.contains("No such object") || stderr.contains("No such container") {
        return Ok(None);
    }

    Err(format!("Failed to inspect container image: {stderr}"))
}

pub(super) fn container_image_id_checked(name: &str) -> Result<Option<String>, String> {
    let output = docker_cmd()
        .args(["inspect", "--format", "{{.Image}}", name])
        .output()
        .map_err(|error| format!("Failed to inspect container image ID: {error}"))?;

    if output.status.success() {
        let image_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if image_id.is_empty() {
            return Ok(None);
        }
        return Ok(Some(image_id));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stderr = stderr.trim();
    if stderr.contains("No such object") || stderr.contains("No such container") {
        return Ok(None);
    }

    Err(format!("Failed to inspect container image ID: {stderr}"))
}

pub(super) fn image_id_checked(image: &str) -> Result<Option<String>, String> {
    let output = docker_cmd()
        .args(["image", "inspect", "--format", "{{.Id}}", image])
        .output()
        .map_err(|error| format!("Failed to inspect requested image ID: {error}"))?;

    if output.status.success() {
        let image_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if image_id.is_empty() {
            return Ok(None);
        }
        return Ok(Some(image_id));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stderr = stderr.trim();
    if stderr.contains("No such image") || stderr.contains("No such object") {
        return Ok(None);
    }

    Err(format!("Failed to inspect requested image ID: {stderr}"))
}

fn inspect_container_mount_destinations(name: &str) -> Result<Vec<String>, String> {
    let output = docker_cmd()
        .args(["inspect", "--format", "{{json .Mounts}}", name])
        .output()
        .map_err(|error| format!("Failed to inspect container mounts: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to inspect container mounts: {stderr}"));
    }

    let mounts: Vec<DockerInspectMount> = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Failed to parse container mount data: {error}"))?;
    Ok(mounts.into_iter().map(|mount| mount.destination).collect())
}

pub(super) fn container_has_required_mounts(name: &str) -> Result<bool, String> {
    let destinations = inspect_container_mount_destinations(name)?;
    Ok(REQUIRED_MOUNT_DESTINATIONS
        .iter()
        .all(|required| destinations.iter().any(|dest| dest == required)))
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
