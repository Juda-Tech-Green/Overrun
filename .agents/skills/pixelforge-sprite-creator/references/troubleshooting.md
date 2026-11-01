# Troubleshooting

- Missing CLI: install the full reviewed local tarball set; check Node version. Do not assume the unscoped registry name belongs to this project.
- Offline npm cache miss: local PixelForge tarballs do not include third-party packages. Obtain dependencies through approved project setup; report the missing cache honestly.
- Invalid palette/layer/frame: run validate and fix the reported path. Index0 must stay transparent. Every frame needs every global layer.
- Cannot delete source/entry: resolve animation/game references explicitly first.
- Bundle directory exists: choose a fresh output directory. Do not recursively delete another project's asset directory.
- Geometry out of canvas: use integer original-source coordinates; origin values are normalized separately.
- Host does not discover skill: explicitly request “Use the pixelforge-sprite-creator skill” and provide its local SKILL.md path. File installation does not prove agent activation. See the project's compatibility matrix for host-specific conventions.
- Visual inspection unavailable: validate structure and exports, report that resemblance/readability was not checked.
