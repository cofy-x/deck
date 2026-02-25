use std::env;
use std::fs;
use std::path::PathBuf;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn main() {
    ensure_opencode_sidecar();
    ensure_pilot_server_sidecar();
    ensure_pilot_bridge_sidecar();
    ensure_pilot_host_sidecar();
    tauri_build::build();
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

fn target_triple() -> String {
    env::var("CARGO_CFG_TARGET_TRIPLE")
        .or_else(|_| env::var("TARGET"))
        .or_else(|_| env::var("TAURI_ENV_TARGET_TRIPLE"))
        .unwrap_or_default()
}

fn sidecar_dir() -> PathBuf {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    manifest_dir.join("sidecars")
}

fn monorepo_root() -> PathBuf {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    manifest_dir
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .map(|p| p.to_path_buf())
        .unwrap_or(manifest_dir)
}

fn find_pilot_bin_in_monorepo(bin_name: &str) -> Option<PathBuf> {
    let root = monorepo_root();

    let candidate = root.join("node_modules").join(".bin").join(bin_name);
    if candidate.is_file() {
        return Some(candidate);
    }

    let candidate = root
        .join("apps")
        .join("client")
        .join("node_modules")
        .join(".bin")
        .join(bin_name);
    if candidate.is_file() {
        return Some(candidate);
    }

    None
}

fn copy_sidecar(source_path: &PathBuf, dest_path: &PathBuf) -> bool {
    let mut copied = fs::copy(source_path, dest_path).is_ok();

    #[cfg(unix)]
    if !copied {
        if std::os::unix::fs::symlink(source_path, dest_path).is_ok() {
            copied = true;
        }
    }

    #[cfg(windows)]
    if !copied {
        if fs::hard_link(source_path, dest_path).is_ok() {
            copied = true;
        }
    }

    if copied {
        #[cfg(unix)]
        {
            let _ = fs::set_permissions(dest_path, fs::Permissions::from_mode(0o755));
        }
    }

    copied
}

fn find_in_path(binary: &str) -> Option<PathBuf> {
    let paths = env::var_os("PATH")?;
    env::split_paths(&paths).find_map(|dir| {
        let candidate = dir.join(binary);
        if candidate.is_file() {
            Some(candidate)
        } else {
            None
        }
    })
}

fn create_debug_stub(dest_path: &PathBuf, sidecar_dir: &PathBuf, profile: &str, target: &str) {
    if profile == "release" || target.contains("windows") {
        return;
    }

    if fs::create_dir_all(sidecar_dir).is_err() {
        return;
    }

    let stub = "#!/usr/bin/env bash\n\
echo 'Sidecar missing. Install the binary or set the *_BIN_PATH env var.'\n\
exit 1\n";
    if fs::write(dest_path, stub).is_ok() {
        #[cfg(unix)]
        let _ = fs::set_permissions(dest_path, fs::Permissions::from_mode(0o755));
    }
}

fn ensure_sidecar(canonical_name: &str, env_var: &str, monorepo_bin_name: Option<&str>) {
    let target = target_triple();
    if target.is_empty() {
        return;
    }

    let sidecar_dir = sidecar_dir();

    let has_ext = target.contains("windows");
    let exe_ext = if has_ext { ".exe" } else { "" };

    let canonical = format!("{canonical_name}{exe_ext}");
    let target_name = format!("{canonical_name}-{target}{exe_ext}");

    let dest_path = sidecar_dir.join(&canonical);
    let target_dest_path = sidecar_dir.join(&target_name);

    let profile = env::var("PROFILE").unwrap_or_default();

    if dest_path.exists() && target_dest_path.exists() {
        return;
    }

    if dest_path.exists() && !target_dest_path.exists() {
        if copy_sidecar(&dest_path, &target_dest_path) {
            return;
        }
    }

    if target_dest_path.exists() && !dest_path.exists() {
        if copy_sidecar(&target_dest_path, &dest_path) {
            return;
        }
    }

    let source_path = env::var(env_var)
        .ok()
        .map(PathBuf::from)
        .filter(|path| path.is_file());

    let source_path =
        source_path.or_else(|| monorepo_bin_name.and_then(find_pilot_bin_in_monorepo));

    let path_name = if has_ext {
        format!("{canonical_name}.exe")
    } else {
        canonical_name.to_string()
    };
    let source_path = source_path.or_else(|| find_in_path(&path_name));

    let Some(source_path) = source_path else {
        println!(
            "cargo:warning={} sidecar missing at {} (set {} or install {})",
            canonical_name,
            dest_path.display(),
            env_var,
            canonical_name
        );
        create_debug_stub(&dest_path, &sidecar_dir, &profile, &target);
        create_debug_stub(&target_dest_path, &sidecar_dir, &profile, &target);
        return;
    };

    if fs::create_dir_all(&sidecar_dir).is_err() {
        return;
    }

    let copied = copy_sidecar(&source_path, &dest_path);
    if copied {
        #[cfg(unix)]
        {
            let _ = fs::set_permissions(&dest_path, fs::Permissions::from_mode(0o755));
        }
        let _ = copy_sidecar(&dest_path, &target_dest_path);
    } else {
        println!(
            "cargo:warning=Failed to copy {} sidecar from {} to {}",
            canonical_name,
            source_path.display(),
            dest_path.display()
        );
        create_debug_stub(&dest_path, &sidecar_dir, &profile, &target);
        create_debug_stub(&target_dest_path, &sidecar_dir, &profile, &target);
    }
}

fn ensure_opencode_sidecar() {
    ensure_sidecar("opencode", "OPENCODE_BIN_PATH", None);
}

fn ensure_pilot_server_sidecar() {
    ensure_sidecar(
        "pilot-server",
        "PILOT_SERVER_BIN_PATH",
        Some("pilot-server"),
    );
}

fn ensure_pilot_bridge_sidecar() {
    ensure_sidecar(
        "pilot-bridge",
        "PILOT_BRIDGE_BIN_PATH",
        Some("pilot-bridge"),
    );
}

fn ensure_pilot_host_sidecar() {
    ensure_sidecar("pilot-host", "PILOT_HOST_BIN_PATH", Some("pilot-host"));
}
