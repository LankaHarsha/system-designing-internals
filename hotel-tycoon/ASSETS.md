# Third-party assets

Every file under `public/assets/` that we did not make, with its licence and source. Add a row in the same commit as the files.

| Pack | Files | Licence | Source | Imported with |
| --- | --- | --- | --- | --- |
| KayKit Furniture Bits 1.0 (Kay Lousberg) | `public/assets/kaykit/furniture/` | CC0 (see `LICENSE.txt` beside the files) | [GitHub @ 96d5930](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) | `scripts/import-kaykit.sh` |
| KayKit Restaurant Bits 1.0 (Kay Lousberg) | `public/assets/kaykit/restaurant/` | CC0 (see `LICENSE.txt` beside the files) | [GitHub @ 153c8a7](https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0) | `scripts/import-kaykit.sh` |

## Character candidates (not installed yet)

The character lab (`?lab`) compares these. Install one by putting its GLB/glTF files in `public/assets/characters/<dir>/` and listing them in `public/assets/characters/manifest.json` (`models`, plus `scale` and the idle/walk clip names).

| Stack | Pack | Licence | Download |
| --- | --- | --- | --- |
| A | Kenney Mini Characters | CC0 | https://kenney.nl/assets/mini-characters |
| B | Quaternius Ultimate Modular Men / Women | Listed as CC0; confirm the licence file in the zip | https://quaternius.com |

## Rules

- Prefer CC0. Anything else needs its terms written here before the files land.
- Never commit files whose licence forbids redistribution (for example raw Mixamo downloads).
- Keep each pack's own licence file next to its files.
