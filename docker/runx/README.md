# Docker Runx Images

Runx is a collection of pre-configured base images for running various runtime environments with SSH access, designed for remote development and testing scenarios.

## Available Images

### base-jdk21

Ubuntu 24.04 based image with OpenJDK 21, Python 3, and zsh shell.

**Includes:**
- OpenJDK 21
- Python 3 (with pip, pipx)
- SSH server (port 22)
- zsh with oh-my-zsh, autosuggestions, and syntax highlighting
- Common development tools (git, vim, curl, wget)

**Local Usage:**

```bash
cd docker/runx/base-jdk21

# Build (with mirror source and architecture)
bash build.sh aliyun amd64

# Run container
bash run.sh

# SSH login
ssh admin@127.0.0.1 -p 2222
# password: admin

# Run tests
bash test.sh
```

**Pull from GitHub Container Registry:**

```bash
docker pull ghcr.io/cofy-x/deck/runx-base-jdk21:latest
```

## Build System

All runx images follow a consistent structure:

```
docker/runx/<image-name>/
├── Dockerfile          # Image definition
├── build.sh            # Local build script
├── run.sh              # Local run script
├── test.sh             # Automated tests
└── supervisord.conf    # Process management config
```

### Build Script Arguments

```bash
bash build.sh [mirror_source] [target_arch]
```

- `mirror_source`: apt mirror for faster downloads (default: `aliyun`)
  - Options: `aliyun`, `ustc`, `tuna`, `official`
- `target_arch`: target architecture (default: `amd64`)
  - Options: `amd64`, `arm64`

### Image Naming Convention

- **Local builds**: `deck/runx-<name>:<version>-<mirror>-<arch>`
  - Example: `deck/runx-base-jdk21:0.0.1-aliyun-amd64`
- **GitHub releases**: `ghcr.io/cofy-x/deck/runx-<name>:<tag>`
  - Tags: `latest`, `sha-<commit>`

## CI/CD

Images are automatically built and published to GitHub Container Registry (GHCR) via GitHub Actions when changes are pushed to `docker/runx/**`.

See [`.github/workflows/docker-runx-images.yml`](../../.github/workflows/docker-runx-images.yml) for details.

## Adding New Images

To add a new runx base image:

1. Create a new directory under `docker/runx/`:
   ```bash
   mkdir docker/runx/base-<runtime>
   ```

2. Add the required files:
   - `Dockerfile` - image definition
   - `build.sh` - build script (copy from base-jdk21 and adjust)
   - `run.sh` - run script (copy from base-jdk21 and adjust)
   - `test.sh` - test script (copy from base-jdk21 and adjust)
   - `supervisord.conf` - if needed

3. Update image-specific variables in scripts:
   - `IMAGE_NAME` in `build.sh`
   - `IMAGE` and `CONTAINER_NAME` in `run.sh` and `test.sh`

4. Commit and push - GitHub Actions will automatically build and publish

## Default User

All runx images include a default user:

- **Username**: `admin`
- **Password**: `admin`
- **Sudo**: passwordless sudo access
- **Shell**: zsh with oh-my-zsh

## Design Philosophy

Runx images are designed to be:
- **Lightweight**: minimal runtime dependencies
- **Consistent**: standardized structure across all images
- **Accessible**: SSH-enabled for remote development
- **Extensible**: easy to add new runtime variants
