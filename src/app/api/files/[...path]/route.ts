import { NextRequest, NextResponse } from "next/server";
import { promises as fs, createReadStream, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { downloadFromNas } from "@/lib/nas";

/**
 * NAS 업로드 파일 다운로드 프록시.
 *
 * 동작:
 *   1) 같은 머신(NAS)에 배포된 경우 → NAS_UPLOAD_PATH 하위 파일을 로컬 fs에서 직접 스트리밍
 *   2) 로컬에 없으면 (dev 환경) → Synology FileStation Download API로 가져와 스트리밍
 *
 * 보안:
 *   - path traversal 방지: normalize 후 base 디렉토리 prefix 검사
 *   - 인증 체크는 일단 생략 (자료실 자료는 visibleRoles로 게이트되며, URL은 추측 어려운 timestamp 포함)
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const base = process.env.NAS_UPLOAD_PATH;
  if (!base) {
    return NextResponse.json({ error: "NAS_UPLOAD_PATH 미설정" }, { status: 500 });
  }
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "경로 누락" }, { status: 400 });
  }

  // URL 디코딩 (한글 파일명 대응) + path traversal 방지
  const decoded = segments.map((s) => decodeURIComponent(s));
  const relPath = decoded.join("/");
  const targetAbs = path.posix.normalize(path.posix.join(base, relPath));
  if (!targetAbs.startsWith(base + "/") && targetAbs !== base) {
    return NextResponse.json({ error: "잘못된 경로" }, { status: 400 });
  }

  const fileName = decoded[decoded.length - 1];
  const contentType = guessContentType(fileName);

  // 1차 시도: 로컬 파일시스템
  try {
    const stat = statSync(targetAbs);
    if (stat.isFile()) {
      const stream = createReadStream(targetAbs);
      // Node Readable → Web ReadableStream
      const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
      return new NextResponse(webStream, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(stat.size),
          "Content-Disposition": dispositionHeader(fileName),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  } catch {
    // 파일 없음 → 다음 단계로
  }

  // 2차 시도: FileStation Download API (dev에서 NAS 파일 접근용)
  try {
    const { stream, size } = await downloadFromNas(targetAbs);
    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentType,
        ...(size ? { "Content-Length": String(size) } : {}),
        "Content-Disposition": dispositionHeader(fileName),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[files] not found:", targetAbs, err);
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }
}

function dispositionHeader(name: string): string {
  // RFC 5987 — UTF-8 파일명 안전 인코딩 (한글 등)
  const encoded = encodeURIComponent(name);
  return `inline; filename*=UTF-8''${encoded}`;
}

function guessContentType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    txt: "text/plain; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    json: "application/json",
    zip: "application/zip",
    mp4: "video/mp4",
    mov: "video/quicktime",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    hwp: "application/x-hwp",
  };
  return map[ext] || "application/octet-stream";
}
