# Client macOS Release Workflows Runbook

This runbook documents how to operate and troubleshoot macOS release workflows for the client app.

Workflows covered:

- `.github/workflows/client-release.yml` (signed + notarized path)
- `.github/workflows/client-release-unsigned.yml` (unsigned fallback path)

## Scope

This runbook is for operational release handling, not product feature design.

- Package type: macOS DMG
- CI platform: GitHub Actions (`macos-14`)
- Notarization tool: `xcrun notarytool`

## Workflow Selection

| Workflow | Use when | Notarization | Release visibility default |
| :--- | :--- | :--- | :--- |
| `client-release.yml` | Normal delivery path | Required | `prerelease=true` by input |
| `client-release-unsigned.yml` | Notarization is blocked and delivery is urgent | Skipped | `draft=true`, `prerelease=true` |

## `client-release.yml` (Signed + Notarized)

High-level stages:

1. Validate version and ensure tag does not exist.
2. Resolve checkout `HEAD` and persist `BUILD_COMMIT_SHA`.
3. Validate required Apple credentials/secrets.
4. Build signed arm64 and x86_64 DMGs.
5. Upload pre-notarization backup artifact.
6. Submit notarization and poll status.
7. On `Accepted`, staple DMGs.
8. Upload notarized assets and create GitHub release.

Operational notes:

- Job timeout: 180 minutes.
- Poll timeout per notarization submission: 5400 seconds (90 minutes).
- Release tag target is pinned to `BUILD_COMMIT_SHA` to avoid ref drift.

## `client-release-unsigned.yml` (Unsigned Fallback)

High-level stages:

1. Validate version and ensure tag does not exist.
2. Resolve checkout `HEAD` and persist `BUILD_COMMIT_SHA`.
3. Build arm64 and x86_64 DMGs without notarization.
4. Generate SHA256 checksum manifest with asset basenames.
5. Upload artifacts and create a warning-marked release.

Operational notes:

- No Apple secrets are required.
- Keep `draft=true` unless immediate public distribution is required.
- Include checksum verification guidance in release notes.

Checksum verification:

```bash
shasum -a 256 -c deck-client-<version>-UNSIGNED-SHA256SUMS.txt
```

## First Notarization Latency Baseline

You should assume first submissions may be slow.

Observed baseline in this repo:

- Submission created on `2026-02-28`.
- Same submission moved to `Accepted` on `2026-03-02`.

Guidance:

- A workflow timeout does not automatically mean notarization failure.
- Check submission status first before deciding to re-run a full release workflow.

## Timeout Handling Decision Guide

### Prefer manual recovery when:

- Submission eventually becomes `Accepted`.
- Pre-notarization artifact from the same run is available.

### Re-run full workflow when:

- Original artifacts are not recoverable.
- You intentionally publish a new version.

### Escalate when:

- Submission remains `In Progress` beyond your threshold (recommended: 48 hours).

## Manual Recovery After Timeout

If workflow timed out but notarization later becomes `Accepted`:

1. Download pre-notarization artifact from the failed run.
2. Staple and validate each DMG.
3. Upload recovered assets to the release.

Commands:

```bash
# Download artifacts by run ID and artifact name
gh run download <RUN_ID> \
  --repo <OWNER>/<REPO> \
  --name deck-client-dmg-<version>-signed \
  --dir ./artifact

# Check notarization status
xcrun notarytool info <SUBMISSION_ID> \
  --apple-id "<APPLE_ID>" \
  --password "<APP_SPECIFIC_PASSWORD>" \
  --team-id "<TEAM_ID>"

# Staple and validate
xcrun stapler staple ./artifact/<PATH_TO_ARM64_DMG>
xcrun stapler validate ./artifact/<PATH_TO_ARM64_DMG>
xcrun stapler staple ./artifact/<PATH_TO_X64_DMG>
xcrun stapler validate ./artifact/<PATH_TO_X64_DMG>

# Upload recovered assets to release
gh release upload v<version> \
  ./artifact/<PATH_TO_ARM64_DMG> \
  ./artifact/<PATH_TO_X64_DMG> \
  --clobber
```

## Troubleshooting

| Symptom | Likely cause | Action |
| :--- | :--- | :--- |
| `In Progress` for long time | Apple queue or first-submission latency | Keep polling before re-running |
| Workflow timeout during notarization | Poll timeout hit before Apple response | Apply manual recovery flow |
| `Invalid` or `Rejected` | Signing/runtime/notary validation issue | Run `xcrun notarytool log <id>` and fix findings |
| Unsigned checksum verification fails | Wrong manifest format | Use basename-based checksum manifest from unsigned workflow |
| Tag commit mismatch | Mutable branch ref used as release target | Ensure `target_commitish` uses resolved `HEAD` SHA |

## Recommended Operating Procedure

Normal path:

1. Run `client-signing-check.yml`.
2. Run `client-release.yml`.
3. If timeout occurs, check notarization status before any re-run.

Emergency path:

1. Run `client-release-unsigned.yml`.
2. Keep release draft unless immediate external distribution is required.
3. Promote to signed/notarized release once Apple path is healthy.

