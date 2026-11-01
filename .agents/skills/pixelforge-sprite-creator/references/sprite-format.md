# Editable sprite format

Project `version:"1.0"`, name, integer width/height1–1024, palette of1–256 RGBA byte tuples, ordered global layers, source frames and named animations. Palette0 must equal `[0,0,0,0]`. Frames have unique stable IDs and one dense row-major index array per layer, exactly width×height. Origin is top-left. Layer order is bottom to top; visibility is global. Use CLI init + operations to create grids efficiently.

Animations refer to stable source IDs with per-entry durationMs1–3600000 and loop. Repeated references are legal. Source export order is independent from animation order. Unknown document versions/fields are rejected; optional metadata may hold JSON namespaces. `metadata.pixelforgeGame` has validated extension version1.0. Validate using the CLI, not JSON parsing alone: palette bounds, layer grids and references have cross-field invariants.
