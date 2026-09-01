/**
 * Lecture des dimensions d'une image depuis ses octets bruts, sans
 * dépendance. Couvre PNG, JPEG et WebP — les seuls formats que l'upload
 * accepte. Renvoie `null` si le format n'est pas reconnu : l'appelant
 * retombe alors sur le comportement par défaut du modèle.
 *
 * Sert à `generateGeminiImage` : gemini-3-pro-image ne garde pas toujours
 * le cadrage de la photo source sans consigne explicite. On lit le ratio
 * réel ici pour le lui imposer via `imageConfig.aspectRatio`.
 */
export function readImageSize(
  bytes: Buffer,
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;

  // PNG : signature 8 octets (89 50 4E 47), puis le chunk IHDR dont les
  // octets 16..23 portent largeur et hauteur en big-endian.
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  // JPEG : suite de segments préfixés 0xFF ; on avance jusqu'au marqueur
  // SOF (Start Of Frame) qui contient les dimensions.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 && // DHT
        marker !== 0xc8 && // JPG
        marker !== 0xcc; // DAC
      if (isSof) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      const segmentLength = bytes.readUInt16BE(offset + 2);
      if (segmentLength < 2) return null;
      offset += 2 + segmentLength;
    }
    return null;
  }

  // WebP : conteneur RIFF ("RIFF" ... "WEBP"), trois variantes de chunk.
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const format = bytes.toString("ascii", 12, 16);
    if (format === "VP8 " && bytes.length >= 30) {
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (format === "VP8L" && bytes.length >= 25) {
      const b = bytes.readUInt32LE(21);
      return {
        width: (b & 0x3fff) + 1,
        height: ((b >> 14) & 0x3fff) + 1,
      };
    }
    if (format === "VP8X" && bytes.length >= 30) {
      return {
        width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
        height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
      };
    }
  }

  return null;
}

/**
 * Ratios acceptés par gemini-3-pro-image. Toute autre valeur est refusée
 * par l'API, donc on ramène le ratio réel de la photo au plus proche de
 * cette liste (comparaison en échelle log : symétrique portrait/paysage).
 */
const SUPPORTED_ASPECT_RATIOS: { label: string; value: number }[] = [
  { label: "21:9", value: 21 / 9 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:2", value: 3 / 2 },
  { label: "4:3", value: 4 / 3 },
  { label: "5:4", value: 5 / 4 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:4", value: 3 / 4 },
  { label: "2:3", value: 2 / 3 },
  { label: "9:16", value: 9 / 16 },
];

/** Le label de ratio Gemini le plus proche du cadrage `width x height`. */
export function nearestAspectRatio(
  width: number,
  height: number,
): string | null {
  if (!(width > 0) || !(height > 0)) return null;
  const target = width / height;
  let best = SUPPORTED_ASPECT_RATIOS[0].label;
  let bestGap = Infinity;
  for (const ratio of SUPPORTED_ASPECT_RATIOS) {
    const gap = Math.abs(Math.log(ratio.value / target));
    if (gap < bestGap) {
      bestGap = gap;
      best = ratio.label;
    }
  }
  return best;
}
