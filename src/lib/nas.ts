/**
 * Synology FileStation API 클라이언트.
 *
 * 사용 흐름:
 *   1) login() → sid 획득
 *   2) uploadFile(sid, ...) → NAS에 파일 저장
 *   3) createShareLink(sid, ...) → 공개 다운로드 URL 생성
 *   4) logout(sid) (선택)
 *
 * 한 번의 업로드 흐름은 uploadAndShare()로 래핑되어 있어 호출자는 그것만 쓰면 됩니다.
 */

const BASE_URL = process.env.NAS_BASE_URL!;
const USER = process.env.NAS_USER!;
const PASSWORD = process.env.NAS_PASSWORD!;
const UPLOAD_PATH = process.env.NAS_UPLOAD_PATH!;
const PUBLIC_BASE_URL = process.env.NAS_PUBLIC_BASE_URL!;

type SynologyResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: number };
};

function assertEnv() {
  if (!BASE_URL || !USER || !PASSWORD || !UPLOAD_PATH || !PUBLIC_BASE_URL) {
    throw new Error("[nas] NAS_* 환경변수가 누락되었습니다.");
  }
}

async function dsmFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`[nas] HTTP ${res.status} ${res.statusText} (${url})`);
  }
  const json = (await res.json()) as SynologyResponse<T>;
  if (!json.success) {
    throw new Error(`[nas] DSM error code ${json.error?.code} (${url})`);
  }
  return json.data as T;
}

/** 1) DSM 로그인 → sid */
async function login(): Promise<string> {
  assertEnv();
  const params = new URLSearchParams({
    api: "SYNO.API.Auth",
    version: "3",
    method: "login",
    account: USER,
    passwd: PASSWORD,
    session: "FileStation",
    format: "sid",
  });
  const data = await dsmFetch<{ sid: string }>(`${BASE_URL}/webapi/auth.cgi?${params}`);
  return data.sid;
}

/** 4) DSM 로그아웃 (실패해도 무시) */
async function logout(sid: string): Promise<void> {
  try {
    const params = new URLSearchParams({
      api: "SYNO.API.Auth",
      version: "3",
      method: "logout",
      session: "FileStation",
      _sid: sid,
    });
    await fetch(`${BASE_URL}/webapi/auth.cgi?${params}`, { cache: "no-store" });
  } catch {
    /* ignore */
  }
}

/** 2) FileStation 업로드. `dir`(상대경로)을 UPLOAD_PATH 아래 생성하고 그 안에 fileName으로 저장. */
async function uploadFile(
  sid: string,
  dir: string,
  buffer: Buffer,
  fileName: string,
): Promise<{ path: string }> {
  const targetDir = `${UPLOAD_PATH}/${dir}`;
  const form = new FormData();
  form.append("api", "SYNO.FileStation.Upload");
  form.append("version", "2");
  form.append("method", "upload");
  form.append("path", targetDir);
  form.append("create_parents", "true");
  form.append("overwrite", "true");
  // Web Fetch FormData는 Blob을 받음
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/octet-stream" }),
    fileName,
  );

  const res = await fetch(`${BASE_URL}/webapi/entry.cgi?_sid=${encodeURIComponent(sid)}`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`[nas] upload HTTP ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as SynologyResponse<unknown>;
  if (!json.success) {
    throw new Error(`[nas] upload DSM error code ${json.error?.code}`);
  }

  return { path: `${targetDir}/${fileName}` };
}

/**
 * 업로드한 파일의 공개 다운로드 URL을 만든다.
 *
 * 업로드 경로가 NAS의 Web Station 루트(`/web/...`) 아래에 있으면
 * `https://{host}/{name}/{dir}/{file}` 형태로 인증 없이 직접 접근 가능하므로
 * Synology 공유링크(랜딩 페이지) 대신 이 직링크를 반환한다.
 *
 * cross-origin 환경에서는 브라우저가 <a download> attribute를 무시하므로
 * URL의 마지막 segment(=실제 파일명)가 그대로 다운로드 파일명이 된다.
 * 따라서 한글이 포함된 원본 파일명을 그대로 보존하는 것이 중요하다.
 */
function publicUrlFor(dir: string, fileName: string): string {
  return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(dir)}/${encodeURIComponent(fileName)}`;
}

/**
 * 외부 진입점: 파일을 NAS에 업로드하고 공개 다운로드 URL을 반환한다.
 *
 * 동작:
 *   1) `{UPLOAD_PATH}/{timestamp}/` 하위에 원본 파일명 그대로 저장
 *   2) 다운로드 URL은 마지막 segment가 원본 파일명이므로 한글 보존됨
 *   3) timestamp 폴더가 충돌 방지 역할 (동일 이름 업로드해도 덮어쓰지 않음)
 *
 * - shareUrl: 브라우저에서 바로 다운로드 가능한 직링크 (Web Station 경유)
 * - nasPath: NAS 내부 절대경로 (관리/추적용)
 */
export async function uploadAndShare(
  buffer: Buffer,
  fileName: string,
): Promise<{ shareUrl: string; nasPath: string }> {
  assertEnv();
  const sid = await login();
  try {
    const dir = String(Date.now());
    const { path } = await uploadFile(sid, dir, buffer, fileName);
    return { shareUrl: publicUrlFor(dir, fileName), nasPath: path };
  } finally {
    await logout(sid);
  }
}
