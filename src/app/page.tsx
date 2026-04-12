import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/home");

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="flex w-full max-w-[840px] min-h-[560px] rounded-xl overflow-hidden border border-stone-200 bg-white shadow-sm">
        {/* Left Panel */}
        <div className="hidden md:flex w-[42%] flex-col justify-between border-r border-stone-200 p-9">
          <div>
            <div className="text-xl font-medium text-stone-900 leading-snug mb-2">
              U+ 초정밀측위
              <br />
              파트너센터
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              파트너를 위한 공지사항, 자료실,
              <br />
              시스템 관리 서비스를 제공합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="h-1 w-16 rounded-full bg-fuchsia-600" />
            <div className="h-1 w-10 rounded-full bg-stone-200" />
            <div className="h-1 w-6 rounded-full bg-stone-200" />
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col justify-center p-10">
          <h1 className="text-xl font-medium mb-1">로그인</h1>
          <p className="text-sm text-stone-400 mb-6">
            파트너센터에 로그인하세요
          </p>

          <div className="bg-fuchsia-50 rounded-lg p-3 mb-5 flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-fuchsia-600 shrink-0" />
            <span className="text-xs text-fuchsia-800 leading-relaxed">
              테스트 계정: partner / 1234
            </span>
          </div>

          <LoginForm />

          <div className="flex gap-4 mt-6 text-xs text-stone-400">
            <span className="hover:text-stone-600 cursor-pointer">
              계정 문의 &rsaquo;
            </span>
            <span className="hover:text-stone-600 cursor-pointer">
              가입 신청 &rsaquo;
            </span>
            <span className="hover:text-stone-600 cursor-pointer">
              이용 안내 &rsaquo;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
