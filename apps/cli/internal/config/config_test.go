package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetConfigPathUsesUserHomeDir(t *testing.T) {
	originalUserHomeDir := userHomeDir
	t.Cleanup(func() { userHomeDir = originalUserHomeDir })

	userHomeDir = func() (string, error) {
		return filepath.Join(string(filepath.Separator), "tmp", "deck-home"), nil
	}

	got := GetConfigPath()
	want := filepath.Join(string(filepath.Separator), "tmp", "deck-home", ".deck", "config.yaml")
	if got != want {
		t.Fatalf("GetConfigPath() = %q, want %q", got, want)
	}
}

func TestGetConfigPathReturnsEmptyWhenHomeUnavailable(t *testing.T) {
	originalUserHomeDir := userHomeDir
	t.Cleanup(func() { userHomeDir = originalUserHomeDir })

	userHomeDir = func() (string, error) {
		return "", os.ErrNotExist
	}

	if got := GetConfigPath(); got != "" {
		t.Fatalf("GetConfigPath() = %q, want empty string", got)
	}
}

func TestLoadNormalizesUnsupportedOutputFormat(t *testing.T) {
	tempHome := t.TempDir()
	configDir := filepath.Join(tempHome, ".deck")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	configPath := filepath.Join(configDir, "config.yaml")
	contents := []byte("output_format: table\n")
	if err := os.WriteFile(configPath, contents, 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	originalUserHomeDir := userHomeDir
	t.Cleanup(func() { userHomeDir = originalUserHomeDir })
	userHomeDir = func() (string, error) {
		return tempHome, nil
	}

	t.Setenv("DECK_OUTPUT_FORMAT", "")
	if err := Load(); err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if GlobalConfig.OutputFormat != "json" {
		t.Fatalf("GlobalConfig.OutputFormat = %q, want %q", GlobalConfig.OutputFormat, "json")
	}
}
