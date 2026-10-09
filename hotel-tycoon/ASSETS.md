# Third-party assets

Every file under `public/assets/` that we did not make, with its licence and source. Add a row in the same commit as the files.

| Pack | Files | Licence | Source | Imported with |
| --- | --- | --- | --- | --- |
| KayKit Furniture Bits 1.0 (Kay Lousberg) | `public/assets/kaykit/furniture/` | CC0 (see `LICENSE.txt` beside the files) | [GitHub @ 96d5930](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) | `scripts/import-kaykit.sh` |
| KayKit Restaurant Bits 1.0 (Kay Lousberg) | `public/assets/kaykit/restaurant/` | CC0 (see `LICENSE.txt` beside the files) | [GitHub @ 153c8a7](https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0) | `scripts/import-kaykit.sh` |
| Kenney Mini Characters 1.0 | `public/assets/characters/kenney-mini/` (6 of 12 characters) | CC0 (see `LICENSE.txt` beside the files) | [kenney.nl](https://kenney.nl/assets/mini-characters) | `scripts/import-characters.sh` |
| Quaternius Ultimate Modular Men + Women | `public/assets/characters/quaternius-modular/` (4 outfits) | CC0 (see `LICENSE.txt` beside the files) | [quaternius.com](https://quaternius.com/packs/ultimatemodularcharacters.html) (Google Drive) | `scripts/import-characters.sh`; converted to GLB, combat clips and the Suit's pistol removed |

## Character candidates (installed, not chosen yet)

The character lab (`?lab`) compares both packs side by side. To add or swap models, edit the lists in `scripts/import-characters.sh`, re-run it, then update `models` in `public/assets/characters/manifest.json`.

| Stack | Pack | Models | Size | Clips we use |
| --- | --- | --- | --- | --- |
| A | Kenney Mini Characters | `character-{male,female}-{a,c,e}.glb` + shared `Textures/colormap.png` | 1.5 MB | `idle`, `walk` (pack has 32, incl. `sit`, `interact-*`, `pick-up`) |
| B | Quaternius Modular | `male-suit`, `female-formal`, `male-casual-hoodie`, `female-casual` | 4.8 MB | `Idle`, `Walk` (kept: `Idle_Neutral`, `Run`, `Interact`, `Wave`) |

When one family is picked, delete the other pack's folder, its manifest entry and its row above.

## Rules

- Prefer CC0. Anything else needs its terms written here before the files land.
- Never commit files whose licence forbids redistribution (for example raw Mixamo downloads).
- Keep each pack's own licence file next to its files.
