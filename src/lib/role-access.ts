/**
 * 조회 권한 (visibleRoles) 유틸.
 *
 * 저장 형식: 양쪽을 콤마로 감싼 CSV — ",role1,role2,"
 *   substring 매칭 충돌(예: "고급" in "고급형") 방지를 위해 양쪽에 구분자.
 *   null/empty = 전체 공개.
 *
 * 사용:
 *   - 등록 시: encodeRoles(['role1', 'role2']) → ",role1,role2,"
 *   - 조회 필터: visibleRoles가 null이거나, 본인 역할 중 하나라도 매칭되면 보여줌
 */

export function encodeRoles(roles: string[] | null | undefined): string | null {
  if (!roles || roles.length === 0) return null;
  const cleaned = roles
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && !r.includes(","));
  if (cleaned.length === 0) return null;
  return `,${cleaned.join(",")},`;
}

export function decodeRoles(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseRoleNamesField(roleNames: string | null | undefined): string[] {
  // hi-rtk userEntity.roleNames 형식: "role1,role2" 또는 단일 "role"
  if (!roleNames) return [];
  return roleNames.split(",").map((s) => s.trim()).filter(Boolean);
}
