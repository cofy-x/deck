package main

import (
	"os"

	"github.com/cofy-x/deck/packages/computer-use/api"
	"github.com/cofy-x/deck/packages/computer-use/internal/provider"

	"github.com/hashicorp/go-hclog"
	hc_plugin "github.com/hashicorp/go-plugin"
)

func main() {
	logger := hclog.New(&hclog.LoggerOptions{
		Level:      hclog.Trace,
		Output:     os.Stderr,
		JSONFormat: true,
	})
	hc_plugin.Serve(&hc_plugin.ServeConfig{
		HandshakeConfig: api.ComputerUseHandshakeConfig,
		Plugins: map[string]hc_plugin.Plugin{
			"deck-computer-use": &api.ComputerUsePlugin{Impl: &provider.ComputerUse{}},
		},
		Logger: logger,
	})
}
