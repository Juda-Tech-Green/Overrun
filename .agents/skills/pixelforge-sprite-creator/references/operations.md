# Operation batches

File shape: `{"version":"1.0","operations":[...]}`. Batch validation runs before execution on a clone; execution failure never writes a partial destination. Use explicit frame/layer IDs.

```json
{"version":"1.0","operations":[
 {"op":"addPaletteColor","color":[40,120,220,255]},
 {"op":"drawRect","frame":"frame-0","layer":"base","x":4,"y":4,"width":8,"height":8,"color":2,"filled":true},
 {"op":"copyFrame","source":"frame-0","id":"step-1"},
 {"op":"moveRegion","frame":"step-1","layer":"base","x":4,"y":4,"width":8,"height":8,"dx":1,"dy":0}
]}
```

Draw with setPixel/clearPixel, drawLine (x0,y0,x1,y1), drawRect/drawEllipse (x,y,width,height,color,filled), floodFill. Transparent writes overwrite with index0. Shapes clip; direct setPixel rejects out-of-canvas coordinates. moveRegion snapshots source, clears it, clips destination and safely handles overlap; transparent cells overwrite destination too. flipHorizontal/flipVertical operate on one layer; clearFrame affects all planes. replaceColor uses from/to indices.

Structural operations include createFrame/copyFrame/removeFrame/reorderFrames(ids), createLayer/renameLayer/removeLayer/reorderLayers/setLayerVisibility, addPaletteColor/updatePaletteColor/removePaletteColor. Removing used palette colors is rejected; unused removal safely remaps higher indices. Never delete the last frame or layer. Animation and game operations are described in their references.
