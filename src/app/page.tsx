import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/home");

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "#f8f9fa" }}>
      <div
        className="flex w-full max-w-[860px] min-h-[580px] rounded-2xl overflow-hidden"
        style={{ boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
      >
        {/* Left Panel */}
        <div
          className="hidden md:flex w-[42%] flex-col justify-between p-10"
          style={{ background: "#ffffff" }}
        >
          <div>
            <Image
              src="/logo.svg"
              alt="U+ 초정밀측위"
              width={180}
              height={36}
              className="object-contain mb-1.5"
              priority
            />
            <div
              className="text-base font-semibold mb-3"
              style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
            >
              파트너센터
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#4F4F4F" }}>
              파트너를 위한 모든 자료를 여기서 확인해보세요!
            </p>
          </div>

          {/* Bottom progress bar */}
          <div className="flex gap-2">
            <div className="h-1 w-16 rounded-full" style={{ background: "#E6007E" }} />
            <div className="h-1 w-10 rounded-full" style={{ background: "#e8e9ea" }} />
            <div className="h-1 w-6 rounded-full" style={{ background: "#e8e9ea" }} />
          </div>
        </div>

        {/* Right Panel */}
        <div
          className="flex-1 flex flex-col justify-center px-6 md:px-12 py-10"
          style={{ background: "#f8f9fa" }}
        >
          {/* 모바일 전용 헤더 — 좌측 패널이 숨겨질 때 상단 표시 */}
          <div className="md:hidden mb-10 flex flex-col items-center">
            <Image
              src="/logo.svg"
              alt="U+ 초정밀측위"
              width={240}
              height={48}
              className="object-contain mb-2"
              priority
            />
            <div
              className="text-base font-semibold"
              style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
            >
              파트너센터
            </div>
          </div>

          <h1
            className="text-2xl font-bold mb-8"
            style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
          >
            로그인
          </h1>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
