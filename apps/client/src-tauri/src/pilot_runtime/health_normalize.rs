use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

// ---------------------------------------------------------------------------
// Public bridge health types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotBridgeOpencodeHealth {
    pub url: String,
    pub healthy: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotBridgeChannelsHealth {
    pub telegram: bool,
    pub whatsapp: bool,
    pub slack: bool,
    pub feishu: bool,
    pub discord: bool,
    pub dingtalk: bool,
    pub email: bool,
    pub mochat: bool,
    pub qq: bool,
}

impl Default for PilotBridgeChannelsHealth {
    fn default() -> Self {
        Self {
            telegram: false,
            whatsapp: false,
            slack: false,
            feishu: false,
            discord: false,
            dingtalk: false,
            email: false,
            mochat: false,
            qq: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotBridgeConfigHealth {
    pub groups_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PilotBridgeHealthSnapshot {
    pub ok: bool,
    pub opencode: PilotBridgeOpencodeHealth,
    pub channels: PilotBridgeChannelsHealth,
    pub config: PilotBridgeConfigHealth,
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

fn as_object<'a>(value: &'a Value, context: &str) -> Result<&'a Map<String, Value>, String> {
    value
        .as_object()
        .ok_or_else(|| format!("{context} must be an object"))
}

fn read_required_bool(map: &Map<String, Value>, key: &str, context: &str) -> Result<bool, String> {
    map.get(key)
        .and_then(Value::as_bool)
        .ok_or_else(|| format!("{context}.{key} must be a boolean"))
}

fn read_optional_bool(
    map: &Map<String, Value>,
    key: &str,
    context: &str,
) -> Result<Option<bool>, String> {
    let Some(value) = map.get(key) else {
        return Ok(None);
    };
    value
        .as_bool()
        .map(Some)
        .ok_or_else(|| format!("{context}.{key} must be a boolean"))
}

fn read_required_string(
    map: &Map<String, Value>,
    key: &str,
    context: &str,
) -> Result<String, String> {
    map.get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| format!("{context}.{key} must be a string"))
}

fn read_optional_string(map: &Map<String, Value>, key: &str) -> Result<Option<String>, String> {
    let Some(value) = map.get(key) else {
        return Ok(None);
    };
    value
        .as_str()
        .map(|entry| Some(entry.to_string()))
        .ok_or_else(|| format!("opencode.{key} must be a string"))
}

pub fn normalize_bridge_health_snapshot(
    payload: Value,
) -> Result<PilotBridgeHealthSnapshot, String> {
    let root = as_object(&payload, "bridge health")?;
    let ok = read_required_bool(root, "ok", "bridge health")?;

    let opencode_map = as_object(
        root.get("opencode")
            .ok_or_else(|| "bridge health.opencode is required".to_string())?,
        "bridge health.opencode",
    )?;

    let opencode = PilotBridgeOpencodeHealth {
        url: read_required_string(opencode_map, "url", "opencode")?,
        healthy: read_required_bool(opencode_map, "healthy", "opencode")?,
        version: read_optional_string(opencode_map, "version")?,
    };

    let channels_map = as_object(
        root.get("channels")
            .ok_or_else(|| "bridge health.channels is required".to_string())?,
        "bridge health.channels",
    )?;

    let mut channels = PilotBridgeChannelsHealth::default();

    if let Some(value) = read_optional_bool(channels_map, "telegram", "channels")? {
        channels.telegram = value;
    }
    if let Some(value) = read_optional_bool(channels_map, "whatsapp", "channels")? {
        channels.whatsapp = value;
    }
    if let Some(value) = read_optional_bool(channels_map, "slack", "channels")? {
        channels.slack = value;
    }
    if let Some(value) = read_optional_bool(channels_map, "feishu", "channels")? {
        channels.feishu = value;
    }
    if let Some(value) = read_optional_bool(channels_map, "discord", "channels")? {
        channels.discord = value;
    }
    if let Some(value) = read_optional_bool(channels_map, "dingtalk", "channels")? {
        channels.dingtalk = value;
    }
    if let Some(value) = read_optional_bool(channels_map, "email", "channels")? {
        channels.email = value;
    }
    if let Some(value) = read_optional_bool(channels_map, "mochat", "channels")? {
        channels.mochat = value;
    }
    if let Some(value) = read_optional_bool(channels_map, "qq", "channels")? {
        channels.qq = value;
    }

    let groups_enabled = match root.get("config") {
        None => false,
        Some(value) => {
            let config_map = as_object(value, "bridge health.config")?;
            read_optional_bool(config_map, "groupsEnabled", "config")?.unwrap_or(false)
        }
    };

    Ok(PilotBridgeHealthSnapshot {
        ok,
        opencode,
        channels,
        config: PilotBridgeConfigHealth { groups_enabled },
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::normalize_bridge_health_snapshot;

    #[test]
    fn normalize_full_nine_channel_snapshot() {
        let payload = json!({
          "ok": true,
          "opencode": { "url": "http://127.0.0.1:4096", "healthy": true, "version": "1.2.3" },
          "channels": {
            "telegram": true,
            "whatsapp": true,
            "slack": false,
            "feishu": true,
            "discord": true,
            "dingtalk": false,
            "email": true,
            "mochat": false,
            "qq": true
          },
          "config": {
            "groupsEnabled": true
          }
        });

        let result = normalize_bridge_health_snapshot(payload).expect("snapshot should parse");
        assert!(result.channels.telegram);
        assert!(result.channels.feishu);
        assert!(result.channels.qq);
        assert!(result.config.groups_enabled);
    }

    #[test]
    fn normalize_legacy_three_channel_snapshot() {
        let payload = json!({
          "ok": true,
          "opencode": { "url": "http://127.0.0.1:4096", "healthy": true },
          "channels": {
            "telegram": true,
            "whatsapp": false,
            "slack": true
          }
        });

        let result =
            normalize_bridge_health_snapshot(payload).expect("legacy snapshot should parse");
        assert!(result.channels.telegram);
        assert!(result.channels.slack);
        assert!(!result.channels.discord);
        assert!(!result.channels.qq);
        assert!(!result.config.groups_enabled);
    }

    #[test]
    fn reject_invalid_channel_field_type() {
        let payload = json!({
          "ok": true,
          "opencode": { "url": "http://127.0.0.1:4096", "healthy": true },
          "channels": {
            "telegram": "yes",
            "whatsapp": true,
            "slack": true
          }
        });

        let error =
            normalize_bridge_health_snapshot(payload).expect_err("invalid payload should fail");
        assert!(error.contains("channels.telegram"));
    }
}
