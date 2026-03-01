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
        let metadata = match fs::symlink_metadata(&entry_path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let file_type = metadata.file_type();

        // Never follow symlinks while walking storage usage. This keeps the
        // traversal bounded to the configured storage root and avoids loops.
        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            total = total.saturating_add(dir_size_bytes(&entry_path));
        } else if file_type.is_file() {
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

#[cfg(test)]
mod tests {
    use super::dir_size_bytes;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after UNIX_EPOCH")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("deck-storage-{name}-{unique}"));
        fs::create_dir_all(&dir).expect("test dir should be created");
        dir
    }

    #[test]
    fn dir_size_bytes_counts_regular_files_recursively() {
        let root = test_dir("recursive");
        let nested = root.join("nested");
        fs::create_dir_all(&nested).expect("nested dir should be created");
        fs::write(root.join("a.bin"), vec![1u8; 3]).expect("root file should be written");
        fs::write(nested.join("b.bin"), vec![1u8; 7]).expect("nested file should be written");

        let size = dir_size_bytes(&root);
        assert_eq!(size, 10);

        fs::remove_dir_all(root).expect("test dir should be removed");
    }

    #[cfg(unix)]
    #[test]
    fn dir_size_bytes_skips_symlinked_directories() {
        use std::os::unix::fs::symlink;

        let root = test_dir("symlink");
        let real = root.join("real");
        fs::create_dir_all(&real).expect("real dir should be created");
        fs::write(real.join("keep.bin"), vec![1u8; 5]).expect("real file should be written");

        let outside = test_dir("outside");
        fs::write(outside.join("skip.bin"), vec![1u8; 11]).expect("outside file should be written");

        symlink(&outside, root.join("outside-link")).expect("symlink should be created");
        symlink(&root, root.join("loop-link")).expect("loop symlink should be created");

        let size = dir_size_bytes(&root);
        assert_eq!(size, 5);

        fs::remove_dir_all(root).expect("test dir should be removed");
        fs::remove_dir_all(outside).expect("outside dir should be removed");
    }
}
