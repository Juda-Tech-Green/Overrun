# PixelForge Skill Installation & Verification — Antigravity Review

> Field report from installing the [`pixelforge-sprite-creator`](https://github.com/Juda-Tech-Green/pixelforge)
> agent skill and the PixelForge CLI into this repository and Google Antigravity global environment,
> performed by Google Antigravity on Linux on 2026-10-31.

---

## Executive Summary

| Verification Target | Status | Verification Detail |
| --- | --- | --- |
| **Workspace Skill Install** | ✅ Verified | Installed at `.agents/skills/pixelforge-sprite-creator`, SHA-256 verified via `install.mjs verify` |
| **Global Antigravity Skill Install** | ✅ Verified | Installed at `~/.gemini/config/skills/pixelforge-sprite-creator` for cross-workspace Antigravity availability |
| **Antigravity Skill Discovery** | ✅ Active | Automatically discovered and registered in Antigravity agent context (`<skills>`) with full prompt injection |
| **PixelForge CLI v0.4.0** | ✅ Functional | Vendored tarballs in `vendor/pixelforge/` resolved via `file:` protocol in `package.json` |
| **Environment Check** | ✅ Passed | `node .agents/skills/.../scripts/check-environment.mjs` -> `ok: true` (Node 24.21.0, CLI 0.4.0) |
| **Project Validation Helper** | ✅ Passed | `node .agents/skills/.../scripts/validate-project.mjs` -> `ok: true` |
| **CLI Validation & Render** | ✅ Passed | `pixelforge validate` and `pixelforge render` passed with code 0 and valid PNG output |
| **Phaser Export & Verification** | ✅ Passed | `pixelforge export --format phaser --layout atlas` and `validate-export.mjs` -> `ok: true` (exact raster pixel match) |
| **Game Build & Development Server** | ✅ Passed | `npm run build` cleanly compiled production bundle; dev server active on `http://localhost:8080` |

---

## Skill Architecture & Locations in Antigravity

Antigravity discovers customizations from two primary roots:
1. **Workspace Root**: `<workspace>/.agents/skills/<skill_name>/SKILL.md`
   - Active path: `/home/juda/Repos/testing_skill_pixelforge/.agents/skills/pixelforge-sprite-creator/SKILL.md`
2. **Global Customizations Root**: `~/.gemini/config/skills/<skill_name>/SKILL.md`
   - Active path: `/home/juda/.gemini/config/skills/pixelforge-sprite-creator/SKILL.md`

Both installations include:
- `SKILL.md` frontmatter and instructions
- Reference guides (`references/animations.md`, `references/cli.md`, `references/operations.md`, `references/phaser-export.md`, `references/reference-workflow.md`, `references/sprite-format.md`, `references/troubleshooting.md`)
- Helper scripts (`scripts/check-environment.mjs`, `scripts/validate-project.mjs`, `scripts/validate-export.mjs`, `scripts/install.mjs`, `scripts/runtime.mjs`)
- Example projects (`examples/character/`, `examples/coin/`, `examples/phaser-character/`, `examples/reference/`)

---

## Reproducible Command Cheatsheet

### 1. Verification
```bash
# Verify skill file integrity against installer receipt
node .agents/skills/pixelforge-sprite-creator/scripts/install.mjs verify --target .agents/skills

# Verify Node & PixelForge CLI runtime environment
node .agents/skills/pixelforge-sprite-creator/scripts/check-environment.mjs
```

### 2. Sprite Creation, Validation & Rendering
```bash
# Validate a sprite JSON file
node_modules/.bin/pixelforge validate path/to/my.sprite.json
node .agents/skills/pixelforge-sprite-creator/scripts/validate-project.mjs path/to/my.sprite.json

# Render a single animation frame
node_modules/.bin/pixelforge render path/to/my.sprite.json --animation walk --frame 0 --output dist/frame-0.png
```

### 3. Phaser 4 Export & Quality Assurance
```bash
# Export Phaser atlas bundle
node_modules/.bin/pixelforge export path/to/my.sprite.json \
  --format phaser --layout atlas --name my_asset --output public/assets/my_asset

# Validate exported bundle and pixel-perfect raster equivalence
node .agents/skills/pixelforge-sprite-creator/scripts/validate-export.mjs \
  public/assets/my_asset path/to/my.sprite.json
```

---

## Upstream & Tooling Notes

- **Offline / Local Distribution**: PixelForge is distributed as maintainer tarballs (`@pixelforge/core`, `@pixelforge/exporters`, `@pixelforge/cli`, `@pixelforge/phaser`). Vendoring these in `vendor/pixelforge/` guarantees reliable `npm ci` / `npm install` without requiring external npm registry packages.
- **Phaser 4 Compatibility**: `@pixelforge/phaser` defines a peer dependency for Phaser 3.90, but this project runs Phaser 4.0.0. The standard practice is to export atlases via `pixelforge export --format phaser --layout atlas` and load them using Phaser 4's native `this.load.atlas()` and `this.load.json()`.
