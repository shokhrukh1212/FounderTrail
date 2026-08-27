import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { config } from "./config";

type ImageKind = "logo" | "screenshot" | "update";
export type StoredImage = {
  storageKey: string;
  publicUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  width: number | null;
  height: number | null;
};

function imageType(bytes: Uint8Array): StoredImage["mimeType"] | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function pngDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function dimensions(bytes: Uint8Array, mime: StoredImage["mimeType"]): [number, number] | null {
  return mime === "image/png" ? pngDimensions(bytes) : null;
}

function extension(mime: StoredImage["mimeType"]): string {
  return mime === "image/png" ? ".png" : mime === "image/jpeg" ? ".jpg" : ".webp";
}

function localRoot(): string {
  return resolve(process.cwd(), config.upload.localDirectory);
}

function localPath(key: string): string {
  const root = localRoot();
  const target = resolve(root, key);
  if (!target.startsWith(`${root}${sep}`)) throw new Error("INVALID_STORAGE_KEY");
  return target;
}

export async function validateAndStoreImage(file: File, kind: ImageKind): Promise<StoredImage> {
  if (process.env.NODE_ENV === "production" || config.upload.driver !== "local") throw new Error("UPLOAD_STORAGE_UNAVAILABLE");
  const max = kind === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size <= 0 || file.size > max) throw new Error(kind === "logo" ? "LOGO_TOO_LARGE" : "IMAGE_TOO_LARGE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageType(bytes);
  if (!mime) throw new Error("UNSUPPORTED_IMAGE_TYPE");
  const measured = dimensions(bytes, mime);
  if (measured && (measured[0] > 6000 || measured[1] > 6000 || measured[0] * measured[1] > 24_000_000)) {
    throw new Error("IMAGE_DIMENSIONS_TOO_LARGE");
  }
  const key = `${kind}/${randomUUID()}${extension(mime)}`;
  await mkdir(resolve(localRoot(), kind), { recursive: true });
  await writeFile(localPath(key), bytes, { flag: "wx" });
  return { storageKey: key, publicUrl: `/media/${key}`, mimeType: mime, byteSize: bytes.length, width: measured?.[0] ?? null, height: measured?.[1] ?? null };
}

export async function readStoredImage(key: string): Promise<{ bytes: Buffer; mimeType: StoredImage["mimeType"] } | null> {
  if (!/^(?:logo|screenshot|update)\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(key)) return null;
  try {
    const bytes = await readFile(localPath(key));
    const mime = imageType(bytes);
    return mime ? { bytes, mimeType: mime } : null;
  } catch {
    return null;
  }
}

export async function removeStoredImage(key: string): Promise<void> {
  if (extname(key) && /^(?:logo|screenshot|update)\//.test(key)) await unlink(localPath(key)).catch(() => {});
}
