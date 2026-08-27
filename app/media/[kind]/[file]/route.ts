import { readStoredImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/media/[kind]/[file]">) {
  const { kind, file } = await context.params;
  const image = await readStoredImage(`${kind}/${file}`);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "content-type": image.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
