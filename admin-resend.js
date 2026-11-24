// 관리자: 임시 비밀번호 메일 다시 보내기 — 화면 문구·표시 조건(순수 함수라 테스트로 확인)
// 메일 주소는 API 가 돌려준 마스킹 값만 그대로 보여 준다. 원문 메일·비밀번호는 만들지도 남기지도 않는다.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 사용 중(승인된) 계정에만 버튼을 보인다.
export const canResend = u => !!u && u.status === 'active';

export const resendName = u => String(u?.displayName || u?.loginId || '이 사용자').trim() || '이 사용자';

export const resendLabel = u => `${resendName(u)}님에게 임시 비밀번호 메일 다시 보내기`;

// 가입 승인 탭의 '승인 완료' 카드 버튼(신청 행 r: login_id·display_name·status). 승인 완료 카드에만.
export const regResendLabel = r => `${resendName({ displayName: r?.display_name, loginId: r?.login_id })}님의 임시 비밀번호 생성`;
export function regResendButton(r) {
  return r?.status === 'approved' ? `<button type="button" data-resend-reg="${esc(r.id)}" data-login="${esc(r.login_id)}" data-name="${esc(r.display_name)}" aria-label="${esc(regResendLabel(r))}">임시 비밀번호 생성</button>` : '';
}
// 신청 행에는 계정 id 가 없어 로그인 이메일(login_id, 유일)로 사용자 목록에서 찾는다. 없으면 404, 사용 중이 아니면 409 로 같은 오류 안내를 쓴다.
export function findAccountId(users, loginId) {
  const key = String(loginId ?? '').trim().toLowerCase();
  const u = (users ?? []).find(x => String(x.loginId ?? '').trim().toLowerCase() === key);
  if (!u) throw Object.assign(new Error('NOT_FOUND'), { status: 404 });
  if (u.status !== 'active') throw Object.assign(new Error('NOT_ACTIVE'), { status: 409 });
  return u.id;
}

export const resendConfirmHtml = u => `<h2>임시 비밀번호 메일 다시 보내기</h2><p>${esc(resendName(u))}님에게 새 임시 비밀번호를 메일로 보낼까요? 기존 비밀번호는 더 이상 쓸 수 없어요.</p>`;

// API 응답에서 마스킹된 주소만 꺼낸다(필드 이름이 달라도 문자열이면 그대로)
export const maskedOf = r => { const v = r?.maskedEmail ?? r?.masked ?? r?.to ?? r?.email ?? null; return typeof v === 'string' && v ? v : ''; };

export const resendDone = (u, r) => { const m = maskedOf(r); return `${resendName(u)}님의 새 임시 비밀번호를 만들었어요${m ? ` (${m})` : ''}. 메일 앱에서 직접 보내 주세요. 기존 비밀번호는 더 이상 쓸 수 없어요.`; };

export function resendFail(e) {
  const s = e?.status;
  const lost = ' 비밀번호를 확인하지 못했다면 1분 뒤에 다시 발급해 주세요.';
  if (s === 429) {
    const t = Number(e.retryAfterSeconds);
    if (e.reason === 'day') return '오늘은 이 계정에 더 보낼 수 없어요(하루 5번). 내일 다시 시도해 주세요.';
    return `같은 계정에는 1분에 한 번만 보낼 수 있어요. ${Number.isFinite(t) && t > 0 ? `${Math.ceil(t)}초 뒤에` : '잠시 후'} 다시 시도해 주세요.`;
  }
  if (s === 404) return '계정을 찾을 수 없어요. 목록을 새로 고친 뒤 다시 확인해 주세요.';
  if (s === 409) return '지금은 이 계정에 보낼 수 없어요. 사용 중인 계정인지 확인해 주세요.';
  if (s === 400 || s === 422) return '요청을 처리하지 못했어요. 목록을 새로 고친 뒤 다시 시도해 주세요.';
  if (s === 401 || s === 403) return '권한이 없거나 로그인이 만료됐어요. 다시 로그인해 주세요.';
  if (s === 0) return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.' + lost;
  return '새 임시 비밀번호를 만들지 못했어요. 잠시 후 다시 시도해 주세요.' + lost;
}
