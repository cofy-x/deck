use log::{error, info};
use reqwest::Url;

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ApiLogEntry {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub status: Option<u16>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub error: Option<String>,
}

pub fn print_summary(entry: &ApiLogEntry) {
    if entry.error.is_some() {
        error!("{}", format_summary_line(entry));
        return;
    }
    info!("{}", format_summary_line(entry));
}

fn format_summary_line(entry: &ApiLogEntry) -> String {
    let url = normalize_url_for_log(&entry.url);
    let duration_ms = entry.duration_ms.unwrap_or(0);

    if let Some(error) = entry.error.as_deref() {
        return format!(
            "[deck-api] {} {} => ERROR ({}) [{}ms]",
            entry.method, url, error, duration_ms
        );
    }

    format!(
        "[deck-api] {} {} => {} [{}ms]",
        entry.method,
        url,
        entry.status.unwrap_or(0),
        duration_ms
    )
}

fn normalize_url_for_log(raw_url: &str) -> String {
    let parsed = match Url::parse(raw_url) {
        Ok(value) => value,
        Err(_) => return raw_url.to_string(),
    };

    let origin = parsed.origin().ascii_serialization();
    if origin == "null" {
        return raw_url.to_string();
    }

    format!("{origin}{}", parsed.path())
}

#[cfg(test)]
mod tests {
    use super::{format_summary_line, normalize_url_for_log, ApiLogEntry};

    #[test]
    fn normalize_url_for_log_strips_query_and_fragment() {
        let url = normalize_url_for_log("https://example.com/session/list?foo=bar#anchor");
        assert_eq!(url, "https://example.com/session/list");
    }

    #[test]
    fn normalize_url_for_log_keeps_origin_path_and_port() {
        let url = normalize_url_for_log("http://127.0.0.1:14096/agent?debug=1");
        assert_eq!(url, "http://127.0.0.1:14096/agent");
    }

    #[test]
    fn normalize_url_for_log_falls_back_for_non_absolute_urls() {
        let url = normalize_url_for_log("/session/messages?foo=bar");
        assert_eq!(url, "/session/messages?foo=bar");
    }

    #[test]
    fn format_summary_line_for_success_is_single_line_summary() {
        let entry = ApiLogEntry {
            method: "GET".to_string(),
            url: "https://example.com/project/current?directory=%2Ftmp".to_string(),
            status: Some(200),
            duration_ms: Some(42),
            error: None,
        };
        let line = format_summary_line(&entry);

        assert_eq!(
            line,
            "[deck-api] GET https://example.com/project/current => 200 [42ms]"
        );
        assert!(!line.contains("body"));
        assert!(!line.contains("resp"));
    }

    #[test]
    fn format_summary_line_for_error_is_single_line_summary() {
        let entry = ApiLogEntry {
            method: "POST".to_string(),
            url: "https://example.com/session?stream=true".to_string(),
            status: None,
            duration_ms: Some(12),
            error: Some("network timeout".to_string()),
        };
        let line = format_summary_line(&entry);

        assert_eq!(
            line,
            "[deck-api] POST https://example.com/session => ERROR (network timeout) [12ms]"
        );
        assert!(!line.contains("body"));
        assert!(!line.contains("resp"));
    }
}
