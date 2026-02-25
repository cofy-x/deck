use std::{
    hash::{Hash, Hasher},
    net::Ipv4Addr,
};

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use reqwest::Url;
use tokio::net::TcpListener;

use super::{StartOpencodeWebBridgeInput, BRIDGE_PORT_RANGE, BRIDGE_PORT_START};

pub(super) fn validate_start_input(input: &StartOpencodeWebBridgeInput) -> Result<(), String> {
    if input.profile_id.trim().is_empty() {
        return Err("Profile ID is required".to_string());
    }
    if input.username.trim().is_empty() {
        return Err("OpenCode username is required".to_string());
    }
    if input.password.is_empty() {
        return Err("OpenCode password is required".to_string());
    }
    Ok(())
}

pub(super) fn parse_upstream_base_url(value: &str) -> Result<Url, String> {
    let parsed = Url::parse(value.trim())
        .map_err(|error| format!("Invalid upstream OpenCode URL: {error}"))?;
    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        _ => Err("Upstream OpenCode URL must use http or https".to_string()),
    }
}

pub(super) fn build_auth_header(username: &str, password: &str) -> String {
    let credentials = format!("{}:{}", username.trim(), password);
    let encoded = BASE64_STANDARD.encode(credentials.as_bytes());
    format!("Basic {encoded}")
}

pub(super) fn preferred_bridge_port(profile_id: &str) -> u16 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    profile_id.hash(&mut hasher);
    let offset = (hasher.finish() % u64::from(BRIDGE_PORT_RANGE)) as u16;
    BRIDGE_PORT_START + offset
}

pub(super) async fn bind_bridge_listener(profile_id: &str) -> Result<(TcpListener, u16), String> {
    let preferred_port = preferred_bridge_port(profile_id);
    let base_offset = preferred_port - BRIDGE_PORT_START;

    for index in 0..BRIDGE_PORT_RANGE {
        let offset = (base_offset + index) % BRIDGE_PORT_RANGE;
        let candidate_port = BRIDGE_PORT_START + offset;
        if let Ok(listener) = TcpListener::bind((Ipv4Addr::LOCALHOST, candidate_port)).await {
            return Ok((listener, candidate_port));
        }
    }

    let fallback = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(|error| format!("Failed to bind bridge listener: {error}"))?;
    let fallback_port = fallback
        .local_addr()
        .map_err(|error| format!("Failed to read bridge listener address: {error}"))?
        .port();
    Ok((fallback, fallback_port))
}

#[cfg(test)]
mod tests {
    use super::preferred_bridge_port;

    #[test]
    fn preferred_bridge_port_is_stable_for_profile() {
        let first = preferred_bridge_port("demo-profile");
        let second = preferred_bridge_port("demo-profile");
        assert_eq!(first, second);
        assert!((43100..43300).contains(&first));
    }
}
