package git

import (
	"errors"
	"net/http"

	"github.com/cofy-x/deck/apps/daemon/pkg/git"
	"github.com/gin-gonic/gin"
)

// GetCommitHistory godoc
//
//	@Summary		Get commit history
//	@Description	Get the commit history of the Git repository
//	@Tags			git
//	@Produce		json
//	@Param			path	query	string	true	"Repository path"
//	@Success		200		{array}	git.GitCommitInfo
//	@Router			/git/history [get]
//
//	@id				GetCommitHistory
func GetCommitHistory(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		c.AbortWithError(http.StatusBadRequest, errors.New("path is required"))
		return
	}

	gitService := git.Service{
		WorkDir: path,
	}

	log, err := gitService.Log()
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	c.JSON(http.StatusOK, log)
}
