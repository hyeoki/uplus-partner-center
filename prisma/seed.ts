import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 사용자
  const partner = await prisma.user.upsert({
    where: { loginId: "partner" },
    update: {},
    create: {
      loginId: "partner",
      password: "1234",
      name: "김대리점",
      grade: "골드",
      role: "partner",
    },
  });

  const admin = await prisma.user.upsert({
    where: { loginId: "admin" },
    update: {},
    create: {
      loginId: "admin",
      password: "admin1234",
      name: "관리자",
      grade: "관리자",
      role: "admin",
    },
  });

  // 카테고리
  const categories = [
    { name: "소개서", colorId: "blue", sortOrder: 0 },
    { name: "브로슈어", colorId: "green", sortOrder: 1 },
    { name: "제품 데이터시트", colorId: "amber", sortOrder: 2 },
    { name: "사용자 가이드", colorId: "sky", sortOrder: 3 },
    { name: "기타", colorId: "gray", sortOrder: 4, active: false },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: categories.indexOf(cat) + 1 },
      update: {},
      create: cat,
    });
  }

  // 공지사항
  const notices = [
    { title: "OTP 인증 의무화 안내 (5월 적용)", tag: "중요", pinned: true, content: "2025년 5월부터 모든 파트너 계정에 OTP 인증이 의무화됩니다." },
    { title: "2025년 파트너 등급 평가 기준 변경", tag: "중요", pinned: true, content: "파트너 등급 평가 기준이 변경되었습니다. 자세한 내용을 확인해 주세요." },
    { title: "4월 정기 시스템 점검 일정 안내", tag: "시스템", pinned: false, content: "4월 정기 시스템 점검이 예정되어 있습니다." },
    { title: "초정밀측위 서비스 매뉴얼 v2.3 배포", tag: "일반", pinned: false, content: "초정밀측위 서비스 매뉴얼 v2.3이 배포되었습니다." },
    { title: "파트너 포털 이용약관 개정 안내", tag: "정책", pinned: false, content: "이용약관이 개정되었습니다." },
    { title: "신규 API 엔드포인트 추가 안내", tag: "시스템", pinned: false, content: "신규 API 엔드포인트가 추가되었습니다." },
    { title: "2025년 상반기 교육 일정 안내", tag: "일반", pinned: false, content: "상반기 교육 일정을 안내드립니다." },
    { title: "긴급 보안 패치 적용 안내", tag: "중요", pinned: true, content: "긴급 보안 패치가 적용되었습니다." },
  ];

  for (const notice of notices) {
    await prisma.notice.create({
      data: { ...notice, authorId: admin.id },
    });
  }

  // 자료실
  const archives = [
    { title: "U+ 초정밀측위 서비스 소개서 2025", type: "file", ext: "PDF", size: "4.2 MB", categoryId: 1, downloads: 128 },
    { title: "초정밀측위 파트너 영업 브로슈어 v2", type: "file", ext: "PDF", size: "8.7 MB", categoryId: 2, downloads: 74 },
    { title: "RTK 모듈 제품 데이터시트 (HW-300)", type: "file", ext: "PDF", size: "2.1 MB", categoryId: 3, downloads: 43 },
    { title: "초정밀측위 서비스 매뉴얼 v2.3", type: "file", ext: "PDF", size: "12.4 MB", categoryId: 4, downloads: 201 },
    { title: "건설·물류 업종별 활용 사례집", type: "file", ext: "PDF", size: "6.3 MB", categoryId: 2, downloads: 56 },
    { title: "API 연동 개발 가이드 (REST)", type: "file", ext: "PDF", size: "3.5 MB", categoryId: 4, downloads: 89 },
    { title: "초정밀측위 서비스 요금제 안내서", type: "file", ext: "PPT", size: "5.9 MB", categoryId: 1, downloads: 112 },
  ];

  for (const archive of archives) {
    await prisma.archive.create({ data: archive });
  }

  console.log("Seed completed!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
