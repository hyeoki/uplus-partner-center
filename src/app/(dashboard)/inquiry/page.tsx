import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isCurrentUserAdmin } from "@/lib/admin";
import InquiryShell from "@/components/inquiry-shell";

export default async function InquiryPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = await isCurrentUserAdmin();

  // 모든 글을 가져오되, 다른 사용자의 비밀글은 본문/답변을 가린 상태로 전달.
  // admin/작성자는 비밀글이라도 그대로 조회 가능.
  const [inquiries, adminUser] = userId
    ? await Promise.all([
        prisma.inquiry.findMany({
          orderBy: [{ createdAt: "desc" }],
          include: { user: { select: { name: true, loginId: true, photoUrl: true } } },
        }),
        // 답변자(관리자) 프로필 사진 — admin 1명 가정
        prisma.user.findFirst({
          where: { role: "admin" },
          select: { name: true, photoUrl: true },
        }),
      ])
    : [[], null];

  const rows = inquiries.map((q) => {
    const isMine = q.userId === userId;
    const canViewBody = isAdmin || isMine || !q.isPrivate;
    return {
      id: q.id,
      category: q.category,
      title: canViewBody ? q.title : "비밀글입니다.",
      content: canViewBody ? q.content : "작성자와 관리자만 내용을 볼 수 있어요.",
      status: q.status,
      isPrivate: q.isPrivate,
      isMine,
      canViewBody,
      reply: canViewBody ? q.reply : null,
      replyAt: canViewBody && q.replyAt ? q.replyAt.toISOString() : null,
      createdAt: q.createdAt.toISOString(),
      user: q.user,
    };
  });

  return (
    <div className="w-full">
      <InquiryShell
        inquiries={rows}
        isAdmin={isAdmin}
        adminProfile={adminUser ? { name: adminUser.name, photoUrl: adminUser.photoUrl } : null}
      />
    </div>
  );
}
