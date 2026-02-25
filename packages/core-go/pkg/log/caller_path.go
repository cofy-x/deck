package log

import (
	"path/filepath"
	"strings"
)

var repoPathSegments = []string{
	"/packages/",
	"/apps/",
	"/docs/",
	"/scripts/",
	"/hack/",
	"/examples/",
	"/docker/",
	"/deploy/",
	"/dist/",
}

func normalizeCallerPath(file string) string {
	if file == "" {
		return ""
	}

	cleaned := filepath.Clean(file)
	if callerBasePath != "" && filepath.IsAbs(cleaned) {
		if rel, err := filepath.Rel(callerBasePath, cleaned); err == nil && !strings.HasPrefix(rel, "..") {
			return filepath.ToSlash(rel)
		}
	}

	slashPath := filepath.ToSlash(cleaned)
	for _, segment := range repoPathSegments {
		if idx := strings.Index(slashPath, segment); idx >= 0 {
			return strings.TrimPrefix(slashPath[idx+1:], "/")
		}
	}

	return slashPath
}
