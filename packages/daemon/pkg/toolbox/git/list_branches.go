package git

import (
	"errors"
	"net/http"

	"github.com/cofy-x/deck/apps/daemon/pkg/git"
	"github.com/gin-gonic/gin"
)

// ListBranches godoc
//
//	@Summary		List branches
//	@Description	Get a list of all branches in the Git repository
//	@Tags			git
//	@Produce		json
//	@Param			path	query		string	true	"Repository path"
//	@Success		200		{object}	ListBranchResponse
//	@Router			/git/branches [get]
//
//	@id				ListBranches
func ListBranches(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		c.AbortWithError(http.StatusBadRequest, errors.New("path is required"))
		return
	}

	gitService := git.Service{
		WorkDir: path,
	}

	branchList, err := gitService.ListBranches()
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	c.JSON(http.StatusOK, ListBranchResponse{
		Branches: branchList,
	})
}
