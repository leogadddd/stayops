import "server-only";

import { Buffer } from "node:buffer";
import { InventoryError } from "./validation";

// Keep below Vercel Functions' 4.5 MB server-upload request limit, leaving
// room for multipart form data.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Keep a single small cover image alongside the record. This avoids coupling
 * inventory creation to a particular cloud storage provider while preserving
 * the uploaded file across application restarts.
 */
export async function imageDataUrlFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return undefined;
  if (!ACCEPTED_IMAGE_TYPES.has(value.type)) {
    throw new InventoryError("Upload a JPG, PNG, or WebP image.", key);
  }
  if (value.size > MAX_IMAGE_BYTES) {
    throw new InventoryError("Image must be 4 MB or smaller.", key);
  }
  const bytes = await value.arrayBuffer();
  return `data:${value.type};base64,${Buffer.from(bytes).toString("base64")}`;
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
export function imageUploadFromDataUrl(value: string) {
  const dataUrl = imageDataUrlFromValue(value);
  if (!dataUrl) return undefined;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new InventoryError("Upload a JPG, PNG, or WebP image.", "logo");
  return {
    contentType: match[1]!,
    body: Buffer.from(match[2]!, "base64"),
  };
}
