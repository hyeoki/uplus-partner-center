import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadAndShare } from "@/lib/nas";

/**
 * 리치 텍스트 에디터에서 이미지/파일 인라인 첨부용 업로드.
 * NAS Web Station 직링크 URL을 반환 → 에디터에 <img> 또는 <a>로 삽입.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  // 100MB 안전 가드
  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "파일이 너무 큽니다 (100MB 초과)." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { shareUrl } = await uploadAndShare(buffer, file.name);
    return NextResponse.json({
      url: shareUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      isImage: file.type.startsWith("image/"),
    });
  } catch (err) {
    console.error("[upload] NAS error:", err);
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }
}
