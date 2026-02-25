package config

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/go-playground/validator/v10"
	"github.com/kelseyhightower/envconfig"

	"github.com/cofy-x/deck/packages/core-go/pkg/log"
)

type Config struct {
	DaemonLogFilePath            string `envconfig:"DECK_DAEMON_LOG_FILE_PATH"`
	EntrypointLogFilePath        string `envconfig:"DECK_ENTRYPOINT_LOG_FILE_PATH"`
	EntrypointShutdownTimeoutSec int    `envconfig:"ENTRYPOINT_SHUTDOWN_TIMEOUT_SEC"`
	SigtermShutdownTimeoutSec    int    `envconfig:"SIGTERM_SHUTDOWN_TIMEOUT_SEC"`
	UserHomeAsWorkDir            bool   `envconfig:"DECK_USER_HOME_AS_WORKDIR"`
}

func defaultLogDir() string {
	if runtime.GOOS == "darwin" {
		homeDir, err := os.UserHomeDir()
		if err == nil && homeDir != "" {
			return filepath.Join(homeDir, "Library", "Logs", "deck")
		}
	}

	if runtime.GOOS == "linux" {
		if stateHome := os.Getenv("XDG_STATE_HOME"); stateHome != "" {
			return filepath.Join(stateHome, "deck", "logs")
		}

		homeDir, err := os.UserHomeDir()
		if err == nil && homeDir != "" {
			return filepath.Join(homeDir, ".local", "state", "deck", "logs")
		}
	}

	cacheDir, err := os.UserCacheDir()
	if err == nil && cacheDir != "" {
		return filepath.Join(cacheDir, "deck", "logs")
	}

	return os.TempDir()
}

func defaultLogFilePath(fileName string) string {
	return filepath.Join(defaultLogDir(), fileName)
}

var defaultDaemonLogFilePath = defaultLogFilePath("deck-daemon.log")
var defaultEntrypointLogFilePath = defaultLogFilePath("deck-entrypoint.log")

var config *Config

func GetConfig() (*Config, error) {
	if config != nil {
		return config, nil
	}

	config = &Config{}

	err := envconfig.Process("", config)
	if err != nil {
		log.Errorf("Failed to process config: %v", err)
		os.Exit(2)
	}

	var validate = validator.New()
	err = validate.Struct(config)
	if err != nil {
		return nil, err
	}

	if config.DaemonLogFilePath == "" {
		config.DaemonLogFilePath = defaultDaemonLogFilePath
	}

	if config.EntrypointLogFilePath == "" {
		config.EntrypointLogFilePath = defaultEntrypointLogFilePath
	}

	if config.EntrypointShutdownTimeoutSec <= 0 {
		// Default to 10 seconds
		config.EntrypointShutdownTimeoutSec = 10
	}

	if config.SigtermShutdownTimeoutSec <= 0 {
		// Default to 5 seconds
		config.SigtermShutdownTimeoutSec = 5
	}

	return config, nil
}
