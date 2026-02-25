package fs

import (
	"github.com/spf13/cobra"
)

// FsCmd is the file system command group.
var FsCmd = &cobra.Command{
	Use:   "fs",
	Short: "File system operations",
	Long:  "Perform file system operations in the daemon environment",
}

func init() {
	FsCmd.AddCommand(LsCmd)
	FsCmd.AddCommand(InfoCmd)
	FsCmd.AddCommand(MkdirCmd)
	FsCmd.AddCommand(CatCmd)
	FsCmd.AddCommand(WriteCmd)
	FsCmd.AddCommand(MvCmd)
	FsCmd.AddCommand(RmCmd)
	FsCmd.AddCommand(SearchCmd)
	FsCmd.AddCommand(GrepCmd)
	FsCmd.AddCommand(ReplaceCmd)
}
