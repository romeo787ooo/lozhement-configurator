# Interaction character вЂ” MakeHuman / MPFB

`human.glb` is a locally generated, rigged 180 cm character for the independent
5040 interaction scene. It contains five static skeletal poses (stored as identical glTF keys):
`carry_one`, `carry_two`, `carry_roll`, `carry_side`, and `carry_compare`.

`carry_two` is the mirrored right-hand pose for the second person in paired
carry. The first person uses `carry_one`; both face the same direction and
hold opposite side handles. The second model is hidden in other modes.

27,226 triangles; textures at most 2048 px (hair/eyebrows 1024 px); approximately
3.5 MB including the skeleton and animations. Skin, clothes and shoes are opaque;
hair and eyebrows retain their texture transparency. No runtime asset service,
account or Blender installation is needed by users.

## Sources and license

The model and its source assets are **CC0 1.0 Universal**. See
[LICENSE-CC0.md](LICENSE-CC0.md). This asset license is separate from MPFB's code
license; MPFB code is not bundled in the application.

- [MPFB source](https://github.com/makehumancommunity/mpfb2), commit
  `6ff1eb358f6c1959ced77e79e6dd2406d9a71f49` (base mesh, targets, game-engine rig and weights).
- [MakeHuman system asset catalog](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html).
- [Source asset archive](https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip),
  SHA-256 `b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107`.
- Selected assets: `middleage_caucasian_male`, `low-poly` eyes, `eyebrow001`,
  `short01` hair, `male_casualsuit04` clothes, `shoes02`. Each is marked CC0 in
  the source catalog. Source authors include the MakeHuman team, Data Collection
  AB, Joel Palmius and Jonas Hauquier; original asset headers retain attribution.

## Rebuild

Build tools: Blender 4.3.2 portable, the MPFB checkout above, unpacked MakeHuman
system assets, and Python with Pillow for texture compression.

From the repository root:

```text
blender --background --python tools/build_interaction_human.py -- MPFB_SOURCE ASSETS_DIR
blender --background --python tools/pose_interaction_human.py -- BUILD_DIR/interaction-human.blend
python tools/optimize_human_glb.py
python tools/check_interaction.py
```

The first script saves the intermediate blend next to `ASSETS_DIR`, outside the
repository. The pose script uses anatomical elbow planes and ankle IK, curls finger
bones, fixes foot orientation and bakes static poses. Hand targets correspond to
the current 5040 handle positions; changing those positions requires rebaking
the clips. The browser pauses each pose at its first frame; there is no walking animation.

This is a visual demonstration, not a load-bearing or ergonomic simulation.
