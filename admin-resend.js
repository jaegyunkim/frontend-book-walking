// 관리자: 임시 비밀번호 메일 다시 보내기 — 화면 문구·표시 조건(순수 함수라 테스트로 확인)
// 메일 주소는 API 가 돌려준 마스킹 값만 그대로 보여 준다. 원문 메일·비밀번호는 만들지도 남기지도 않는다.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 사용 중(승인된) 계정에만 버튼을 보인다.
export const canResend = u => !!u && u.status === 'active';

export const resendName = u => String(u?.displayName || u?.loginId || '이 사용자').trim() || '이 사용자';

export const resendLabel = u => `${resendName(u)}님에게 임시 비밀번호 메일 다시 보내기`;

export function resendButton(u) {
  return canResend(u) ? `<button type="button" data-a="resend" aria-label="${esc(resendLabel(u))}">임시 비밀번호 메일 다시 보내기</button>` : '';
}

export const resendConfirmHtml = u => `<h2>임시 비밀번호 메일 다시 보내기</h2><p>${esc(resendName(u))}님에게 새 임시 비밀번호를 메일로 보낼까요? 기존 비밀번호는 더 이상 쓸 수 없어요.</p>`;

// API 응답에서 마스킹된 주소만 꺼낸다(필드 이름이 달라도 문자열이면 그대로)
export const maskedOf = r => { const v = r?.maskedEmail ?? r?.masked ?? r?.to ?? r?.email ?? null; return typeof v === 'string' && v ? v : ''; };

export const resendDone = (u, r) => { const m = maskedOf(r); return `${resendName(u)}님의 새 임시 비밀번호를 만들었어요${m ? ` (${m})` : ''}. 메일 앱에서 직접 보내 주세요. 기존 비밀번호는 더 이상 쓸 수 없어요.`; };

export function resendFail(e) {
  const s = e?.status;
  if (s === 429) return '같은 계정에는 자주 보낼 수 없어요(1분에 한 번, 하루 5번). 잠시 후 다시 시도해 주세요.';
  if (s === 404) return '계정을 찾을 수 없어요. 목록을 새로 고친 뒤 다시 확인해 주세요.';
  if (s === 400 || s === 409 || s === 422) return '지금은 이 계정에 메일을 보낼 수 없어요. 사용 중인 계정인지 확인해 주세요.';
  if (s === 401 || s === 403) return '권한이 없거나 로그인이 만료됐어요. 다시 로그인해 주세요.';
  if (s === 0) return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  return '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요. 계속되면 서버 상태를 확인해 주세요.';
}
