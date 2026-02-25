package client

import (
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
)

var (
	// Client is the global daemon client instance.
	Client *daemon.APIClient
	// DaemonURL is the daemon base URL.
	DaemonURL string
)

// InitClient initializes the global daemon client with the given URL.
func InitClient(url string) error {
	DaemonURL = url

	cfg := daemon.NewConfiguration()
	cfg.Servers[0].URL = DaemonURL
	Client = daemon.NewAPIClient(cfg)

	return nil
}
