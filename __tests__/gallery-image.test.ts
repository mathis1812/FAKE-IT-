/**
 * Conversion du rendu en JPEG de livraison.
 *
 * Gemini renvoie du PNG RGBA : chaque génération pesait ~8 Mo en Storage et
 * au téléchargement. La régression serait silencieuse — un PNG stocké
 * n'échoue pas, il coûte — d'où ces tests.
 */

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { toDeliverableJpeg } from "@/lib/gallery-server";

/** PNG RGBA opaque, riche en dégradés pour que le JPEG ait de quoi gagner. */
async function makeRgbaPng(width = 320, height = 240): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = (x * 255) / width;
      pixels[i + 1] = (y * 255) / height;
      pixels[i + 2] = ((x + y) * 255) / (width + height);
      pixels[i + 3] = 255;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8;

describe("toDeliverableJpeg", () => {
  it("convertit un PNG RGBA en JPEG", async () => {
    const png = await makeRgbaPng();
    const result = await toDeliverableJpeg(png, "image/png");

    expect(result.mimeType).toBe("image/jpeg");
    expect(isJpeg(result.bytes)).toBe(true);
  });

  it("supprime le canal alpha", async () => {
    const png = await makeRgbaPng();
    expect((await sharp(png).metadata()).hasAlpha).toBe(true);

    const result = await toDeliverableJpeg(png, "image/png");
    const meta = await sharp(result.bytes).metadata();

    expect(meta.hasAlpha).toBe(false);
    expect(meta.channels).toBe(3);
  });

  it("préserve les dimensions", async () => {
    const png = await makeRgbaPng(320, 240);
    const result = await toDeliverableJpeg(png, "image/png");
    const meta = await sharp(result.bytes).metadata();

    expect(meta.width).toBe(320);
    expect(meta.height).toBe(240);
  });

  it("allège nettement le fichier", async () => {
    const png = await makeRgbaPng();
    const result = await toDeliverableJpeg(png, "image/png");

    expect(result.bytes.length).toBeLessThan(png.length);
  });

  it("laisse un JPEG intact plutôt que de le ré-encoder", async () => {
    const jpeg = await sharp(await makeRgbaPng()).jpeg().toBuffer();
    const result = await toDeliverableJpeg(jpeg, "image/jpeg");

    // Même référence d'octets : aucune perte de génération ajoutée.
    expect(result.bytes).toBe(jpeg);
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("rend les octets d'origine si l'encodage échoue", async () => {
    // Une génération payée ne doit jamais être perdue pour un octet illisible.
    const garbage = Buffer.from("pas une image du tout");
    const result = await toDeliverableJpeg(garbage, "image/png");

    expect(result.bytes).toBe(garbage);
    expect(result.mimeType).toBe("image/png");
  });
});
