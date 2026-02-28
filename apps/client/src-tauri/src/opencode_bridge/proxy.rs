use std::sync::Arc;

use log::debug;
use reqwest::header::{HeaderValue, AUTHORIZATION};
use reqwest::{Method, StatusCode};
use serde_json::json;
use tauri::Emitter;
use tokio::io::{copy, copy_bidirectional, AsyncWriteExt};
use tokio::net::TcpStream;

use super::context::BridgeContext;
use super::http_io::{
    build_upstream_headers, inject_directory_header, is_upgrade_request, parse_status_code,
    read_http_head, read_request, should_skip_upgrade_header, write_reqwest_response,
    write_simple_error, ParsedRequest,
};
use super::routing::{build_upstream_url, should_log_bridge_target};
use super::{DIRECTORY_HEADER_NAME, EVENT_BRIDGE_AUTH_FAILURE, EVENT_BRIDGE_UPSTREAM_FAILURE};

pub(super) async fn handle_client_connection(
    context: Arc<BridgeContext>,
    mut stream: TcpStream,
) -> Result<(), String> {
    let request = match read_request(&mut stream).await {
        Ok(value) => value,
        Err(error) => {
            write_simple_error(&mut stream, 400, &error).await?;
            return Ok(());
        }
    };

    if is_upgrade_request(&request.headers) {
        handle_upgrade_request(context, stream, request).await
    } else {
        handle_http_request(context, &mut stream, request).await
    }
}

async fn handle_http_request(
    context: Arc<BridgeContext>,
    stream: &mut TcpStream,
    request: ParsedRequest,
) -> Result<(), String> {
    let method = Method::from_bytes(request.method.as_bytes())
        .map_err(|error| format!("Invalid HTTP method: {error}"))?;
    let upstream_url = build_upstream_url(
        &context.upstream_base_url,
        &request.target,
        context.forced_directory.as_deref(),
    )?;

    let mut headers = build_upstream_headers(&request.headers)?;
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&context.auth_header)
            .map_err(|error| format!("Invalid authorization header: {error}"))?,
    );
    inject_directory_header(&mut headers, context.directory_header.as_deref())?;

    let mut builder = context.client.request(method.clone(), upstream_url.clone());
    builder = builder.headers(headers);

    if should_log_bridge_target(&request.target) {
        debug!(
            "[opencode-bridge] request profile={} method={} target={} upstream={} directoryHeader={}",
            context.profile_id,
            method,
            request.target,
            upstream_url,
            context.directory_header.as_deref().unwrap_or("<none>")
        );
    }

    if !request.body.is_empty() {
        builder = builder.body(request.body);
    }

    let response = match builder.send().await {
        Ok(value) => value,
        Err(error) => {
            emit_upstream_failure(
                &context,
                "upstream-request-failed",
                format!("{} ({})", error, upstream_url),
            );
            write_simple_error(stream, 502, "Bridge request failed").await?;
            return Ok(());
        }
    };

    let status = response.status();
    if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
        emit_auth_failure(&context, status.as_u16());
    }

    write_reqwest_response(stream, method, response).await
}

async fn handle_upgrade_request(
    context: Arc<BridgeContext>,
    mut downstream: TcpStream,
    request: ParsedRequest,
) -> Result<(), String> {
    if context.upstream_base_url.scheme() == "https" {
        write_simple_error(
            &mut downstream,
            501,
            "WebSocket upgrades for https upstream are not supported yet",
        )
        .await?;
        emit_upstream_failure(
            &context,
            "upgrade-https-unsupported",
            "Upgrade request requires TLS tunnel support".to_string(),
        );
        return Ok(());
    }

    let upstream_url = build_upstream_url(
        &context.upstream_base_url,
        &request.target,
        context.forced_directory.as_deref(),
    )?;
    if should_log_bridge_target(&request.target) {
        debug!(
            "[opencode-bridge] upgrade profile={} method={} target={} upstream={} directoryHeader={}",
            context.profile_id,
            request.method,
            request.target,
            upstream_url,
            context.directory_header.as_deref().unwrap_or("<none>")
        );
    }
    let upstream_host = context
        .upstream_base_url
        .host_str()
        .ok_or_else(|| "Upstream URL is missing host".to_string())?
        .to_string();
    let upstream_port = context
        .upstream_base_url
        .port_or_known_default()
        .ok_or_else(|| "Upstream URL is missing port".to_string())?;

    let mut upstream = TcpStream::connect((upstream_host.as_str(), upstream_port))
        .await
        .map_err(|error| format!("Failed to connect upstream for upgrade: {error}"))?;

    let host_header = match context.upstream_base_url.port() {
        Some(port) => format!("{}:{port}", upstream_host),
        None => upstream_host.clone(),
    };

    let path_and_query = match upstream_url.query() {
        Some(query) => format!("{}?{}", upstream_url.path(), query),
        None => upstream_url.path().to_string(),
    };

    let mut outbound = Vec::new();
    outbound.extend_from_slice(
        format!("{} {} HTTP/1.1\r\n", request.method, path_and_query).as_bytes(),
    );
    outbound.extend_from_slice(format!("Host: {host_header}\r\n").as_bytes());
    outbound.extend_from_slice(format!("Authorization: {}\r\n", context.auth_header).as_bytes());

    let validated_directory_header = context
        .directory_header
        .as_deref()
        .map(|value| {
            HeaderValue::from_str(value)
                .map_err(|error| format!("Invalid {DIRECTORY_HEADER_NAME} header value: {error}"))
        })
        .transpose()?;

    let mut has_directory_header = false;
    for (name, value) in &request.headers {
        if should_skip_upgrade_header(name) {
            continue;
        }
        if name.eq_ignore_ascii_case(DIRECTORY_HEADER_NAME) {
            has_directory_header = true;
        }
        outbound.extend_from_slice(format!("{}: {}\r\n", name, value).as_bytes());
    }
    if !has_directory_header {
        if let Some(directory_header) = validated_directory_header {
            let directory_header = directory_header.to_str().map_err(|error| {
                format!("Invalid {DIRECTORY_HEADER_NAME} header value: {error}")
            })?;
            outbound.extend_from_slice(
                format!("{DIRECTORY_HEADER_NAME}: {directory_header}\r\n").as_bytes(),
            );
        }
    }
    outbound.extend_from_slice(b"\r\n");
    if !request.body.is_empty() {
        outbound.extend_from_slice(&request.body);
    }

    upstream
        .write_all(&outbound)
        .await
        .map_err(|error| format!("Failed to forward upgrade request: {error}"))?;

    let (response_head, mut buffered_payload) = read_http_head(&mut upstream).await?;

    let upgrade_status = parse_status_code(&response_head);
    if let Some(status) = upgrade_status {
        if status == 401 || status == 403 {
            emit_auth_failure(&context, status);
        }
    }

    downstream
        .write_all(&response_head)
        .await
        .map_err(|error| format!("Failed to write upgrade response head: {error}"))?;
    if !buffered_payload.is_empty() {
        downstream
            .write_all(&buffered_payload)
            .await
            .map_err(|error| format!("Failed to write buffered upgrade payload: {error}"))?;
        buffered_payload.clear();
    }

    if upgrade_status != Some(101) {
        copy(&mut upstream, &mut downstream)
            .await
            .map_err(|error| format!("Failed to stream non-upgrade response: {error}"))?;
        return Ok(());
    }

    copy_bidirectional(&mut downstream, &mut upstream)
        .await
        .map_err(|error| format!("Upgrade tunnel error: {error}"))?;

    Ok(())
}

pub(super) fn emit_upstream_failure(context: &BridgeContext, stage: &str, error: String) {
    let _ = context.app.emit(
        EVENT_BRIDGE_UPSTREAM_FAILURE,
        json!({
            "profileId": context.profile_id,
            "stage": stage,
            "error": error,
            "upstreamBaseUrl": context.upstream_base_url.as_str(),
        }),
    );
}

fn emit_auth_failure(context: &BridgeContext, status: u16) {
    let _ = context.app.emit(
        EVENT_BRIDGE_AUTH_FAILURE,
        json!({
            "profileId": context.profile_id,
            "status": status,
            "upstreamBaseUrl": context.upstream_base_url.as_str(),
        }),
    );
}
