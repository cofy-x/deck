package middlewares

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/cofy-x/deck/packages/core-go/pkg/log"
)

var ignoreLoggingPaths = map[string]bool{}

func LoggingMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		startTime := time.Now()
		ctx.Next()
		endTime := time.Now()
		latencyTime := endTime.Sub(startTime)
		reqMethod := ctx.Request.Method
		reqUri := ctx.Request.RequestURI
		statusCode := ctx.Writer.Status()

		if len(ctx.Errors) > 0 {
			log.WithFields(log.Fields{
				"method":  reqMethod,
				"URI":     reqUri,
				"status":  statusCode,
				"latency": latencyTime,
				"error":   ctx.Errors.String(),
			}).Error("API ERROR")
		} else {
			fullPath := ctx.FullPath()
			if ignoreLoggingPaths[fullPath] {
				log.WithFields(log.Fields{
					"method":  reqMethod,
					"URI":     reqUri,
					"status":  statusCode,
					"latency": latencyTime,
				}).Debug("API REQUEST")
			} else {
				log.WithFields(log.Fields{
					"method":  reqMethod,
					"URI":     reqUri,
					"status":  statusCode,
					"latency": latencyTime,
				}).Info("API REQUEST")
			}
		}
	}
}
