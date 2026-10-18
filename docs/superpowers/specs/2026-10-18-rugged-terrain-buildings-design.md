# Rugged terrain variety and real-looking buildings

Date: 2026-10-18
Status: Approved in conversation; written for the record.

## Part A: terrain variety and ruggedness

1. **Larger textures.** `TEX_PX` becomes 256 (8 × 8 tiles). Recipe feature frequencies double, so features keep their size in world pixels.
2. **Grain.** Per-pixel hash noise of about ±6% on every terrain.
3. **Sharper features.** Ridged noise (`1 - |2n - 1|`) is available to recipes, and contrast is raised.
4. **Detail layers.** Each recipe lists zero or more details:
   - `tufts`: dark clumps with light blades (grass, grassland)
   - `pebbles`: lit top-left, shadowed bottom-right (dirt, mud, bog)
   - `stones`: sparser, larger (sand, dirt)
   - `shells`: light specks (sand)
   - `cracks`: dark edges and light chips (stone, rock, volcanic rock)
   - `drifts`: wind streaks (snow, snowy dirt)
   - `icecracks`: thin crack lines (ice)
   - `twigs`: short dark lines (forest floor)
   - `crust`: rough crust (lava)
5. **World-scale variation.** A low-frequency world-space noise, sampled at tile centres (about 8-tile features), scales brightness by about ±10% with a slight warm or cool shift. Values are interpolated bilinearly with the same weights as terrain blending, so baked chunks and direct sampling stay identical (no seams).

## Part B: buildings

1. **Kinds.** Each building has `kind: 'house' | 'open'`. Houses also have `roof` (clay | slate | thatch | shingle), `wall` (plaster | brick | planks | stone) and an optional `chimney`.

   | Building | Kind | Roof | Wall | Chimney |
   |---|---|---|---|---|
   | small_house | house | clay | plaster | yes |
   | tavern | house | shingle | planks | yes |
   | barn | house | slate | planks (red) | no |
   | blacksmith | house | slate | stone | yes |
   | mill | house | thatch | plaster | no |
   | watch_tower | house | shingle | stone | no |
   | shrine | open | — | — | — |
   | temple | open | — | — | — |

2. **Placement record.** The generator records each placed building in `ChunkData.buildings` (`{ index, ox, oy }`, local tile coordinates). This is deterministic, so the save format is unchanged.
3. **Collision.** A house's whole bounding-box footprint is solid, with no block and no items. Open structures keep their blueprint behaviour; their `.` tiles get stone paving.
4. **Rendering** (top-down, slightly angled), painted into the chunk bake after terrain and objects:
   - **Drop shadow** to the bottom-right, clipped to the chunk.
   - **Front wall:** the bottom band, 0.8 tile high, in the wall material. A door sits in the centre, with a window in every other tile of the front, and the wall darkens under the eaves. Buildings keep a one-tile margin from the chunk edges so overhang and shadow are never cut off.
   - **Roof:** covers the rest of the footprint as a gable. The ridge runs horizontally through the middle; the upper slope is lit (×1.1), the lower slope shaded (×0.85). It has a ridge cap, a dark eaves edge and darkened side edges.
   - **Chimney** (when set): a brick stack with a dark opening.
5. **Materials.** 64 × 64 seamless procedural textures for clay, slate, thatch, shingle, plaster, brick, planks, stone and paving. Building blocks in open structures, such as pillars, use stone or brick masonry tinted by the block colour.

## Done criteria

- Tests pass:
  - textures are seamless at 256, rough (mean neighbour difference above a threshold), and world-varied (the same texel 3 textures apart differs)
  - seam test still passes
  - materials are seamless and textured
  - generator records buildings and house footprints are solid
  - building painting: roof covers the footprint, the door is in the front wall, shadow pixels stay in bounds, nothing is written outside the footprint and shadow
- Bake time in the debug overlay stays at a few milliseconds.
- Before and after screenshots.
