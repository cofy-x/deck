use serde::{Deserialize, Serialize};
use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::process::{Command, Stdio};
use tauri::Manager;

const LOCAL_HOST_ALIAS: &str = "deck-local";
const LOCAL_HOSTNAME: &str = "127.0.0.1";
const LOCAL_SSH_PORT: u16 = 22220;
const LOCAL_SSH_USER: &str = "deck";
const SSH_INCLUDE_FILE_NAME: &str = "deck_hosts";
const SSH_INCLUDE_LINE: &str = "Include ~/.ssh/deck_hosts";

#[cfg(target_os = "windows")]
const VSCODE_CANDIDATES: &[&str] = &["code.cmd", "code"];
#[cfg(not(target_os = "windows"))]
const VSCODE_CANDIDATES: &[&str] = &["code"];

#[cfg(target_os = "windows")]
const CURSOR_CANDIDATES: &[&str] = &["cursor.cmd", "cursor"];
#[cfg(not(target_os = "windows"))]
const CURSOR_CANDIDATES: &[&str] = &["cursor"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExternalEditor {
    Vscode,
    Cursor,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProjectInEditorInput {
    pub editor: ExternalEditor,
    pub directory: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProjectInEditorResult {
    pub editor: String,
    pub editor_label: String,
    pub host_alias: String,
    pub command: String,
}

pub fn open_project_in_editor(
    app: &tauri::AppHandle,
    input: OpenProjectInEditorInput,
) -> Result<OpenProjectInEditorResult, String> {
    let directory = sanitize_directory(&input.directory)?;
    ensure_local_ssh_profile(app)?;
    reset_local_known_host();

    let command = launch_editor(&input.editor, LOCAL_HOST_ALIAS, &directory)?;

    Ok(OpenProjectInEditorResult {
        editor: editor_key(&input.editor).to_string(),
        editor_label: editor_label(&input.editor).to_string(),
        host_alias: LOCAL_HOST_ALIAS.to_string(),
        command,
    })
}

fn sanitize_directory(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Project directory is required".to_string());
    }
    if !trimmed.starts_with('/') {
        return Err("Project directory must be an absolute Unix path".to_string());
    }
    if trimmed.contains('\n') || trimmed.contains('\r') {
        return Err("Project directory contains invalid characters".to_string());
    }
    Ok(trimmed.to_string())
}

fn ensure_local_ssh_profile(app: &tauri::AppHandle) -> Result<(), String> {
    let home_dir = app
        .path()
        .home_dir()
        .map_err(|error| format!("Failed to resolve home directory: {error}"))?;
    let ssh_dir = home_dir.join(".ssh");
    ensure_dir_with_permissions(&ssh_dir, 0o700)?;

    let managed_path = ssh_dir.join(SSH_INCLUDE_FILE_NAME);
    write_managed_host_file(&managed_path)?;
    ensure_include_in_main_config(&ssh_dir)?;
    Ok(())
}

fn ensure_dir_with_permissions(path: &Path, mode: u32) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Failed to create directory '{}': {error}", path.display()))?;
    set_unix_permissions(path, mode)?;
    Ok(())
}

fn write_managed_host_file(path: &Path) -> Result<(), String> {
    let content = build_managed_host_content();
    let existing = fs::read_to_string(path).unwrap_or_default();
    if existing != content {
        fs::write(path, content)
            .map_err(|error| format!("Failed to write SSH host file '{}': {error}", path.display()))?;
    }
    set_unix_permissions(path, 0o600)?;
    Ok(())
}

fn ensure_include_in_main_config(ssh_dir: &Path) -> Result<(), String> {
    let config_path = ssh_dir.join("config");
    let content = match fs::read_to_string(&config_path) {
        Ok(value) => value,
        Err(error) if error.kind() == ErrorKind::NotFound => String::new(),
        Err(error) => {
            return Err(format!(
                "Failed to read SSH config '{}': {error}",
                config_path.display()
            ));
        }
    };

    // Keep Deck include at top-level and before any Host/Match blocks.
    // Remove stale occurrences first (they may have been appended inside a Host block).
    let mut cleaned_lines = Vec::new();
    for line in content.lines() {
        if has_managed_include(line) {
            continue;
        }
        cleaned_lines.push(line);
    }

    let mut next_content = String::new();
    next_content.push_str(SSH_INCLUDE_LINE);
    next_content.push('\n');

    if !cleaned_lines.is_empty() {
        next_content.push('\n');
        next_content.push_str(&cleaned_lines.join("\n"));
        next_content.push('\n');
    }

    if next_content != content {
        fs::write(&config_path, next_content).map_err(|error| {
            format!(
                "Failed to update SSH config '{}': {error}",
                config_path.display()
            )
        })?;
    }

    set_unix_permissions(&config_path, 0o600)?;
    Ok(())
}

fn has_managed_include(line: &str) -> bool {
    let without_comment = line.split('#').next().unwrap_or("").trim();
    if without_comment.is_empty() {
        return false;
    }
    let mut parts = without_comment.split_whitespace();
    let Some(keyword) = parts.next() else {
        return false;
    };
    if !keyword.eq_ignore_ascii_case("Include") {
        return false;
    }
    let Some(path) = parts.next() else {
        return false;
    };
    if parts.next().is_some() {
        return false;
    }
    path == format!("~/.ssh/{SSH_INCLUDE_FILE_NAME}")
}

fn build_managed_host_content() -> String {
    format!(
        "# Managed by Deck. Manual edits may be overwritten.\n\
Host {alias}\n\
  HostName {hostname}\n\
  Port {port}\n\
  User {user}\n\
  ServerAliveInterval 30\n\
  ServerAliveCountMax 6\n\
  StrictHostKeyChecking accept-new\n",
        alias = LOCAL_HOST_ALIAS,
        hostname = LOCAL_HOSTNAME,
        port = LOCAL_SSH_PORT,
        user = LOCAL_SSH_USER,
    )
}

fn reset_local_known_host() {
    let target = format!("[{}]:{}", LOCAL_HOSTNAME, LOCAL_SSH_PORT);
    let _ = Command::new("ssh-keygen")
        .args(["-R", target.as_str()])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

fn launch_editor(editor: &ExternalEditor, host_alias: &str, directory: &str) -> Result<String, String> {
    let remote = format!("ssh-remote+{host_alias}");
    let candidates = match editor {
        ExternalEditor::Vscode => VSCODE_CANDIDATES,
        ExternalEditor::Cursor => CURSOR_CANDIDATES,
    };

    for candidate in candidates {
        let spawn_result = Command::new(candidate)
            .arg("--remote")
            .arg(&remote)
            .arg(directory)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();

        match spawn_result {
            Ok(_) => return Ok((*candidate).to_string()),
            Err(error) if error.kind() == ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(format!(
                    "Failed to launch {} using '{}': {}",
                    editor_label(editor),
                    candidate,
                    error
                ));
            }
        }
    }

    Err(format!(
        "{} command is not available in PATH. Please install the command-line launcher first.",
        editor_label(editor)
    ))
}

fn editor_key(editor: &ExternalEditor) -> &'static str {
    match editor {
        ExternalEditor::Vscode => "vscode",
        ExternalEditor::Cursor => "cursor",
    }
}

fn editor_label(editor: &ExternalEditor) -> &'static str {
    match editor {
        ExternalEditor::Vscode => "VSCode",
        ExternalEditor::Cursor => "Cursor",
    }
}

#[cfg(unix)]
fn set_unix_permissions(path: &Path, mode: u32) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(mode)).map_err(|error| {
        format!(
            "Failed to set permissions for '{}': {error}",
            path.display()
        )
    })
}

#[cfg(not(unix))]
fn set_unix_permissions(_path: &Path, _mode: u32) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn ensure_include_moves_to_top_and_deduplicates() {
        let temp = tempdir().expect("temp dir");
        let ssh_dir = temp.path().join(".ssh");
        fs::create_dir_all(&ssh_dir).expect("create ssh dir");

        let config_path = ssh_dir.join("config");
        fs::write(
            &config_path,
            "Host example\n  HostName 1.2.3.4\nInclude ~/.ssh/deck_hosts\n",
        )
        .expect("seed config");

        ensure_include_in_main_config(&ssh_dir).expect("update config");
        let content = fs::read_to_string(&config_path).expect("read config");

        assert!(content.starts_with("Include ~/.ssh/deck_hosts\n"));
        assert_eq!(
            content
                .lines()
                .filter(|line| has_managed_include(line))
                .count(),
            1
        );
        assert!(content.contains("Host example"));
        assert!(content.contains("HostName 1.2.3.4"));
    }

    #[test]
    fn ensure_include_creates_config_when_missing() {
        let temp = tempdir().expect("temp dir");
        let ssh_dir = temp.path().join(".ssh");
        fs::create_dir_all(&ssh_dir).expect("create ssh dir");

        ensure_include_in_main_config(&ssh_dir).expect("create config");
        let content = fs::read_to_string(ssh_dir.join("config")).expect("read config");

        assert_eq!(content, "Include ~/.ssh/deck_hosts\n");
    }

    #[test]
    fn ensure_include_does_not_remove_custom_include_with_similar_name() {
        let temp = tempdir().expect("temp dir");
        let ssh_dir = temp.path().join(".ssh");
        fs::create_dir_all(&ssh_dir).expect("create ssh dir");

        let config_path = ssh_dir.join("config");
        fs::write(
            &config_path,
            "Include ~/.ssh/deck_hosts_custom\nHost example\n  HostName 1.2.3.4\n",
        )
        .expect("seed config");

        ensure_include_in_main_config(&ssh_dir).expect("update config");
        let content = fs::read_to_string(&config_path).expect("read config");

        assert!(content.starts_with("Include ~/.ssh/deck_hosts\n"));
        assert!(content.contains("Include ~/.ssh/deck_hosts_custom"));
    }
}
