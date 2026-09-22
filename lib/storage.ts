import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { config } from "./config";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type ImageKind = "logo" | "screenshot" | "update" | "launch-kit";
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
function jpegDimensions(bytes:Uint8Array):[number,number]|null{let offset=2;while(offset+9<bytes.length){if(bytes[offset]!==0xff){offset++;continue;}const marker=bytes[offset+1];const length=(bytes[offset+2]<<8)+bytes[offset+3];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return[(bytes[offset+7]<<8)+bytes[offset+8],(bytes[offset+5]<<8)+bytes[offset+6]];if(length<2)return null;offset+=2+length;}return null;}
function webpDimensions(bytes:Uint8Array):[number,number]|null{const kind=String.fromCharCode(...bytes.slice(12,16));if(kind==="VP8X"&&bytes.length>=30)return[1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)];return null;}

function dimensions(bytes: Uint8Array, mime: StoredImage["mimeType"]): [number, number] | null {
  return mime === "image/png" ? pngDimensions(bytes) : mime === "image/jpeg" ? jpegDimensions(bytes) : webpDimensions(bytes);
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

function s3Client(): S3Client {
  const s3=config.upload.s3;
  if(!s3.region||!s3.bucket||!s3.accessKeyId||!s3.secretAccessKey||!s3.publicBaseUrl)throw new Error("UPLOAD_STORAGE_UNAVAILABLE");
  return new S3Client({region:s3.region,endpoint:s3.endpoint||undefined,forcePathStyle:s3.forcePathStyle,credentials:{accessKeyId:s3.accessKeyId,secretAccessKey:s3.secretAccessKey}});
}

export async function validateAndStoreImage(file: File, kind: ImageKind): Promise<StoredImage> {
  if (!['local','s3'].includes(config.upload.driver) || (process.env.NODE_ENV === "production" && config.upload.driver === "local")) throw new Error("UPLOAD_STORAGE_UNAVAILABLE");
  const max = kind === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size <= 0 || file.size > max) throw new Error(kind === "logo" ? "LOGO_TOO_LARGE" : "IMAGE_TOO_LARGE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageType(bytes);
  if (!mime) throw new Error("UNSUPPORTED_IMAGE_TYPE");
  if(file.type&&file.type!==mime)throw new Error("IMAGE_TYPE_MISMATCH");
  const suppliedExtension=extname(file.name).toLowerCase();
  if(suppliedExtension&&!((mime==="image/png"&&suppliedExtension===".png")||(mime==="image/jpeg"&&[".jpg",".jpeg"].includes(suppliedExtension))||(mime==="image/webp"&&suppliedExtension===".webp")))throw new Error("IMAGE_EXTENSION_MISMATCH");
  const measured = dimensions(bytes, mime);
  if (measured && (measured[0] > 6000 || measured[1] > 6000 || measured[0] * measured[1] > 24_000_000)) {
    throw new Error("IMAGE_DIMENSIONS_TOO_LARGE");
  }
  const key = `${kind}/${randomUUID()}${extension(mime)}`;
  let publicUrl:string;
  if(config.upload.driver==="s3"){
    const s3=config.upload.s3;await s3Client().send(new PutObjectCommand({Bucket:s3.bucket,Key:key,Body:bytes,ContentType:mime,CacheControl:"public, max-age=31536000, immutable"}));publicUrl=`${s3.publicBaseUrl.replace(/\/$/,"")}/${key}`;
  }else{await mkdir(resolve(localRoot(), kind), { recursive: true });await writeFile(localPath(key), bytes, { flag: "wx" });publicUrl=`/media/${key}`;}
  return { storageKey: key, publicUrl, mimeType: mime, byteSize: bytes.length, width: measured?.[0] ?? null, height: measured?.[1] ?? null };
}

export async function readStoredImage(key: string): Promise<{ bytes: Buffer; mimeType: StoredImage["mimeType"] } | null> {
  if (!/^(?:logo|screenshot|update|launch-kit)\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(key)) return null;
  try {
    const bytes = config.upload.driver === "s3"
      ? Buffer.from(await (await s3Client().send(new GetObjectCommand({ Bucket: config.upload.s3.bucket, Key: key }))).Body!.transformToByteArray())
      : await readFile(localPath(key));
    const mime = imageType(bytes);
    return mime ? { bytes, mimeType: mime } : null;
  } catch {
    return null;
  }
}

export async function removeStoredImage(key: string): Promise<void> {
  if(!extname(key)||!/^(?:logo|screenshot|update|launch-kit)\//.test(key))return;
  if(config.upload.driver==="s3"){await s3Client().send(new DeleteObjectCommand({Bucket:config.upload.s3.bucket,Key:key})).catch(()=>{});return;}
  await unlink(localPath(key)).catch(() => {});
}
