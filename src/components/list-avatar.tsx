/**
 * 목록 행에서 작성자/사용자 이름 옆에 표시하는 작은 원형 아바타.
 * photoUrl 있으면 사진, 없으면 핑크 그라데이션 + 이니셜.
 */
export default function ListAvatar({
  name,
  photoUrl,
  size = 22,
}: {
  name: string | null | undefined;
  photoUrl?: string | null;
  size?: number;
}) {
  const initial = (name || "?").charAt(0).toUpperCase();
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name ?? ""}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, background: "#f3f4f5" }}
      />
    );
  }
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.floor(size * 0.5)),
        fontWeight: 600,
        background: "linear-gradient(135deg, #E6007E 0%, #ff5fa6 100%)",
        fontFamily: "var(--font-display)",
      }}
    >
      {initial}
    </div>
  );
}
