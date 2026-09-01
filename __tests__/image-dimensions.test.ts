/**
 * Tests du lecteur de dimensions server-side utilisé pour verrouiller le
 * ratio de sortie de gemini-3-pro-image sur celui de la photo source.
 */

import { describe, expect, it } from "vitest";
import { nearestAspectRatio, readImageSize } from "@/lib/image-dimensions";

/** PNG minimal : signature + chunk IHDR portant largeur/hauteur. */
function fakePng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(8);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d]), // longueur IHDR
    Buffer.from("IHDR"),
    ihdr,
    Buffer.alloc(16), // reste du chunk, non lu
  ]);
}

/** JPEG minimal : SOI puis un segment SOF0 avec hauteur/largeur. */
function fakeJpeg(width: number, height: number): Buffer {
  const dims = Buffer.alloc(4);
  dims.writeUInt16BE(height, 0);
  dims.writeUInt16BE(width, 2);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), // SOI
    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]), // SOF0, length, precision
    dims,
    Buffer.alloc(16),
  ]);
}

describe("readImageSize", () => {
  it("lit un PNG", () => {
    expect(readImageSize(fakePng(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("lit un JPEG", () => {
    expect(readImageSize(fakeJpeg(1200, 800))).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it("rend null sur des octets non reconnus", () => {
    expect(readImageSize(Buffer.alloc(40))).toBeNull();
  });

  it("rend null sur un buffer trop court", () => {
    expect(readImageSize(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe("nearestAspectRatio", () => {
  it.each([
    [1920, 1080, "16:9"],
    [1080, 1920, "9:16"],
    [1000, 1000, "1:1"],
    [4032, 3024, "4:3"],
    [3024, 4032, "3:4"],
    [1170, 2532, "9:16"], // iPhone, ultra-portrait -> ratio accepté le plus proche
  ])("%i x %i -> %s", (w, h, expected) => {
    expect(nearestAspectRatio(w, h)).toBe(expected);
  });

  it("rend null sur une dimension nulle", () => {
    expect(nearestAspectRatio(0, 500)).toBeNull();
  });
});
