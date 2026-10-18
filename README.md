# Gizmo's World

A cozy exploration game: wander an endless, procedurally generated pixel-art world with Gizmo,
discover biomes and collect treasures.

## Develop

    npm install
    npm run dev       # http://localhost:5173 (add ?debug for the debug overlay, F3 toggles it)
    npm test
    npm run lint
    npm run build     # static site in dist/

## Deploy

Pushing to `master` or `main` on GitHub runs `.github/workflows/deploy.yml`, which lints, tests,
builds and publishes to GitHub Pages. Enable Pages with "GitHub Actions" as the source in the repo
settings. For itch.io, zip the contents of `dist/` and upload it as an HTML game.

## Layout

- `src/core` — RNG, noise, LRU, game loop
- `src/data` — content tables (biomes, terrains, items, blocks, buildings)
- `src/world` — deterministic world generation and chunk cache
- `src/systems` — movement, energy, effects, pickups, discovery
- `src/render` — chunk baking and drawing
- `src/ui`, `src/input`, `src/save` — HUD/menu, controls, save files

Design docs live in `docs/superpowers/`.

## License

MIT — see [LICENSE](LICENSE).
