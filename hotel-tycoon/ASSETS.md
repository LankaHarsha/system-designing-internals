# Third-party assets

Every file under `public/assets/` that we did not make, with its licence and source. Add a row in the same commit as the files.

| Pack | Files | Licence | Source | Imported with |
| --- | --- | --- | --- | --- |
| KayKit Furniture Bits 1.0 (Kay Lousberg) | `public/assets/kaykit/furniture/` | CC0 (see `LICENSE.txt` beside the files) | [GitHub @ 96d5930](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) | `scripts/import-kaykit.sh` |
| KayKit Restaurant Bits 1.0 (Kay Lousberg) | `public/assets/kaykit/restaurant/` | CC0 (see `LICENSE.txt` beside the files) | [GitHub @ 153c8a7](https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0) | `scripts/import-kaykit.sh` |
| Quaternius Ultimate Modular Men + Women | `public/assets/characters/quaternius-modular/` (11 outfits) | CC0 (see `LICENSE.txt` beside the files) | [quaternius.com](https://quaternius.com/packs/ultimatemodularcharacters.html) (Google Drive) | `scripts/import-characters.sh`: one mesh + one material per outfit, 5 clips, meshopt-compressed; Suit's pistol removed; Worker outfits recoloured as housekeeping uniforms |

## Characters

Chosen 2026-10-09: **Quaternius Ultimate Modular Men + Women**, over Kenney Mini Characters. The outfit list and which role wears what live in `src/scene/characters.js`; the game, the character lab (`?lab`) and the asset tests all read it. To add an outfit, add it to `QUAT` in `scripts/import-characters.sh`, re-run the script, then add the name to `OUTFITS`.

| Role | Outfits |
| --- | --- |
| Guest | `male-casual-hoodie`, `female-casual`, `male-casual`, `female-punk`, `male-beach` |
| VIP (suite tier) | `male-suit`, `female-formal`, `female-suit` |
| Housekeeper | `male-worker`, `female-worker` (recoloured) |
| Receptionist | `male-suit`, `female-suit` |
| Owner (you) | `owner` (casual outfit recoloured in the accent orange) |

## Rules

- Prefer CC0. Anything else needs its terms written here before the files land.
- Never commit files whose licence forbids redistribution (for example raw Mixamo downloads).
- Keep each pack's own licence file next to its files.
