import { io } from "next/cache";
import { z } from "zod";

import { getOwner } from "@/lib/server/auth/owner";
import { StorageError } from "@/lib/server/db/errors";
import { log } from "@/lib/server/log";
import { articlePhotoFileBytes, articlePhotoFileInfo } from "@/lib/server/articles/photo-reads";

// Отдача фото статьи (ADR-0034, как фото блюда — ADR-0028). Имя файла — только из этого списка (в SQL не
// подставляется). Фото опубликованной статьи — всем, браузер держит 30 с и дальше переспрашивает (снятая статья
// пропадает, как страницы, ADR-0027); фото черновика и исходник для «Изменить кадр» — только владельцу; остальным — 404.
const FILES = { "480.webp": "w480", "960.webp": "w960", "1600.webp": "w1600", "og.jpg": "og", "source.jpg": "source" } as const;
const NOT_FOUND = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request, { params }: RouteContext<"/media/article/[photoId]/[file]">) {
  await io();
  const { photoId, file } = await params;
  const name = Object.hasOwn(FILES, file) ? FILES[file as keyof typeof FILES] : undefined;
  const id = z.uuid().safeParse(photoId);
  if (!name || !id.success) return NOT_FOUND();
  try {
    const info = await articlePhotoFileInfo(id.data, name);
    if (!info) return NOT_FOUND();
    const isPublic = info.published && name !== "source";
    if (!isPublic && !(await getOwner())) return NOT_FOUND();
    const etag = `"${id.data}-${name}"`;
    const headers = {
      "Content-Type": info.contentType,
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
      "Cache-Control": isPublic ? "public, max-age=30, must-revalidate" : "private, no-store",
    };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    const bytes = await articlePhotoFileBytes(id.data, name);
    if (!bytes) return NOT_FOUND();
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Length": String(bytes.length) } });
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.error("фото не отдано", { pg: error.code });
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
