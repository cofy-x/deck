use std::fs;
use std::path::{Path, PathBuf};

use log::warn;

use crate::sandbox::config::{SandboxConfig, SandboxStorageInfo, DEFAULT_CONTAINER_NAME};

use super::paths::DEFAULT_STORAGE_ROOT_RELATIVE;
use super::probe::{container_exists_checked, container_has_required_mounts};

pub fn resolve_storage_root(app_data_dir: &Path, config: &SandboxConfig) -> PathBuf {
    let persistence = config.persistence();
    if let Some(root) = persistence.root.as_deref() {
        let trimmed = root.trim();
        if !trimmed.is_empty() {
            let candidate = PathBuf::from(trimmed);
            if candidate.is_absolute() {
                return candidate;
            }
            return app_data_dir.join(candidate);
        }
    }
    app_data_dir.join(DEFAULT_STORAGE_ROOT_RELATIVE)
}

fn parse_storage_root(root: &Path) -> String {
    root.display().to_string()
}

fn dir_size_bytes(path: &Path) -> u64 {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return 0,
    };

    let mut total = 0u64;
    for entry in entries.flatten() {
        let entry_path = entry.path();
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.is_dir() {
            total = total.saturating_add(dir_size_bytes(&entry_path));
        } else if metadata.is_file() {
            total = total.saturating_add(metadata.len());
        }
    }
    total
}

pub fn sandbox_storage_info(name: Option<&str>, root_dir: &Path) -> SandboxStorageInfo {
    let container_name = name.unwrap_or(DEFAULT_CONTAINER_NAME);
    let exists = root_dir.exists();
    let size_bytes = if exists { dir_size_bytes(root_dir) } else { 0 };

    let available = exists || fs::create_dir_all(root_dir).is_ok();
    let has_container = match container_exists_checked(container_name) {
        Ok(value) => value,
        Err(error) => {
            warn!(
                "[deck-docker] Failed to probe container existence for '{}': {}",
                container_name, error
            );
            false
        }
    };
    let legacy_container_detected = if has_container {
        match container_has_required_mounts(container_name) {
            Ok(has_required_mounts) => !has_required_mounts,
            Err(error) => {
                warn!(
                    "[deck-docker] Failed to inspect container mounts for '{}': {}",
                    container_name, error
                );
                true
            }
        }
    } else {
        false
    };

    SandboxStorageInfo {
        root_dir: parse_storage_root(root_dir),
        exists,
        size_bytes,
        available,
        legacy_container_detected,
    }
}
