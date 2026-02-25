package config

import (
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config holds the global configuration for the Deck CLI.
type Config struct {
	DaemonURL    string `yaml:"daemon_url"`
	OutputFormat string `yaml:"output_format"` // json, text
	NoColor      bool   `yaml:"no_color"`
}

// GlobalConfig is the global configuration instance.
var GlobalConfig *Config

var userHomeDir = os.UserHomeDir

// Load loads the configuration from file, environment variables, and defaults.
// Priority: environment variables > config file > defaults
func Load() error {
	// Initialize with defaults
	GlobalConfig = &Config{
		DaemonURL:    "http://localhost:2280",
		OutputFormat: "json",
		NoColor:      false,
	}

	// Load from config file if exists
	configPath, err := resolveConfigPath()
	if err != nil {
		return err
	}
	if data, err := os.ReadFile(configPath); err == nil {
		if err := yaml.Unmarshal(data, GlobalConfig); err != nil {
			return err
		}
	}

	// Environment variables override config file
	if url := os.Getenv("DECK_DAEMON_URL"); url != "" {
		GlobalConfig.DaemonURL = url
	}
	if format := os.Getenv("DECK_OUTPUT_FORMAT"); format != "" {
		GlobalConfig.OutputFormat = format
	}
	if noColor := os.Getenv("DECK_NO_COLOR"); noColor == "1" || strings.EqualFold(noColor, "true") {
		GlobalConfig.NoColor = true
	}

	GlobalConfig.OutputFormat = NormalizeOutputFormat(GlobalConfig.OutputFormat)

	return nil
}

// Save saves the current configuration to the config file.
func Save() error {
	configDir, err := resolveConfigDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return err
	}

	configPath := filepath.Join(configDir, "config.yaml")
	GlobalConfig.OutputFormat = NormalizeOutputFormat(GlobalConfig.OutputFormat)

	data, err := yaml.Marshal(GlobalConfig)
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// GetConfigPath returns the path to the config file.
func GetConfigPath() string {
	configPath, err := resolveConfigPath()
	if err != nil {
		return ""
	}
	return configPath
}

// IsValidOutputFormat reports whether output format is supported by the CLI.
func IsValidOutputFormat(format string) bool {
	return format == "json" || format == "text"
}

// NormalizeOutputFormat returns a supported format, falling back to json.
func NormalizeOutputFormat(format string) string {
	if IsValidOutputFormat(format) {
		return format
	}
	return "json"
}

func resolveConfigPath() (string, error) {
	configDir, err := resolveConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "config.yaml"), nil
}

func resolveConfigDir() (string, error) {
	homeDir, err := userHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".deck"), nil
}
