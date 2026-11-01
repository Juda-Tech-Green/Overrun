# Animation construction

Duplicate a deliberate base frame, edit moving regions and retain canvas/baseline/palette. Use unique stable source IDs. Animation entries may share sources; duplicate before correcting only one shared entry.

```json
{"version":"1.0","operations":[
 {"op":"addAnimation","name":"walk","loop":true,"frames":[{"frameId":"frame-0","durationMs":125},{"frameId":"step-1","durationMs":125}]},
 {"op":"setFrameDuration","name":"walk","index":1,"durationMs":150}
]}
```

Use addAnimationFrame(name,frameId,durationMs,index optional), removeAnimationFrame(name,index), reorderAnimationFrames(name,indices permutation), renameAnimation(name,newName), removeAnimation(name), setAnimationLoop(name,loop). Batch fields are JSON object properties. Removing an entry preserves the source. Removing referenced sources fails until references are deliberately resolved. Entry-scoped game metadata follows insertion/reorder; deleting metadata-bearing entries is rejected until its associations are removed.

Inspect timed sequences, not just source ordering. Export a fixed-cell contact sheet with columns; render representative entries individually. Consistent bounds are structural evidence, not proof of appealing motion. Document intentional shifts such as jumps separately from ground drift.
