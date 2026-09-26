import "server-only";

import { Buffer } from "node:buffer";
import sharp from "sharp";
import { InventoryError } from "./validation";

// Keep below Vercel Functions' 4.5 MB server-upload request limit, leaving
// room for multipart form data.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_IMAGE_PIXELS = 40_000_000;

/**
 * Validate an uploaded cover photo and read it into memory for object
 * storage. Returns undefined when no file was chosen.
 */
export async function imageUploadFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return undefined;
  if (value.size > MAX_IMAGE_BYTES) {
    throw new InventoryError("Image must be 4 MB or smaller.", key);
  }
  return normalizeImage(new Uint8Array(await value.arrayBuffer()), key);
}

/** Validate a client-cropped image produced by the organization logo editor. */
export function imageDataUrlFromValue(value: string) {
  if (!value) return undefined;
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    throw new InventoryError("Upload a JPG, PNG, or WebP image.", "logo");
  }
  // Base64 adds roughly one third overhead; keep the resulting value within
  // the same 4 MB input limit used by normal image uploads.
  if (value.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 128) {
    throw new InventoryError("Image must be 4 MB or smaller.", "logo");
  }
  return value;
}

/** Convert a validated data URL from the logo cropper into storage-ready bytes. */
export async function imageUploadFromDataUrl(value: string) {
  const dataUrl = imageDataUrlFromValue(value);
  if (!dataUrl) return undefined;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new InventoryError("Upload a JPG, PNG, or WebP image.", "logo");
  return normalizeImage(Buffer.from(match[2]!, "base64"), "logo");
}

/**
 * Decode the supplied bytes rather than trusting a browser-provided MIME
 * type, then create a metadata-free, size-bounded WebP derivative. This also
 * rejects malformed files and prevents storage from serving arbitrary bytes
 * under an image content type.
 */
async function normalizeImage(body: Uint8Array, field: string) {
  try {
    const image = sharp(body, {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
    });
    const metadata = await image.metadata();
    if (!metadata.format || !ACCEPTED_IMAGE_FORMATS.has(metadata.format) || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image format.");
    }
    const normalized = await image
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
    return { contentType: "image/webp", body: normalized };
  } catch {
    throw new InventoryError("Upload a valid JPG, PNG, or WebP image no larger than 40 megapixels.", field);
  }
}
