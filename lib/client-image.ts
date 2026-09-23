/**
 * Browser-only helpers that keep multipart uploads under the hosting platform's request
 * body limit. The platform rejects oversized bodies with a plain-text 413 before our
 * route runs, so the only reliable fix is to send smaller files.
 */

const ENCODE_QUALITIES = [0.86, 0.78, 0.7, 0.6];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("IMAGE_DECODE_FAILED")); };
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renamed(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}${mime === "image/webp" ? ".webp" : mime === "image/jpeg" ? ".jpg" : ".png"}`;
}

/**
 * Returns the file unchanged when it already fits `maxBytes`. Otherwise redraws it at no
 * more than `maxDimension` pixels on the long edge and re-encodes it as WebP (JPEG when the
 * browser cannot encode WebP and transparency is not needed). Falls back to the original
 * file if the browser cannot decode or shrink it, so the server still gets a chance.
 */
export async function shrinkImageForUpload(file: File, options: { maxBytes: number; maxDimension: number; keepTransparency?: boolean }): Promise<File> {
  if (file.size <= options.maxBytes || typeof document === "undefined") return file;
  try {
    const image = await loadImage(file);
    let scale = Math.min(1, options.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    let best: Blob | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of ENCODE_QUALITIES) {
        let blob = await encode(canvas, "image/webp", quality);
        // Browsers that cannot encode WebP silently return PNG.
        if (blob?.type !== "image/webp") blob = options.keepTransparency ? await encode(canvas, "image/png", 1) : await encode(canvas, "image/jpeg", quality);
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= options.maxBytes) return new File([blob], renamed(file.name, blob.type), { type: blob.type });
        if (blob.type === "image/png") break;
      }
      scale *= 0.75;
    }
    return best && best.size < file.size ? new File([best], renamed(file.name, best.type), { type: best.type }) : file;
  } catch {
    return file;
  }
}

/** Reads a JSON error body, or explains the platform's plain-text rejections. */
export async function readJsonResponse<T extends object>(response: Response): Promise<T & { error?: string }> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    if (response.status === 413) return { error: "Your images are too large to upload together. Use fewer or smaller screenshots and try again." } as T & { error?: string };
    return { error: response.ok ? "Unexpected response from the server. Please try again." : `The server could not process the request (${response.status}). Please try again.` } as T & { error?: string };
  }
}
