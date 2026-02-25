package git_test

import (
	"testing"

	"github.com/cofy-x/deck/apps/daemon/pkg/git"
	"github.com/cofy-x/deck/apps/daemon/pkg/gitprovider"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/stretchr/testify/suite"
)

var repoHttp = &gitprovider.GitRepository{
	Id:     "123",
	Url:    "http://localhost:3000/cofy-x/deck",
	Name:   "deck",
	Branch: "main",
	Target: gitprovider.CloneTargetBranch,
}

var repoHttps = &gitprovider.GitRepository{
	Id:     "123",
	Url:    "https://github.com/cofy-x/deck",
	Name:   "deck",
	Branch: "main",
	Target: gitprovider.CloneTargetBranch,
}

var repoWithoutProtocol = &gitprovider.GitRepository{
	Id:     "123",
	Url:    "github.com/cofy-x/deck",
	Name:   "deck",
	Branch: "main",
	Target: gitprovider.CloneTargetBranch,
}

var repoWithCloneTargetCommit = &gitprovider.GitRepository{
	Id:     "123",
	Url:    "https://github.com/cofy-x/deck",
	Name:   "deck",
	Branch: "main",
	Sha:    "1234567890",
	Target: gitprovider.CloneTargetCommit,
}

var creds = &http.BasicAuth{
	Username: "deckio",
	Password: "Deck123",
}

type GitServiceTestSuite struct {
	suite.Suite
	gitService git.IGitService
}

func NewGitServiceTestSuite() *GitServiceTestSuite {
	return &GitServiceTestSuite{}
}

func (s *GitServiceTestSuite) SetupTest() {
	s.gitService = &git.Service{
		WorkDir: "/work-dir",
	}
}

func TestGitService(t *testing.T) {
	suite.Run(t, NewGitServiceTestSuite())
}

func (s *GitServiceTestSuite) TestCloneRepositoryCmd_WithCreds() {
	cloneCmd := s.gitService.CloneRepositoryCmd(repoHttps, creds)
	s.Require().Equal([]string{"git", "clone", "--single-branch", "--branch", "\"main\"", "https://deckio:Deck123@github.com/cofy-x/deck", "/work-dir"}, cloneCmd)

	cloneCmd = s.gitService.CloneRepositoryCmd(repoHttp, creds)
	s.Require().Equal([]string{"git", "clone", "--single-branch", "--branch", "\"main\"", "http://deckio:Deck123@localhost:3000/cofy-x/deck", "/work-dir"}, cloneCmd)

	cloneCmd = s.gitService.CloneRepositoryCmd(repoWithoutProtocol, creds)
	s.Require().Equal([]string{"git", "clone", "--single-branch", "--branch", "\"main\"", "https://deckio:Deck123@github.com/cofy-x/deck", "/work-dir"}, cloneCmd)

	cloneCmd = s.gitService.CloneRepositoryCmd(repoWithCloneTargetCommit, creds)
	s.Require().Equal([]string{"git", "clone", "--single-branch", "--branch", "\"main\"", "https://deckio:Deck123@github.com/cofy-x/deck", "/work-dir", "&&", "cd", "/work-dir", "&&", "git", "checkout", "1234567890"}, cloneCmd)
}

func (s *GitServiceTestSuite) TestCloneRepositoryCmd_WithoutCreds() {
	cloneCmd := s.gitService.CloneRepositoryCmd(repoHttps, nil)
	s.Require().Equal([]string{"git", "clone", "--single-branch", "--branch", "\"main\"", "https://github.com/cofy-x/deck", "/work-dir"}, cloneCmd)

	cloneCmd = s.gitService.CloneRepositoryCmd(repoHttp, nil)
	s.Require().Equal([]string{"git", "clone", "--single-branch", "--branch", "\"main\"", "http://localhost:3000/cofy-x/deck", "/work-dir"}, cloneCmd)

	cloneCmd = s.gitService.CloneRepositoryCmd(repoWithoutProtocol, nil)
	s.Require().Equal([]string{"git", "clone", "--single-branch", "--branch", "\"main\"", "https://github.com/cofy-x/deck", "/work-dir"}, cloneCmd)

	cloneCmd = s.gitService.CloneRepositoryCmd(repoWithCloneTargetCommit, nil)
	s.Require().Equal([]string{"git", "clone", "--single-branch", "--branch", "\"main\"", "https://github.com/cofy-x/deck", "/work-dir", "&&", "cd", "/work-dir", "&&", "git", "checkout", "1234567890"}, cloneCmd)
}
