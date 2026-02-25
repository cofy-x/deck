# System and Config Commands

Use these commands for environment discovery and CLI configuration.

## TOC
- Quick rules
- Info commands
- Config commands
- Common workflows

## Quick Rules

1. `deck info workdir` returns `workdir` field.
2. `deck info homedir` returns `homedir` field.
3. `deck info ports` returns `ports` array inside an object.
4. Config keys are kebab-case (`daemon-url`, not `daemon_url`).

## Info Commands

### Version
```bash
deck info version
```

### Workdir
```bash
deck info workdir
```

Example:
```bash
deck info workdir | jq -r '.workdir'
```

### Homedir
```bash
deck info homedir
```

Example:
```bash
deck info homedir | jq -r '.homedir'
```

### Ports
```bash
deck info ports
```

Example:
```bash
deck info ports | jq -r '.ports[]'
```

## Config Commands

### Get
```bash
deck config get <key>
```

Valid keys:
- `daemon-url`
- `output-format`
- `no-color`

Examples:
```bash
deck config get daemon-url
deck config get output-format
deck config get no-color
```

### Set
```bash
deck config set <key> <value>
```

Examples:
```bash
deck config set daemon-url http://localhost:2280
deck config set output-format json
deck config set no-color true
```

## Common Workflows

### Health discovery

```bash
deck info version
deck info workdir
deck info homedir
deck info ports
```

### Build absolute paths

```bash
WORKDIR=$(deck info workdir | jq -r '.workdir')
HOMEDIR=$(deck info homedir | jq -r '.homedir')
deck fs ls "$WORKDIR"
deck fs cat "$HOMEDIR/.bashrc"
```

### Check daemon URL

```bash
deck config get daemon-url
deck config set daemon-url http://localhost:2280
deck info version
```
