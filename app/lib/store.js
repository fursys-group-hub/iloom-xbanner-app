/**
 * Supabase 저장소 + 로그인 세션 (서버 전용)
 * - Supabase PostgREST 를 service_role 키로 호출 (public 스키마, xbanner_ 접두)
 * - 비밀번호는 bcrypt 해시로만 저장, 세션은 HMAC 서명 토큰(무상태)
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const URL    = process.env.SUPABASE_URL;
const KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
if (URL && KEY && !process.env.SESSION_SECRET) {
  console.warn('⚠️ SESSION_SECRET 미설정 — 약한 기본값 사용 중. 운영에서는 반드시 환경변수로 설정하세요(토큰 위조 위험).');
}

export const storeReady = !!(URL && KEY);

const REST = `${URL}/rest/v1`;
const baseHeaders = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...baseHeaders };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${REST}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.message) ? data.message : `Supabase ${res.status}`;
    const err = new Error(msg);
    err.status = res.status; err.detail = data;
    throw err;
  }
  return data;
}

// ───────── 세션 토큰 (HMAC 서명, 무상태) ─────────
function b64u(s) { return Buffer.from(s).toString('base64url'); }
function sign(payloadObj) {
  const p = b64u(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  return `${p}.${sig}`;
}
export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [p, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()); } catch { return null; }
}

// ───────── 사용자 / 로그인 ─────────
const cleanName = (n) => String(n || '').trim();

export async function findUser(name) {
  const rows = await sb(`xbanner_users?name=eq.${encodeURIComponent(cleanName(name))}&select=*`);
  return rows?.[0] || null;
}

// 로그인 또는 신규 가입(이름 처음이면 비밀번호 설정) — 일룸 표준 2단계 UX
export async function loginOrSignup(name, password) {
  const n = cleanName(name);
  if (n.length < 1) return { error: '이름을 입력해 주세요.' };
  if (!password || password.length < 4) return { error: '비밀번호는 4자 이상으로 해주세요.' };

  const existing = await findUser(n);
  if (existing) {
    const ok = await bcrypt.compare(password, existing.pass_hash);
    if (!ok) return { error: '비밀번호가 일치하지 않아요.' };
    return { user: existing, token: sign({ uid: existing.id, name: n }), isNew: false };
  }
  // 신규 가입
  const pass_hash = await bcrypt.hash(password, 10);
  const created = await sb('xbanner_users', { method: 'POST', body: { name: n, pass_hash }, prefer: 'return=representation' });
  const user = created?.[0];
  return { user, token: sign({ uid: user.id, name: n }), isNew: true };
}

// ───────── 배너 저장소 ─────────
export async function listBanners(uid) {
  // data 포함 — 갤러리에서 저장된 내용으로 미니 미리보기를 그리기 위함
  return sb(`xbanner_banners?user_id=eq.${enc(uid)}&select=id,title,share_id,updated_at,data&order=updated_at.desc`);
}
export async function getBanner(uid, id) {
  const rows = await sb(`xbanner_banners?id=eq.${enc(id)}&user_id=eq.${enc(uid)}&select=*`);
  return rows?.[0] || null;
}
export async function getSharedBanner(shareId) {
  const rows = await sb(`xbanner_banners?share_id=eq.${encodeURIComponent(shareId)}&select=title,data`);
  return rows?.[0] || null;
}
function newShareId() { return crypto.randomBytes(9).toString('base64url'); }
const enc = (v) => encodeURIComponent(String(v ?? ''));   // PostgREST 쿼리 값 안전 처리

export async function saveBanner(uid, { id, title, data, thumb }) {
  const now = new Date().toISOString();
  if (id) {   // 기존 갱신 (본인 것만)
    const rows = await sb(`xbanner_banners?id=eq.${enc(id)}&user_id=eq.${enc(uid)}`, {
      method: 'PATCH', prefer: 'return=representation',
      body: { title, data, thumb, updated_at: now },
    });
    return rows?.[0] || null;
  }
  const rows = await sb('xbanner_banners', {   // 신규
    method: 'POST', prefer: 'return=representation',
    body: { user_id: uid, title, data, thumb, share_id: newShareId(), updated_at: now },
  });
  return rows?.[0] || null;
}
export async function deleteBanner(uid, id) {
  await sb(`xbanner_banners?id=eq.${enc(id)}&user_id=eq.${enc(uid)}`, { method: 'DELETE', prefer: 'return=minimal' });
  return true;
}
