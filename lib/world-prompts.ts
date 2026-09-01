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

// Prompt fourni par le propriétaire du produit (fiche los_santos_game v2.0.0).
// v2 = transfert de rendu IN-PLACE : garde le lieu d'origine (v1 le remplaçait
// par une ville type Los Santos), enrichit la scène en props, ajoute des
// étiquettes texte sur les objets (marques réelles substituées), un HUD
// générique en bas à gauche, et renforce les traits du visage. Envoyé avec la
// seule photo user — pas de référence de style (voir templateUsesStyleReference).
export const GTA5_WORLD_PROMPT = `Re-render this photograph as a single in-game screenshot from a modern open-world crime video game, using a high-end real-time game engine.

KEEP THE SAME PLACE. This is critical: do not move the subject to a different location, city or setting. Whatever room, street or landscape they are in stays that same place, with the same layout, the same furniture and objects in the same positions, the same window views, the same camera angle, the same framing and the same distances. You are changing how the scene is rendered, not where it happens.

THE PERSON: re-render them as a 3D game character while keeping them clearly recognizable. Preserve their facial structure, features, skin tone, hairstyle, facial hair, body type, exact pose, hand position and head angle, and their entire outfit down to the cut, color and fabric of every garment plus any watch, tie, jewelry, glasses and shoes. Render all of it in game-engine style: skin with a smooth semi-matte shader and subtle subsurface scattering instead of real pore detail, slightly sharper and more chiseled facial structure with deeper defined creases around the eyes and mouth, hair as sculpted layered geometry rather than individual strands, clothing with simplified folds and clean baked normal-map creases, and a subtle darker edge separating the character from the background. Proportions very slightly heightened — a touch broader in the shoulders and hands, features a little more angular. They must still read as the same person, rendered by a game engine.

THE SCENE: rebuild every surface and object in the same game engine style, and enrich the environment so it feels like a purpose-built game level rather than a bare room. Add depth and density to what is already there: warmer and richer materials, wood panelling and detailed grain on furniture, fuller and more organised shelving, additional plausible props that fit the setting, a warm practical light source such as a brass desk lamp, stacked papers and folders, and small everyday objects on surfaces. Everything must stay consistent with the original location and its purpose — you are dressing the existing set, not inventing a new one.

PROP LABELS: give a few foreground objects short bold labels in uppercase condensed type, the way game props are labelled — for example a book spine, a folder cover or a file tab. Keep them legible, clean and perfectly rendered. Replace any real brand name or real company name visible in the photo with an invented generic equivalent of the same kind, and keep any personal or case names as short invented ones. Never reproduce a real logo or real trademark.

LIGHT AND GRADE: keep the original light direction and time of day, but push it into game-engine lighting — stronger contrast, warm golden key light, deep controlled shadows, soft global illumination bouncing warm tones onto nearby surfaces, and a clear warm-to-cool separation between lit areas and shadow. Rich saturated color grade leaning warm amber and deep navy, gentle vignette at the frame corners, mild bloom on bright highlights, faint chromatic aberration at the edges and a light film grain.

HUD: in the bottom left corner, overlay a simple game interface: a small semi-transparent square minimap showing an abstract grey street or floorplan layout with a white directional arrow at its center, a couple of tiny monochrome icons stacked along its left edge, and three thin horizontal status bars below it in green, blue and yellow. Keep the HUD understated, flat, low-opacity and purely graphic, with no text, no numbers, no logo and no branding of any kind.

RENDER QUALITY: sharp high-fidelity real-time render, screen-space ambient occlusion, crisp contact shadows, detailed material textures, high dynamic range, ultra detailed, subject in sharp focus with a slight depth-of-field falloff on the background.

The image contains only the character, the scene and the corner HUD: no other interface elements, no real logos, no real brand names, no watermark, and no additional people unless they were in the original photo.`;

export const LEGO_WORLD_PROMPT = `Rebuild this entire photograph as a scene made of real LEGO bricks, photographed like an official LEGO set render.

TURN THE PERSON INTO A LEGO MINIFIGURE while keeping them recognizable: a classic minifigure body — cylindrical head, C-shaped claw hands, short legs, blocky torso — but printed and colored to match this specific person. Keep the same skin tone as the minifigure head color, the same hairstyle and hair color rebuilt as a moulded LEGO hair piece or hat, and the same outfit reproduced as printed torso and leg decoration with matching colors. Keep the same pose as far as a minifigure's joints allow, the same head angle, and the same position, size and framing in the image. Do not change the camera angle or crop. Output the final image in the exact same aspect ratio, framing and crop as the input photograph — no cropping, no zooming, no added borders, bars or padding, no change to the composition.

REBUILD EVERYTHING ELSE IN BRICKS: reconstruct the whole environment out of visible LEGO elements — standard bricks, plates, tiles, slopes and specialty parts — with glossy injection-moulded plastic material, visible studs on exposed top surfaces, small sprue marks and fine mould seams, and the slight imperfect alignment of a hand-built model. Follow the real layout of the original scene closely so it reads as the same place rebuilt in LEGO. Ground becomes baseplates and tiles, terrain becomes stepped brick slopes, vegetation becomes LEGO plant pieces (leaf parts, flower studs, tree assemblies), water becomes trans-blue plates and tiles, vehicles become brick-built models.

ADAPT TO WHAT YOU SEE: city scenes use LEGO City parts, walls, windows and road plates; nature scenes use green baseplates, brick rockwork and LEGO trees; beaches use tan plates and trans-blue water; interiors use brick walls, tiled floors, brick-built furniture and printed decoration.

SKY AND LIGHT: keep the sky as a smooth photographic studio backdrop matching the original colors, not brick-built. Preserve the original lighting direction, warmth and shadow direction, rendered as clean product-photography light with soft shadows and gentle specular highlights on the plastic.

FINISH: crisp LEGO set box-art render — macro product photography look, shallow depth of field with the minifigure in sharp focus and the far bricks slightly soft, soft global illumination, subtle contact shadows under every brick, light bloom on glossy edges.

The final image contains only the minifigure and the brick-built world: no game interface, no LEGO logo, no set number, no text, no watermark, no real humans.`;
