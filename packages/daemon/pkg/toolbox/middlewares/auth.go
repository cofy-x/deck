package middlewares

import (
	"net/http"
	"os"

	common_consts "github.com/cofy-x/deck/packages/core-go/pkg/consts"
	"github.com/cofy-x/deck/packages/core-go/pkg/log"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates the daemon authentication token header against the environment variable
func AuthMiddleware() gin.HandlerFunc {
	// Read the expected token from environment variable at startup
	expectedToken := os.Getenv(common_consts.EnvDeckDaemonToken)

	if expectedToken == "" {
		log.Warnf("%s is not set! Authentication is DISABLED (High Security Risk)", common_consts.EnvDeckDaemonToken)
	}

	return func(c *gin.Context) {
		// Bypass if token is not configured (Development mode only, risky!)
		if expectedToken == "" {
			c.Next()
			return
		}

		clientToken := c.GetHeader(common_consts.DaemonAuthHeader)
		if clientToken == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization token"})
			return
		}

		if clientToken != expectedToken {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization token"})
			return
		}

		c.Next()
	}
}
