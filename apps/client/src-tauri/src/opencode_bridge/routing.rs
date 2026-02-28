use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use log::warn;
use reqwest::Url;

use super::BRIDGE_IFRAME_PATH;

pub(super) fn normalize_optional_directory(value: Option<String>) -> Option<String> {
    value
        .map(|raw| raw.trim().to_string())
        .filter(|raw| !raw.is_empty())
}

pub(super) fn build_iframe_entry_path(directory: Option<&str>) -> String {
    let Some(directory) = directory else {
        return BRIDGE_IFRAME_PATH.to_string();
    };
    let encoded_directory = encode_directory_route_segment(directory);
    format!("{BRIDGE_IFRAME_PATH}/{encoded_directory}/session")
}

fn encode_directory_route_segment(directory: &str) -> String {
    URL_SAFE_NO_PAD.encode(directory.as_bytes())
}

pub(super) fn encode_directory_header(directory: &str) -> String {
    if directory.is_ascii() {
        return directory.to_string();
    }
    percent_encode_uri_component(directory.as_bytes())
}

fn percent_encode_uri_component(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut output = String::with_capacity(bytes.len() * 3);
    for &byte in bytes {
        if is_unescaped_uri_component_byte(byte) {
            output.push(char::from(byte));
            continue;
        }

        output.push('%');
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0F) as usize]));
    }
    output
}

fn is_unescaped_uri_component_byte(byte: u8) -> bool {
    matches!(
        byte,
        b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')'
    )
}

fn map_bridge_path(path: &str) -> String {
    if path == BRIDGE_IFRAME_PATH {
        return "/".to_string();
    }

    if let Some(stripped) = path.strip_prefix(BRIDGE_IFRAME_PATH) {
        if stripped.starts_with('/') {
            return stripped.to_string();
        }
    }

    if path.is_empty() {
        "/".to_string()
    } else {
        path.to_string()
    }
}

fn merge_paths(base_path: &str, request_path: &str) -> String {
    let base = base_path.trim_end_matches('/');
    if base.is_empty() {
        return request_path.to_string();
    }

    if request_path == "/" {
        return base.to_string();
    }

    format!("{base}/{}", request_path.trim_start_matches('/'))
}

fn split_target(target: &str) -> Result<(String, Option<String>), String> {
    if target.starts_with("http://") || target.starts_with("https://") {
        let parsed =
            Url::parse(target).map_err(|error| format!("Invalid absolute target URL: {error}"))?;
        let path = if parsed.path().is_empty() {
            "/".to_string()
        } else {
            parsed.path().to_string()
        };
        return Ok((path, parsed.query().map(ToString::to_string)));
    }

    let (path, query) = match target.split_once('?') {
        Some((path, query)) => (path, Some(query.to_string())),
        None => (target, None),
    };

    if path.is_empty() {
        Ok(("/".to_string(), query))
    } else if path.starts_with('/') {
        Ok((path.to_string(), query))
    } else {
        Ok((format!("/{path}"), query))
    }
}

pub(super) fn should_log_bridge_target(target: &str) -> bool {
    let Ok((path, _query)) = split_target(target) else {
        return false;
    };

    path == "/"
        || path == BRIDGE_IFRAME_PATH
        || path.starts_with("/path")
        || path.starts_with("/project/current")
        || path.starts_with("/session")
}

pub(super) fn build_upstream_url(
    upstream_base_url: &Url,
    target: &str,
    forced_directory: Option<&str>,
) -> Result<Url, String> {
    let (path, query) = split_target(target)?;
    let mapped_path = map_bridge_path(&path);
    let sanitized_query = sanitize_directory_query(&mapped_path, query, forced_directory);

    let mut upstream_url = upstream_base_url.clone();
    let merged_path = merge_paths(upstream_base_url.path(), &mapped_path);
    upstream_url.set_path(&merged_path);
    upstream_url.set_query(sanitized_query.as_deref());
    upstream_url.set_fragment(None);
    Ok(upstream_url)
}

fn sanitize_directory_query(
    path: &str,
    query: Option<String>,
    forced_directory: Option<&str>,
) -> Option<String> {
    let Some(raw_query) = query else {
        return None;
    };

    let mut url = match Url::parse("http://localhost/") {
        Ok(value) => value,
        Err(_) => return Some(raw_query),
    };
    url.set_query(Some(&raw_query));

    let mut changed = false;
    let mut pairs = Vec::<(String, String)>::new();
    let should_enforce_absolute_directory = path.starts_with("/session");
    for (key, value) in url.query_pairs() {
        let is_corrupted = value.chars().any(|ch| ch == '\u{FFFD}');
        let is_non_absolute = should_enforce_absolute_directory && !value.starts_with('/');
        if key == "directory" && (is_corrupted || is_non_absolute) {
            changed = true;
            if let Some(directory) = forced_directory {
                pairs.push((key.to_string(), directory.to_string()));
            }
            continue;
        } else {
            pairs.push((key.to_string(), value.to_string()));
        }
    }

    if !changed {
        return Some(raw_query);
    }

    if let Some(directory) = forced_directory {
        warn!(
            "[opencode-bridge] repaired corrupted query directory value with forced directory={}",
            directory
        );
    } else {
        warn!(
            "[opencode-bridge] dropped corrupted query directory value without forced directory"
        );
    }

    url.set_query(None);
    {
        let mut query_pairs = url.query_pairs_mut();
        for (key, value) in pairs {
            query_pairs.append_pair(&key, &value);
        }
    }
    url.query().map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use reqwest::Url;

    use super::{
        build_iframe_entry_path, build_upstream_url, encode_directory_header,
        encode_directory_route_segment, map_bridge_path, sanitize_directory_query,
    };

    #[test]
    fn map_bridge_path_strips_iframe_prefix() {
        assert_eq!(map_bridge_path("/opencode"), "/");
        assert_eq!(map_bridge_path("/opencode/"), "/");
        assert_eq!(map_bridge_path("/opencode/assets/app.js"), "/assets/app.js");
        assert_eq!(map_bridge_path("/api/health"), "/api/health");
    }

    #[test]
    fn build_upstream_url_keeps_base_path_prefix() {
        let base = Url::parse("https://example.com/opencode").expect("valid URL");
        let url = build_upstream_url(&base, "/assets/app.js?v=1", None).expect("should build URL");
        assert_eq!(
            url.as_str(),
            "https://example.com/opencode/assets/app.js?v=1"
        );
    }

    #[test]
    fn build_upstream_url_resolves_root_path() {
        let base = Url::parse("http://localhost:4096").expect("valid URL");
        let url = build_upstream_url(&base, "/", None).expect("should build URL");
        assert_eq!(url.as_str(), "http://localhost:4096/");
    }

    #[test]
    fn directory_header_encoding_keeps_ascii_unchanged() {
        let directory = "/home/deck/Templates";
        assert_eq!(encode_directory_header(directory), directory);
    }

    #[test]
    fn directory_header_encoding_matches_sdk_behavior_for_non_ascii() {
        assert_eq!(
            encode_directory_header("/tmp/模板"),
            "%2Ftmp%2F%E6%A8%A1%E6%9D%BF"
        );
    }

    #[test]
    fn sanitize_directory_query_replaces_corrupted_directory_value() {
        let result = sanitize_directory_query(
            "/session",
            Some("directory=%EF%BF%BD%EF%BF%BD%EF%BF%BDr%EF%BF%BD%5E&roots=true".to_string()),
            Some("/home/deck/Templates"),
        );
        assert_eq!(
            result.as_deref(),
            Some("directory=%2Fhome%2Fdeck%2FTemplates&roots=true")
        );
    }

    #[test]
    fn sanitize_directory_query_drops_corrupted_directory_without_forced_directory() {
        let result = sanitize_directory_query(
            "/session",
            Some("directory=%EF%BF%BD%EF%BF%BD%EF%BF%BDr%EF%BF%BD%5E&roots=true".to_string()),
            None,
        );
        assert_eq!(result.as_deref(), Some("roots=true"));
    }

    #[test]
    fn sanitize_directory_query_keeps_valid_directory_value() {
        let result = sanitize_directory_query(
            "/session",
            Some("directory=%2Ftmp%2Fdemo&roots=true".to_string()),
            Some("/home/deck/Templates"),
        );
        assert_eq!(
            result.as_deref(),
            Some("directory=%2Ftmp%2Fdemo&roots=true")
        );
    }

    #[test]
    fn sanitize_directory_query_replaces_non_absolute_session_directory_value() {
        let result = sanitize_directory_query(
            "/session",
            Some("directory=broken-value&roots=true".to_string()),
            Some("/home/deck/Templates"),
        );
        assert_eq!(
            result.as_deref(),
            Some("directory=%2Fhome%2Fdeck%2FTemplates&roots=true")
        );
    }

    #[test]
    fn sanitize_directory_query_drops_non_absolute_directory_without_forced_directory() {
        let result = sanitize_directory_query(
            "/session",
            Some("directory=broken-value&roots=true".to_string()),
            None,
        );
        assert_eq!(result.as_deref(), Some("roots=true"));
    }

    #[test]
    fn build_iframe_entry_path_uses_directory_route_when_forced_directory_exists() {
        let path = build_iframe_entry_path(Some("/home/deck/Templates"));
        assert_eq!(path, "/opencode/L2hvbWUvZGVjay9UZW1wbGF0ZXM/session");
    }

    #[test]
    fn build_iframe_entry_path_defaults_to_opencode_root_without_directory() {
        let path = build_iframe_entry_path(None);
        assert_eq!(path, "/opencode");
    }

    #[test]
    fn encode_directory_route_segment_matches_opencode_web_encoding_for_non_ascii() {
        let encoded = encode_directory_route_segment("/tmp/模板");
        assert_eq!(encoded, "L3RtcC_mqKHmnb8");
    }
}
