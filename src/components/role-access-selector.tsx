"use client";

import { useEffect, useState } from "react";
import { listAvailableRoles } from "@/app/actions/roles";

/**
 * 등록 폼에서 사용하는 조회 권한 선택기.
 * - 역할 목록을 항상 체크박스로 표시 (다중 선택)
 * - 아무것도 선택하지 않으면 visibleRoles 빈 값 → 서버에서 전체 공개로 처리
 * - 옵션 = DB User.roleNames union (한 번이라도 로그인한 사용자의 역할들)
 */
export default function RoleAccessSelector({
  name = "visibleRoles",
  defaultValue = null,
}: {
  name?: string;
  /** 저장된 visibleRoles CSV (",role1,role2," 형식). 수정 모드에서 prefill 용. */
  defaultValue?: string | null;
}) {
  const [roles, setRoles] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (!defaultValue) return new Set();
    return new Set(defaultValue.split(",").map((s) => s.trim()).filter(Boolean));
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAvailableRoles()
      .then((list) => setRoles(list))
      .finally(() => setLoading(false));
  }, []);

  function toggle(r: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(roles));
  }
  function clear() {
    setSelected(new Set());
  }

  const value = selected.size > 0 ? [...selected].join(",") : "";
  const allSelected = roles.length > 0 && selected.size === roles.length;

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />

      <div
        className="rounded-xl p-3 max-h-52 overflow-y-auto"
        style={{ background: "#f8f9fa", border: "1px solid #e8e9ea" }}
      >
        {loading ? (
          <p className="text-xs" style={{ color: "#9ca3af" }}>역할 목록 불러오는 중…</p>
        ) : roles.length === 0 ? (
          <p className="text-xs" style={{ color: "#9ca3af" }}>
            등록된 역할이 없습니다. (hi-rtk 사용자가 한 번 이상 로그인해야 옵션에 표시됨)
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px]" style={{ color: "#9ca3af" }}>
                선택 {selected.size} / {roles.length}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={allSelected ? clear : selectAll}
                  className="text-[11px] px-2 py-0.5 rounded-md transition-colors"
                  style={{ color: "#4F4F4F", background: "#ffffff", border: "1px solid #e8e9ea" }}
                >
                  {allSelected ? "전체 해제" : "전체 선택"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => {
                const checked = selected.has(r);
                return (
                  <button
                    key={r}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(r)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer"
                    style={{
                      background: checked ? "rgba(230,0,126,0.10)" : "#ffffff",
                      color: checked ? "#E6007E" : "#4F4F4F",
                      borderColor: checked ? "#E6007E" : "#e8e9ea",
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <p className="text-[11px]" style={{ color: "#9ca3af" }}>
        선택한 역할에 해당하는 사용자만 조회할 수 있습니다. 선택하지 않으면 전체 공개됩니다.
      </p>
    </div>
  );
}
