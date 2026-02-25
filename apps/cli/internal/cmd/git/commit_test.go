package git

import "testing"

func TestResolveCommitIdentityUsesFlags(t *testing.T) {
	t.Setenv("GIT_AUTHOR_NAME", "Env Author")
	t.Setenv("GIT_AUTHOR_EMAIL", "env@example.com")

	author, email, err := resolveCommitIdentity("Flag Author", "flag@example.com")
	if err != nil {
		t.Fatalf("resolveCommitIdentity() error = %v", err)
	}
	if author != "Flag Author" || email != "flag@example.com" {
		t.Fatalf("resolveCommitIdentity() = (%q, %q), want (%q, %q)", author, email, "Flag Author", "flag@example.com")
	}
}

func TestResolveCommitIdentityFallsBackToEnv(t *testing.T) {
	t.Setenv("GIT_AUTHOR_NAME", "Env Author")
	t.Setenv("GIT_AUTHOR_EMAIL", "env@example.com")

	author, email, err := resolveCommitIdentity("", "")
	if err != nil {
		t.Fatalf("resolveCommitIdentity() error = %v", err)
	}
	if author != "Env Author" || email != "env@example.com" {
		t.Fatalf("resolveCommitIdentity() = (%q, %q), want (%q, %q)", author, email, "Env Author", "env@example.com")
	}
}

func TestResolveCommitIdentityReturnsErrorWhenMissing(t *testing.T) {
	t.Setenv("GIT_AUTHOR_NAME", "")
	t.Setenv("GIT_AUTHOR_EMAIL", "")
	t.Setenv("GIT_COMMITTER_NAME", "")
	t.Setenv("GIT_COMMITTER_EMAIL", "")

	_, _, err := resolveCommitIdentity("", "")
	if err == nil {
		t.Fatal("resolveCommitIdentity() expected error, got nil")
	}
}
