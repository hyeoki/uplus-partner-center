// 자료실 카테고리 색상 팔레트 — Category.colorId가 이 id 중 하나를 참조.
// 화면에선 항상 이 모듈 통해 bg/color를 lookup.

export type CategoryColorDef = {
  id: string;
  label: string;
  bg: string;
  color: string;
  swatch: string; // 컬러 피커 표시용 진한 색
};

export const CATEGORY_COLORS: CategoryColorDef[] = [
  { id: "pink",   label: "핑크",   bg: "rgba(230,0,126,0.10)", color: "#E6007E", swatch: "#E6007E" },
  { id: "purple", label: "보라",   bg: "rgba(87,38,226,0.10)", color: "#5726E2", swatch: "#5726E2" },
  { id: "blue",   label: "파랑",   bg: "rgba(56,167,218,0.12)", color: "#1d6fa5", swatch: "#38A7DA" },
  { id: "green",  label: "초록",   bg: "rgba(22,163,74,0.10)", color: "#16a34a", swatch: "#16a34a" },
  { id: "orange", label: "주황",   bg: "rgba(255,153,0,0.12)", color: "#c97400", swatch: "#FF9900" },
  { id: "red",    label: "빨강",   bg: "rgba(220,38,38,0.10)", color: "#dc2626", swatch: "#dc2626" },
  { id: "gray",   label: "회색",   bg: "#e8e9ea",               color: "#4F4F4F", swatch: "#6b7280" },
];

const FALLBACK = CATEGORY_COLORS[CATEGORY_COLORS.length - 1]; // gray

export function getCategoryColor(colorId: string | null | undefined): CategoryColorDef {
  if (!colorId) return FALLBACK;
  return CATEGORY_COLORS.find((c) => c.id === colorId) ?? FALLBACK;
}
