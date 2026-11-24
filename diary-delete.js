// 걷기 일기 삭제 — 화면 문구·버튼 모양(순수 함수라 테스트로 확인)
// API: DELETE /v1/me/walks/:id (책장 삭제와 같은 형태). 실패 문구는 서버 메시지가 있으면 그대로, 없으면 쉬운 한국어.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const walkDate = w => String(w?.walkedOn ?? '').slice(0, 10);
export const walkCourse = w => String(w?.courseName ?? '').trim() || '코스 없음';

// 스크린리더가 어느 기록인지 알 수 있게 날짜·코스 이름을 넣는다(사용자 이름은 넣지 않음).
export const deleteLabel = w => `${walkDate(w) ? walkDate(w) + ' ' : ''}${walkCourse(w)} 일기 삭제`;

export const deleteButton = w => (w?.id == null ? '' :
  `<div class="acts diary-acts"><button type="button" class="ghost small danger" data-walk-del="${esc(w.id)}" aria-label="${esc(deleteLabel(w))}">삭제</button></div>`);

// 확인 창 본문(날짜·코스 이름이 있으면 함께)
export const confirmText = w => `${[walkDate(w), walkCourse(w)].filter(Boolean).join(' · ')}\n이 일기를 삭제할까요? 삭제하면 되돌릴 수 없어요.`;

export const DONE_MSG = '일기를 삭제했어요';
export const failMsg = e => (e && e.message && e.status !== 0 ? e.message : '') || '일기를 삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
