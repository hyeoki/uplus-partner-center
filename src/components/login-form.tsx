"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      loginId: formData.get("loginId"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    } else {
      router.push("/home");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1.5">
          아이디
        </label>
        <input
          name="loginId"
          type="text"
          placeholder="아이디를 입력하세요"
          className="w-full h-10 border border-stone-200 rounded-lg px-3 text-sm outline-none focus:border-fuchsia-600 focus:ring-2 focus:ring-fuchsia-100 transition"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1.5">
          비밀번호
        </label>
        <input
          name="password"
          type="password"
          placeholder="비밀번호를 입력하세요"
          className="w-full h-10 border border-stone-200 rounded-lg px-3 text-sm outline-none focus:border-fuchsia-600 focus:ring-2 focus:ring-fuchsia-100 transition"
          required
        />
      </div>

      {error && <p className="text-xs text-fuchsia-600">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-10 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-medium"
      >
        {loading ? "로그인 중..." : "로그인"}
      </Button>
    </form>
  );
}
