# Phaser characters

Add game data through operations: setSpriteOrigin(origin normalized0–1), setCollisionBody(body rectangle x/y/width/height or circle x/y/radius), addGameBox(box with id/name/kind hitbox|hurtbox/scope/rect/enabled), setAnchor(anchor), setAnimationEvent(event with id/name/animation/index). Scope is `{type:"project"}`, source frame, animation, or entry; all use untrimmed canvas coordinates. Stable collision bodies reduce jitter. Combat regions are custom rectangles, not extra physics objects.

Export `--format phaser --layout atlas --name hero --output public/assets/hero`; output includes native JSON Hash atlas + PNG, PixelForge animations/game metadata, bundle.json and README. Fixed sheet is also supported. Preserve durations; Phaser3.90 frame.duration is a full override, not an additive delay.

Use installed @pixelforge/phaser helpers: loadPixelForgeAssets in preload with parsed manifest, readPixelForgeMetadata/registerPixelForgeAnimations in create, then createPixelForgeCharacter and playPixelForgeAnimation. getActiveHitboxes resolves world rectangles; observePixelForgeEvents delivers structured markers once per observed entry. Configure Arcade physics in the target game and keep movement logic there. Namespaced keys avoid character collisions. Untrimmed textures, rotation-free combat boxes and uniform positive circle-body scaling are current bounds.

Inspect target scene conventions first. Copy all bundle files together without overwriting unrelated assets. Run its actual game/build and verify no loading errors, named timing, physics geometry and relevant attacks. A successful PNG export alone does not prove game integration.
