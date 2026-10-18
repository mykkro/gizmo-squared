# Manual test checklist

Run `npm run dev` (or open the deployed site). Test on desktop Chrome, desktop Firefox and one
Android or iOS phone.

## Rendering
- [ ] Pixels are crisp (no blur) at every window size; resizing keeps them crisp.
- [ ] No seams or flicker at chunk borders while walking (use `?debug`; borders are every 32 tiles).
- [ ] Walking continuously for 60 s keeps ~60 fps in the debug overlay; no visible hitches.
- [ ] No grey "unbaked" squares appear at screen edges while walking normally.

## Input
- [ ] WASD and arrow keys move Gizmo; diagonals aren't faster.
- [ ] Hold W, alt-tab away, come back: Gizmo is not walking.
- [ ] Phone: touching the left part of the screen shows the joystick; dragging moves Gizmo; releasing stops.
- [ ] Phone: touching the right part of the screen does nothing; the page never scrolls or zooms.

## Gameplay
- [ ] Biome toast appears on entering a biome; "New biome discovered!" only the first time.
- [ ] Walking along a biome border doesn't spam toasts.
- [ ] Berry, golden fruit, zoom leaf, sour berry, magnet petal and sap behave as described in the spec.
- [ ] Magnet pulls nearby items in with a short flying animation.
- [ ] At 0 energy Gizmo looks sleepy, moves at half speed and the HUD hint shows; eating restores normal speed.
- [ ] Water, lava and Iceberg ice block movement; Gizmo slides along walls instead of sticking.

## Saves
- [ ] Reload restores position, energy, treasures, effects, discovered biomes and collected items.
- [ ] Same seed → same world after "New world".
- [ ] Export downloads a `.json` file; Import of that file restores it.
- [ ] Importing an unrelated `.json` shows an error and changes nothing.
- [ ] In a private window where storage is blocked, the game runs and shows the "saving isn't available" notice.
- [ ] Hiding the tab pauses the game and saves.
