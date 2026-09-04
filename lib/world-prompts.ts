import "server-only";

/**
 * Prompts complets des gabarits « Worlds » (Minecraft, GTA V, LEGO).
 *
 * Rédigés à la main, versionnés hors du code sous forme de fiches JSON de
 * design ; c'est leur texte final qui vit ici. Contrairement aux autres
 * catégories, ces trois-là ne passent pas par un builder de `place-prompt`
 * — un style d'univers a besoin de consignes trop spécifiques (blocs,
 * illustration peinte, briques) pour tenir dans un socle générique.
 *
 * Jamais exposés au client : importés uniquement par `lib/template-prompts`,
 * lui-même `server-only`. Cf. `lib/templates.ts` pour la règle générale.
 *
 * Chaque prompt verrouille explicitement le cadrage de sortie sur celui de
 * la photo source : `generateGeminiImage` passe aussi `imageConfig.aspectRatio`,
 * mais la consigne texte reste utile comme second garde-fou.
 */

export const MINECRAFT_WORLD_PROMPT = `Rebuild the world around the person in this photo as a Minecraft-style voxel world, while keeping the person completely untouched.

KEEP EXACTLY AS IN THE ORIGINAL PHOTO — this is the most important instruction: the person stays fully photorealistic and unedited. Preserve their face, skin texture, hair, body proportions, exact pose, hand position, head angle, and their entire outfit including every garment, its color, its fabric texture, its folds, plus any cap, hood, backpack, belt and shoes. Keep them at the exact same position, size and framing within the image. Do not stylize, redraw, smooth, or blockify the person in any way. Do not change the camera angle or crop. Output the final image in the exact same aspect ratio, framing and crop as the input photograph — no cropping, no zooming, no added borders, bars or padding, no change to the composition.

REBUILD EVERYTHING ELSE OUT OF CUBES: reconstruct the entire environment from uniform one-meter voxel blocks with hard ninety-degree edges, flat faces and sharp silhouettes, using visible 16x16 pixel-art block textures with crisp texel edges and no blurring. Follow the real shape of the original landscape closely — the terrain should read as the same place, rebuilt in blocks. Turn the ground into grass blocks with pixelated green tops and brown dirt sides, arranged in stepped terraces that follow the original slope. Turn any path or trail into a stepped walkway of coarse dirt, gravel and podzol blocks. Turn hills, mountains and cliffs into massive stacked stone and andesite blocks forming staircase-shaped terrain that mirrors the original ridgelines. Replace vegetation with flat cross-shaped pixel-art sprites of tall grass, poppies, dandelions, white daisies and oxeye flowers planted on the grass blocks.

ADAPT TO WHAT YOU SEE: identify the type of environment in the photo and choose the matching block palette. Mountains use stone, andesite and cobblestone with snow blocks on the highest peaks. Forests use oak and birch log blocks with cubic layered leaf canopies. Beaches use sand and sandstone blocks with flat translucent blue water blocks. Cities use stone bricks, quartz blocks, grid-patterned glass block windows and stone slab streets. Snow scenes use snow blocks and packed ice with cubic spruce trees. Deserts use sand, sandstone and layered terracotta mesa cliffs. Fields use grass blocks, hay bales and wheat crop sprites. Interiors use plank block walls, stone brick floors, glass pane windows and lantern blocks.

SKY AND LIGHT: keep the sky as a smooth photographic gradient, not voxelized, matching the original sky colors and time of day. Add flat rectangular slab-shaped clouds floating horizontally at several depths. If the moon or sun is visible, render it as a low-resolution pixelated shape. Preserve the original lighting exactly: same sun direction, same warmth, same rim light on the person, same shadow direction, same overall color grade.

FINISH: cinematic 3D voxel render with soft global illumination, ambient occlusion in the block crevices, gentle volumetric light, warm atmospheric haze on distant blocks, subtle lens bloom, shallow depth of field on the far terrain and sharp focus on the person. The person must remain a real photograph composited into a blocky world — that contrast is the entire point of the image.

The final image contains only the person and the voxel landscape: no game interface, no hotbar, no crosshair, no health or hunger bar, no text, no logo, and no Minecraft game characters or creatures.`;

/**
 * ⚠️ ESSAI 04/09 — remplacé par la requête du produit de référence, 51
 * caractères contre 4 084 pour la version précédente.
 *
 * L'ancien prompt (fiche `los_santos_game` v2.0.0, fourni par le
 * propriétaire) décrivait en sept sections la personne, la scène, les
 * étiquettes de props, l'étalonnage, le HUD et la qualité de rendu. Son
 * rendu a été jugé mauvais à l'usage. Le texte complet reste récupérable
 * dans l'historique git, commit précédant celui-ci.
 *
 * Ce qui est mis à la place est le `userQuery` d'usenoway, verbatim — donc
 * en français et à la première personne. Attention : ce n'est PAS leur
 * prompt serveur, qui reste invisible ; c'est l'intention utilisateur que
 * leur front envoie à leur backend. On teste donc « la formulation la plus
 * courte possible », pas « exactement ce qu'ils envoient au modèle ».
 *
 * Le pari repose sur ce qu'on a constaté le même jour sur les swaps
 * véhicule : raccourcir de 456 à 132 caractères n'a rien dégradé, et
 * l'essentiel du défaut venait d'ailleurs. À juger sur des rendus réels.
 *
 * Le contrôle qualité de `gta-5` a été retiré en même temps : son
 * `retrySuffix` redemandait le HUD et les shaders, il aurait réinjecté à la
 * première régénération tout ce qu'on retire ici.
 */
export const GTA5_WORLD_PROMPT = `Transforme ma photo en capture d'écran du jeu GTA 5`;

export const LEGO_WORLD_PROMPT = `Rebuild this entire photograph as a scene made of real LEGO bricks, photographed like an official LEGO set render.

TURN THE PERSON INTO A LEGO MINIFIGURE while keeping them recognizable: a classic minifigure body — cylindrical head, C-shaped claw hands, short legs, blocky torso — but printed and colored to match this specific person. Keep the same skin tone as the minifigure head color, the same hairstyle and hair color rebuilt as a moulded LEGO hair piece or hat, and the same outfit reproduced as printed torso and leg decoration with matching colors. Keep the same pose as far as a minifigure's joints allow, the same head angle, and the same position, size and framing in the image. Do not change the camera angle or crop. Output the final image in the exact same aspect ratio, framing and crop as the input photograph — no cropping, no zooming, no added borders, bars or padding, no change to the composition.

REBUILD EVERYTHING ELSE IN BRICKS: reconstruct the whole environment out of visible LEGO elements — standard bricks, plates, tiles, slopes and specialty parts — with glossy injection-moulded plastic material, visible studs on exposed top surfaces, small sprue marks and fine mould seams, and the slight imperfect alignment of a hand-built model. Follow the real layout of the original scene closely so it reads as the same place rebuilt in LEGO. Ground becomes baseplates and tiles, terrain becomes stepped brick slopes, vegetation becomes LEGO plant pieces (leaf parts, flower studs, tree assemblies), water becomes trans-blue plates and tiles, vehicles become brick-built models.

ADAPT TO WHAT YOU SEE: city scenes use LEGO City parts, walls, windows and road plates; nature scenes use green baseplates, brick rockwork and LEGO trees; beaches use tan plates and trans-blue water; interiors use brick walls, tiled floors, brick-built furniture and printed decoration.

SKY AND LIGHT: keep the sky as a smooth photographic studio backdrop matching the original colors, not brick-built. Preserve the original lighting direction, warmth and shadow direction, rendered as clean product-photography light with soft shadows and gentle specular highlights on the plastic.

FINISH: crisp LEGO set box-art render — macro product photography look, shallow depth of field with the minifigure in sharp focus and the far bricks slightly soft, soft global illumination, subtle contact shadows under every brick, light bloom on glossy edges.

The final image contains only the minifigure and the brick-built world: no game interface, no LEGO logo, no set number, no text, no watermark, no real humans.`;
