package computer

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	screenshotFormat  string
	screenshotQuality int32
	screenshotScale   float32
	showCursor        bool
	outputFile        string
)

// ScreenshotCmd takes a screenshot.
var ScreenshotCmd = &cobra.Command{
	Use:   "screenshot",
	Short: "Take a screenshot",
	Long: `Take a screenshot of the display.

Examples:
  deck computer screenshot -o screenshot.png
  deck computer screenshot --format=jpeg --quality=80 -o shot.jpg`,
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		if screenshotFormat != "png" && screenshotFormat != "jpeg" {
			return fmt.Errorf("format must be png or jpeg")
		}
		if screenshotQuality < 1 || screenshotQuality > 100 {
			return fmt.Errorf("quality must be between 1 and 100")
		}
		if screenshotScale <= 0 || screenshotScale > 1 {
			return fmt.Errorf("scale must be in range (0, 1]")
		}

		ctx := context.Background()
		req := client.Client.ComputerUseAPI.TakeCompressedScreenshot(ctx).
			Format(screenshotFormat).
			ShowCursor(showCursor)
		if screenshotQuality > 0 {
			req = req.Quality(screenshotQuality)
		}
		if screenshotScale > 0 {
			req = req.Scale(screenshotScale)
		}

		data, _, err := req.Execute()
		if err != nil {
			return err
		}

		// Save to file or output base64
		if outputFile != "" {
			// Decode base64 and save
			decoded, err := base64.StdEncoding.DecodeString(data.GetScreenshot())
			if err != nil {
				return fmt.Errorf("failed to decode image: %w", err)
			}

			if err := os.WriteFile(outputFile, decoded, 0644); err != nil {
				return fmt.Errorf("failed to write file: %w", err)
			}

			output.PrintSuccess(fmt.Sprintf("Screenshot saved to %s", outputFile))
			return nil
		}

		// Output base64 if no file specified
		return output.Print(data)
	},
}

func init() {
	ScreenshotCmd.Flags().StringVar(&screenshotFormat, "format", "png", "Image format (png, jpeg)")
	ScreenshotCmd.Flags().Int32Var(&screenshotQuality, "quality", 90, "JPEG quality (1-100)")
	ScreenshotCmd.Flags().Float32Var(&screenshotScale, "scale", 1.0, "Scale factor (0.1-1.0)")
	ScreenshotCmd.Flags().BoolVar(&showCursor, "show-cursor", false, "Show cursor in screenshot")
	ScreenshotCmd.Flags().StringVarP(&outputFile, "output", "o", "", "Output file path")
}
