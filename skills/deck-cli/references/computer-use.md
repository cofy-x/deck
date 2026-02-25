# Computer Commands

Use these commands for screenshot capture and UI interaction.

## TOC
- Quick rules
- Screenshot
- Mouse
- Keyboard
- Browser and window info
- Common workflows

## Quick Rules

1. Use grouped command syntax:
- `deck computer mouse click ...`
- `deck computer keyboard type ...`
2. Screenshot base64 field is `screenshot`.
3. Current CLI does not support these options:
- `mouse click --double`
- `mouse scroll --amount`
- `keyboard type --delay`
- `keyboard press --modifiers`

## Screenshot

```bash
deck computer screenshot [--format png|jpeg] [--quality 1-100] [--scale 0.1-1.0] [--show-cursor] [-o <file>]
```

Examples:
```bash
deck computer screenshot
deck computer screenshot --format jpeg --quality 80
deck computer screenshot -o shot.png
```

Save manually from JSON output:
```bash
deck computer screenshot | jq -r '.screenshot' | base64 -d > screenshot.png
```

## Mouse

```bash
deck computer mouse click <x> <y> [--button left|right|middle]
deck computer mouse move <x> <y>
deck computer mouse drag <x1> <y1> <x2> <y2>
deck computer mouse scroll <x> <y> <up|down>
```

Examples:
```bash
deck computer mouse click 500 300
deck computer mouse click 500 300 --button right
deck computer mouse move 300 200
deck computer mouse drag 100 100 400 100
deck computer mouse scroll 500 400 down
```

## Keyboard

```bash
deck computer keyboard type <text>
deck computer keyboard press <key>
deck computer keyboard hotkey <keys...>
```

Examples:
```bash
deck computer keyboard type "hello"
deck computer keyboard press Return
deck computer keyboard hotkey ctrl c
deck computer keyboard hotkey ctrl shift p
```

Notes:
- `hotkey` joins args with `+`, so `ctrl shift p` becomes `ctrl+shift+p`.

## Browser and Window Info

```bash
deck computer browser <url> [--incognito]
deck computer display-info
deck computer windows
```

Examples:
```bash
deck computer browser https://example.com
deck computer browser http://localhost:3000 --incognito
deck computer display-info
deck computer windows
```

## Common Workflows

### Inspect current GUI state

```bash
deck computer display-info
deck computer windows
deck computer screenshot -o state.png
```

### Basic form interaction

```bash
deck computer mouse click 400 300
deck computer keyboard type "user@example.com"
deck computer keyboard press Tab
deck computer keyboard type "secret"
deck computer keyboard press Return
```

### Browser smoke check

```bash
deck computer browser http://localhost:3000
sleep 2
deck computer screenshot | jq -r '.screenshot' | base64 -d > browser.png
```
