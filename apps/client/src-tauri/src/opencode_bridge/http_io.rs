use std::collections::HashSet;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Method, StatusCode};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::{DIRECTORY_HEADER_NAME, MAX_BODY_BYTES, MAX_HEADER_BYTES};

#[derive(Debug)]
pub(super) struct ParsedRequest {
    pub(super) method: String,
    pub(super) target: String,
    pub(super) headers: Vec<(String, String)>,
    pub(super) body: Vec<u8>,
}

pub(super) fn is_upgrade_request(headers: &[(String, String)]) -> bool {
    let has_upgrade = headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("upgrade"));
    let has_connection_upgrade = headers.iter().any(|(name, value)| {
        name.eq_ignore_ascii_case("connection")
            && value
                .split(',')
                .any(|part| part.trim().eq_ignore_ascii_case("upgrade"))
    });
    has_upgrade && has_connection_upgrade
}

pub(super) fn should_skip_upgrade_header(name: &str) -> bool {
    name.eq_ignore_ascii_case("host")
        || name.eq_ignore_ascii_case("authorization")
        || name.eq_ignore_ascii_case("proxy-authorization")
}

pub(super) fn build_upstream_headers(headers: &[(String, String)]) -> Result<HeaderMap, String> {
    let mut result = HeaderMap::new();
    let connection_tokens = collect_connection_tokens(headers);

    for (name, value) in headers {
        if should_skip_standard_header(name, &connection_tokens) {
            continue;
        }

        let header_name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|error| format!("Invalid header name `{name}`: {error}"))?;
        let header_value = HeaderValue::from_str(value)
            .map_err(|error| format!("Invalid header value for `{name}`: {error}"))?;
        result.append(header_name, header_value);
    }

    Ok(result)
}

pub(super) fn inject_directory_header(
    headers: &mut HeaderMap,
    directory_header: Option<&str>,
) -> Result<(), String> {
    let Some(directory_header) = directory_header else {
        return Ok(());
    };

    if headers.contains_key(DIRECTORY_HEADER_NAME) {
        return Ok(());
    }

    let header_value = HeaderValue::from_str(directory_header)
        .map_err(|error| format!("Invalid {DIRECTORY_HEADER_NAME} header value: {error}"))?;
    headers.insert(DIRECTORY_HEADER_NAME, header_value);
    Ok(())
}

fn should_skip_standard_header(name: &str, connection_tokens: &HashSet<String>) -> bool {
    let lower = name.to_ascii_lowercase();
    if lower == "host"
        || lower == "authorization"
        || lower == "content-length"
        || lower == "connection"
        || lower == "proxy-connection"
        || lower == "keep-alive"
        || lower == "proxy-authenticate"
        || lower == "proxy-authorization"
        || lower == "te"
        || lower == "trailer"
        || lower == "transfer-encoding"
        || lower == "upgrade"
    {
        return true;
    }

    connection_tokens.contains(&lower)
}

fn collect_connection_tokens(headers: &[(String, String)]) -> HashSet<String> {
    headers
        .iter()
        .filter(|(name, _)| name.eq_ignore_ascii_case("connection"))
        .flat_map(|(_, value)| value.split(','))
        .map(|part| part.trim().to_ascii_lowercase())
        .filter(|token| !token.is_empty())
        .collect()
}

pub(super) async fn write_reqwest_response(
    stream: &mut TcpStream,
    method: Method,
    mut response: reqwest::Response,
) -> Result<(), String> {
    let status = response.status();
    let status_line = format!(
        "HTTP/1.1 {} {}\r\n",
        status.as_u16(),
        status.canonical_reason().unwrap_or("Unknown")
    );
    stream
        .write_all(status_line.as_bytes())
        .await
        .map_err(|error| format!("Failed to write status line: {error}"))?;

    let has_body = response_has_body(&method, status);

    for (name, value) in response.headers() {
        if should_skip_response_header(name.as_str()) {
            continue;
        }
        let value_str = value
            .to_str()
            .map_err(|error| format!("Invalid response header value: {error}"))?;
        let line = format!("{}: {}\r\n", name.as_str(), value_str);
        stream
            .write_all(line.as_bytes())
            .await
            .map_err(|error| format!("Failed to write response header: {error}"))?;
    }

    if has_body {
        stream
            .write_all(b"Transfer-Encoding: chunked\r\nConnection: close\r\n\r\n")
            .await
            .map_err(|error| format!("Failed to write streaming headers: {error}"))?;

        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| format!("Failed to read upstream body: {error}"))?
        {
            if chunk.is_empty() {
                continue;
            }
            let size_line = format!("{:X}\r\n", chunk.len());
            stream
                .write_all(size_line.as_bytes())
                .await
                .map_err(|error| format!("Failed to write chunk size: {error}"))?;
            stream
                .write_all(&chunk)
                .await
                .map_err(|error| format!("Failed to write chunk data: {error}"))?;
            stream
                .write_all(b"\r\n")
                .await
                .map_err(|error| format!("Failed to write chunk separator: {error}"))?;
        }

        stream
            .write_all(b"0\r\n\r\n")
            .await
            .map_err(|error| format!("Failed to terminate chunked body: {error}"))?;
    } else {
        stream
            .write_all(b"Connection: close\r\n\r\n")
            .await
            .map_err(|error| format!("Failed to finalize headers: {error}"))?;
    }

    Ok(())
}

fn should_skip_response_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "connection"
            | "keep-alive"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailer"
            | "transfer-encoding"
            | "upgrade"
            | "content-length"
    )
}

fn response_has_body(method: &Method, status: StatusCode) -> bool {
    if method == Method::HEAD {
        return false;
    }

    !matches!(status.as_u16(), 100..=199 | 204 | 304)
}

pub(super) async fn read_request(stream: &mut TcpStream) -> Result<ParsedRequest, String> {
    let (head, mut buffered_body) = read_http_head(stream).await?;
    let head_text = std::str::from_utf8(&head)
        .map_err(|error| format!("Request headers are not valid UTF-8: {error}"))?;

    let mut lines = head_text.split("\r\n");
    let request_line = lines
        .next()
        .ok_or_else(|| "Missing HTTP request line".to_string())?;

    let mut request_parts = request_line.split_whitespace();
    let method = request_parts
        .next()
        .ok_or_else(|| "Missing HTTP method".to_string())?
        .to_string();
    let target = request_parts
        .next()
        .ok_or_else(|| "Missing HTTP request target".to_string())?
        .to_string();

    let mut headers = Vec::new();
    for line in lines {
        if line.is_empty() {
            continue;
        }

        let Some((name, value)) = line.split_once(':') else {
            return Err(format!("Malformed HTTP header line: {line}"));
        };
        headers.push((name.trim().to_string(), value.trim().to_string()));
    }

    if has_chunked_transfer_encoding(&headers) {
        return Err("Chunked request bodies are not supported".to_string());
    }

    let content_length = header_content_length(&headers)?;
    if content_length > MAX_BODY_BYTES {
        return Err("Request body exceeds bridge limit".to_string());
    }

    if buffered_body.len() > content_length {
        buffered_body.truncate(content_length);
    }

    if buffered_body.len() < content_length {
        let mut remaining = vec![0u8; content_length - buffered_body.len()];
        stream
            .read_exact(&mut remaining)
            .await
            .map_err(|error| format!("Failed to read request body: {error}"))?;
        buffered_body.extend_from_slice(&remaining);
    }

    Ok(ParsedRequest {
        method,
        target,
        headers,
        body: buffered_body,
    })
}

pub(super) async fn read_http_head<R>(stream: &mut R) -> Result<(Vec<u8>, Vec<u8>), String>
where
    R: AsyncRead + Unpin + ?Sized,
{
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];

    loop {
        let read = stream
            .read(&mut chunk)
            .await
            .map_err(|error| format!("Failed to read HTTP head: {error}"))?;

        if read == 0 {
            return Err("Unexpected EOF before HTTP headers were complete".to_string());
        }

        buffer.extend_from_slice(&chunk[..read]);

        if buffer.len() > MAX_HEADER_BYTES {
            return Err("HTTP headers exceed bridge limit".to_string());
        }

        if let Some(end) = find_header_end(&buffer) {
            let head = buffer[..end].to_vec();
            let body = buffer[end..].to_vec();
            return Ok((head, body));
        }
    }
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| index + 4)
}

fn header_content_length(headers: &[(String, String)]) -> Result<usize, String> {
    let Some(value) = headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        .map(|(_, value)| value)
    else {
        return Ok(0);
    };

    value
        .parse::<usize>()
        .map_err(|error| format!("Invalid content-length value: {error}"))
}

fn has_chunked_transfer_encoding(headers: &[(String, String)]) -> bool {
    headers.iter().any(|(name, value)| {
        name.eq_ignore_ascii_case("transfer-encoding")
            && value
                .split(',')
                .any(|part| part.trim().eq_ignore_ascii_case("chunked"))
    })
}

pub(super) fn parse_status_code(response_head: &[u8]) -> Option<u16> {
    let head_text = std::str::from_utf8(response_head).ok()?;
    let status_line = head_text.split("\r\n").next()?;
    let mut parts = status_line.split_whitespace();
    let _version = parts.next()?;
    parts.next()?.parse::<u16>().ok()
}

pub(super) async fn write_simple_error(
    stream: &mut TcpStream,
    status: u16,
    message: &str,
) -> Result<(), String> {
    let status_code =
        StatusCode::from_u16(status).map_err(|error| format!("Invalid status code: {error}"))?;
    let reason = status_code.canonical_reason().unwrap_or("Error");
    let body = message.as_bytes();

    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        status,
        reason,
        body.len()
    );

    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|error| format!("Failed to write error headers: {error}"))?;
    stream
        .write_all(body)
        .await
        .map_err(|error| format!("Failed to write error body: {error}"))?;

    Ok(())
}
