use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::Manager;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredCredential {
    pub profile_id: String,
    pub provider_id: String,
    pub auth_type: String,
    pub auth_data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredCustomProvider {
    pub profile_id: String,
    pub provider_id: String,
    pub provider_name: String,
    pub provider_config: String,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

pub struct CredentialStore {
    conn: Mutex<Connection>,
}

impl CredentialStore {
    pub fn init(app_data_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("failed to create app data dir: {e}"))?;

        let db_path = app_data_dir.join("credentials.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("failed to open credentials db at {}: {e}", db_path.display()))?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS provider_credentials (
                profile_id  TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                auth_type   TEXT NOT NULL,
                auth_data   TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (profile_id, provider_id)
            );

            CREATE TABLE IF NOT EXISTS custom_providers (
                profile_id      TEXT NOT NULL,
                provider_id     TEXT NOT NULL,
                provider_name   TEXT NOT NULL,
                provider_config TEXT NOT NULL,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (profile_id, provider_id)
            );
            ",
        )
        .map_err(|e| format!("failed to initialise credential store schema: {e}"))?;

        println!(
            "[deck-credential-store] Initialised at {}",
            db_path.display()
        );
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    // -- internal helpers ---------------------------------------------------

    fn execute(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(sql, params)
            .map_err(|e| format!("query failed: {e}"))?;
        Ok(())
    }

    fn query_rows<T, F>(&self, sql: &str, profile_id: &str, map_row: F) -> Result<Vec<T>, String>
    where
        F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
    {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(sql)
            .map_err(|e| format!("prepare failed: {e}"))?;
        let rows = stmt
            .query_map(rusqlite::params![profile_id], map_row)
            .map_err(|e| format!("query failed: {e}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("row read failed: {e}"))
    }

    // -- credentials --------------------------------------------------------

    pub fn save_credential(&self, cred: &StoredCredential) -> Result<(), String> {
        self.execute(
            "INSERT INTO provider_credentials (profile_id, provider_id, auth_type, auth_data, updated_at)
             VALUES (?1, ?2, ?3, ?4, datetime('now'))
             ON CONFLICT (profile_id, provider_id) DO UPDATE SET
                auth_type  = excluded.auth_type,
                auth_data  = excluded.auth_data,
                updated_at = datetime('now')",
            &[
                &cred.profile_id as &dyn rusqlite::types::ToSql,
                &cred.provider_id,
                &cred.auth_type,
                &cred.auth_data,
            ],
        )
    }

    pub fn list_credentials(&self, profile_id: &str) -> Result<Vec<StoredCredential>, String> {
        self.query_rows(
            "SELECT profile_id, provider_id, auth_type, auth_data
             FROM provider_credentials WHERE profile_id = ?1",
            profile_id,
            |row| {
                Ok(StoredCredential {
                    profile_id: row.get(0)?,
                    provider_id: row.get(1)?,
                    auth_type: row.get(2)?,
                    auth_data: row.get(3)?,
                })
            },
        )
    }

    pub fn remove_credential(&self, profile_id: &str, provider_id: &str) -> Result<(), String> {
        self.execute(
            "DELETE FROM provider_credentials WHERE profile_id = ?1 AND provider_id = ?2",
            &[
                &profile_id as &dyn rusqlite::types::ToSql,
                &provider_id,
            ],
        )
    }

    // -- custom providers ---------------------------------------------------

    pub fn save_custom_provider(&self, provider: &StoredCustomProvider) -> Result<(), String> {
        self.execute(
            "INSERT INTO custom_providers (profile_id, provider_id, provider_name, provider_config, updated_at)
             VALUES (?1, ?2, ?3, ?4, datetime('now'))
             ON CONFLICT (profile_id, provider_id) DO UPDATE SET
                provider_name   = excluded.provider_name,
                provider_config = excluded.provider_config,
                updated_at      = datetime('now')",
            &[
                &provider.profile_id as &dyn rusqlite::types::ToSql,
                &provider.provider_id,
                &provider.provider_name,
                &provider.provider_config,
            ],
        )
    }

    pub fn list_custom_providers(
        &self,
        profile_id: &str,
    ) -> Result<Vec<StoredCustomProvider>, String> {
        self.query_rows(
            "SELECT profile_id, provider_id, provider_name, provider_config
             FROM custom_providers WHERE profile_id = ?1",
            profile_id,
            |row| {
                Ok(StoredCustomProvider {
                    profile_id: row.get(0)?,
                    provider_id: row.get(1)?,
                    provider_name: row.get(2)?,
                    provider_config: row.get(3)?,
                })
            },
        )
    }

    pub fn remove_custom_provider(
        &self,
        profile_id: &str,
        provider_id: &str,
    ) -> Result<(), String> {
        self.execute(
            "DELETE FROM custom_providers WHERE profile_id = ?1 AND provider_id = ?2",
            &[
                &profile_id as &dyn rusqlite::types::ToSql,
                &provider_id,
            ],
        )
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
//
// Input types use the same struct as the store types where possible.
// For remove operations a minimal input with only the key fields is used.
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveByProfileAndProviderInput {
    pub profile_id: String,
    pub provider_id: String,
}

#[tauri::command]
pub fn save_credential(
    state: tauri::State<'_, CredentialStore>,
    input: StoredCredential,
) -> Result<(), String> {
    state.save_credential(&input)
}

#[tauri::command]
pub fn list_credentials(
    state: tauri::State<'_, CredentialStore>,
    profile_id: String,
) -> Result<Vec<StoredCredential>, String> {
    state.list_credentials(&profile_id)
}

#[tauri::command]
pub fn remove_credential(
    state: tauri::State<'_, CredentialStore>,
    input: RemoveByProfileAndProviderInput,
) -> Result<(), String> {
    state.remove_credential(&input.profile_id, &input.provider_id)
}

#[tauri::command]
pub fn save_custom_provider(
    state: tauri::State<'_, CredentialStore>,
    input: StoredCustomProvider,
) -> Result<(), String> {
    state.save_custom_provider(&input)
}

#[tauri::command]
pub fn list_custom_providers(
    state: tauri::State<'_, CredentialStore>,
    profile_id: String,
) -> Result<Vec<StoredCustomProvider>, String> {
    state.list_custom_providers(&profile_id)
}

#[tauri::command]
pub fn remove_custom_provider(
    state: tauri::State<'_, CredentialStore>,
    input: RemoveByProfileAndProviderInput,
) -> Result<(), String> {
    state.remove_custom_provider(&input.profile_id, &input.provider_id)
}

// ---------------------------------------------------------------------------
// Initialisation helper
// ---------------------------------------------------------------------------

pub fn init_credential_store(app: &tauri::App) -> Result<CredentialStore, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;
    CredentialStore::init(data_dir)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_store() -> (CredentialStore, TempDir) {
        let dir = TempDir::new().expect("failed to create temp dir");
        let store = CredentialStore::init(dir.path().to_path_buf()).expect("init failed");
        (store, dir)
    }

    // -- credential CRUD ----------------------------------------------------

    #[test]
    fn save_and_list_credentials() {
        let (store, _dir) = create_test_store();
        let cred = StoredCredential {
            profile_id: "local".into(),
            provider_id: "openrouter".into(),
            auth_type: "api".into(),
            auth_data: r#"{"type":"api","key":"sk-test-123"}"#.into(),
        };
        store.save_credential(&cred).unwrap();

        let creds = store.list_credentials("local").unwrap();
        assert_eq!(creds.len(), 1);
        assert_eq!(creds[0].provider_id, "openrouter");
        assert_eq!(creds[0].auth_type, "api");
        assert_eq!(creds[0].auth_data, cred.auth_data);
    }

    #[test]
    fn save_credential_upserts_on_conflict() {
        let (store, _dir) = create_test_store();
        let cred1 = StoredCredential {
            profile_id: "local".into(),
            provider_id: "openrouter".into(),
            auth_type: "api".into(),
            auth_data: r#"{"type":"api","key":"old-key"}"#.into(),
        };
        store.save_credential(&cred1).unwrap();

        let cred2 = StoredCredential {
            auth_data: r#"{"type":"api","key":"new-key"}"#.into(),
            ..cred1
        };
        store.save_credential(&cred2).unwrap();

        let creds = store.list_credentials("local").unwrap();
        assert_eq!(creds.len(), 1);
        assert!(creds[0].auth_data.contains("new-key"));
    }

    #[test]
    fn remove_credential_deletes_matching_row() {
        let (store, _dir) = create_test_store();
        store
            .save_credential(&StoredCredential {
                profile_id: "local".into(),
                provider_id: "openrouter".into(),
                auth_type: "api".into(),
                auth_data: "{}".into(),
            })
            .unwrap();
        store
            .save_credential(&StoredCredential {
                profile_id: "local".into(),
                provider_id: "anthropic".into(),
                auth_type: "api".into(),
                auth_data: "{}".into(),
            })
            .unwrap();

        store.remove_credential("local", "openrouter").unwrap();
        let creds = store.list_credentials("local").unwrap();
        assert_eq!(creds.len(), 1);
        assert_eq!(creds[0].provider_id, "anthropic");
    }

    #[test]
    fn remove_nonexistent_credential_is_noop() {
        let (store, _dir) = create_test_store();
        let result = store.remove_credential("local", "nonexistent");
        assert!(result.is_ok());
    }

    #[test]
    fn list_credentials_scoped_by_profile() {
        let (store, _dir) = create_test_store();
        store
            .save_credential(&StoredCredential {
                profile_id: "local".into(),
                provider_id: "openrouter".into(),
                auth_type: "api".into(),
                auth_data: "{}".into(),
            })
            .unwrap();
        store
            .save_credential(&StoredCredential {
                profile_id: "remote-1".into(),
                provider_id: "anthropic".into(),
                auth_type: "api".into(),
                auth_data: "{}".into(),
            })
            .unwrap();

        assert_eq!(store.list_credentials("local").unwrap().len(), 1);
        assert_eq!(store.list_credentials("remote-1").unwrap().len(), 1);
        assert_eq!(store.list_credentials("unknown").unwrap().len(), 0);
    }

    // -- custom provider CRUD -----------------------------------------------

    #[test]
    fn save_and_list_custom_providers() {
        let (store, _dir) = create_test_store();
        let cp = StoredCustomProvider {
            profile_id: "local".into(),
            provider_id: "my-provider".into(),
            provider_name: "My Provider".into(),
            provider_config: r#"{"npm":"@ai-sdk/openai-compatible"}"#.into(),
        };
        store.save_custom_provider(&cp).unwrap();

        let providers = store.list_custom_providers("local").unwrap();
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].provider_id, "my-provider");
        assert_eq!(providers[0].provider_name, "My Provider");
    }

    #[test]
    fn save_custom_provider_upserts_on_conflict() {
        let (store, _dir) = create_test_store();
        let cp1 = StoredCustomProvider {
            profile_id: "local".into(),
            provider_id: "my-provider".into(),
            provider_name: "Old Name".into(),
            provider_config: "{}".into(),
        };
        store.save_custom_provider(&cp1).unwrap();

        let cp2 = StoredCustomProvider {
            provider_name: "New Name".into(),
            ..cp1
        };
        store.save_custom_provider(&cp2).unwrap();

        let providers = store.list_custom_providers("local").unwrap();
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].provider_name, "New Name");
    }

    #[test]
    fn remove_custom_provider_deletes_matching_row() {
        let (store, _dir) = create_test_store();
        store
            .save_custom_provider(&StoredCustomProvider {
                profile_id: "local".into(),
                provider_id: "p1".into(),
                provider_name: "P1".into(),
                provider_config: "{}".into(),
            })
            .unwrap();
        store
            .save_custom_provider(&StoredCustomProvider {
                profile_id: "local".into(),
                provider_id: "p2".into(),
                provider_name: "P2".into(),
                provider_config: "{}".into(),
            })
            .unwrap();

        store.remove_custom_provider("local", "p1").unwrap();
        let providers = store.list_custom_providers("local").unwrap();
        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].provider_id, "p2");
    }

    #[test]
    fn custom_providers_scoped_by_profile() {
        let (store, _dir) = create_test_store();
        store
            .save_custom_provider(&StoredCustomProvider {
                profile_id: "local".into(),
                provider_id: "p1".into(),
                provider_name: "P1".into(),
                provider_config: "{}".into(),
            })
            .unwrap();
        store
            .save_custom_provider(&StoredCustomProvider {
                profile_id: "remote-1".into(),
                provider_id: "p2".into(),
                provider_name: "P2".into(),
                provider_config: "{}".into(),
            })
            .unwrap();

        assert_eq!(store.list_custom_providers("local").unwrap().len(), 1);
        assert_eq!(store.list_custom_providers("remote-1").unwrap().len(), 1);
        assert_eq!(store.list_custom_providers("unknown").unwrap().len(), 0);
    }

    // -- cross-table independence -------------------------------------------

    #[test]
    fn credentials_and_custom_providers_are_independent() {
        let (store, _dir) = create_test_store();
        store
            .save_credential(&StoredCredential {
                profile_id: "local".into(),
                provider_id: "shared-id".into(),
                auth_type: "api".into(),
                auth_data: "{}".into(),
            })
            .unwrap();
        store
            .save_custom_provider(&StoredCustomProvider {
                profile_id: "local".into(),
                provider_id: "shared-id".into(),
                provider_name: "Shared".into(),
                provider_config: "{}".into(),
            })
            .unwrap();

        store.remove_credential("local", "shared-id").unwrap();
        assert_eq!(store.list_credentials("local").unwrap().len(), 0);
        assert_eq!(store.list_custom_providers("local").unwrap().len(), 1);
    }

    // -- init / schema ------------------------------------------------------

    #[test]
    fn init_creates_db_file() {
        let dir = TempDir::new().unwrap();
        let _store = CredentialStore::init(dir.path().to_path_buf()).unwrap();
        assert!(dir.path().join("credentials.db").exists());
    }

    #[test]
    fn init_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().to_path_buf();
        let store1 = CredentialStore::init(path.clone()).unwrap();
        store1
            .save_credential(&StoredCredential {
                profile_id: "local".into(),
                provider_id: "x".into(),
                auth_type: "api".into(),
                auth_data: "{}".into(),
            })
            .unwrap();
        drop(store1);

        let store2 = CredentialStore::init(path).unwrap();
        let creds = store2.list_credentials("local").unwrap();
        assert_eq!(creds.len(), 1);
    }
}
