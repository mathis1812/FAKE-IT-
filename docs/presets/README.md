# Fiches de presets — univers « Worlds »

Fiches de **design** pour les gabarits d'univers (Minecraft, GTA V, LEGO).

⚠️ **Ces fichiers ne sont PAS lus par l'application.** Le rendu part de
`lib/world-prompts.ts` (prompts) et de `lib/template-prompts.ts` (câblage).
Ces JSON servent à :

- versionner et relire les prompts hors du code,
- documenter le modèle cible, la résolution, les garde-fous qualité,
- garder une trace des negative prompts au cas où on basculerait un jour sur
  un modèle qui les accepte (SDXL, Flux, Seedream — Nano Banana Pro ne les
  prend pas).

Le champ `prompt` de chaque fiche doit rester **identique** à la constante
correspondante dans `lib/world-prompts.ts`. Si tu modifies l'un, reporte
l'autre.

| Fiche | Constante `lib/world-prompts.ts` | Slug catalogue |
|-------|----------------------------------|----------------|
| `minecraft.json` | `MINECRAFT_WORLD_PROMPT` | `minecraft` |
| `gta5.json` | `GTA5_WORLD_PROMPT` | `gta-5` |
| `lego.json` | `LEGO_WORLD_PROMPT` | `lego` |

Pour un univers, `POST /api/generate` joint aussi l'exemple de rendu
(`public/templates/<slug>.jpg`) comme seconde image (référence de style) —
voir `templateUsesStyleReference` dans `lib/template-prompts.ts`.
