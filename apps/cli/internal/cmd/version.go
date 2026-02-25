package cmd

import (
	"fmt"

	"github.com/cofy-x/deck/apps/cli/internal"
	"github.com/spf13/cobra"
)

var VersionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version number",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("Deck CLI version", internal.Version)
		return nil
	},
}
