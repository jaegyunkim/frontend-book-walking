import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deleteButton, deleteLabel, confirmText, failMsg, DONE_MSG } from '../diary-delete.js';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const w = { id: 7, walkedOn: '2026-11-20T00:00:00.000Z', courseName: '해파랑길 2코스', bookTitle: '걷기의 인문학' };

test('일기 삭제 버튼: 기록 날짜·코스 이름이 든 aria-label, 사용자 이름 없음', () => {
  assert.equal(deleteLabel(w), '2026-11-20 해파랑길 2코스 일기 삭제');
  const h = deleteButton(w);
  assert.match(h, /data-walk-del="7"/); assert.match(h, /aria-label="2026-11-20 해파랑길 2코스 일기 삭제"/);
  assert.match(h, /class="ghost small danger"/); assert.match(h, />삭제<\/button>/);
});
test('코스가 없으면 "코스 없음", id 가 없으면 버튼 없음, 이름은 이스케이프', () => {
  assert.equal(deleteLabel({ id: 1, walkedOn: '2026-01-02' }), '2026-01-02 코스 없음 일기 삭제');
  assert.equal(deleteButton({ walkedOn: '2026-01-02' }), '');
  assert.doesNotMatch(deleteButton({ id: 2, courseName: '"><img onerror=x>' }), /<img/);
});
test('확인 창 문구: 날짜·코스와 되돌릴 수 없다는 안내', () => {
  const t = confirmText(w);
  assert.match(t, /2026-11-20 · 해파랑길 2코스/); assert.match(t, /이 일기를 삭제할까요\? 삭제하면 되돌릴 수 없어요\./);
});
test('실패·성공 알림은 쉬운 한국어, 네트워크 오류는 기본 문구', () => {
  assert.equal(DONE_MSG, '일기를 삭제했어요');
  assert.equal(failMsg(Object.assign(new Error('이미 삭제된 일기예요'), { status: 404 })), '이미 삭제된 일기예요');
  assert.match(failMsg(Object.assign(new Error('네트워크 오류'), { status: 0 })), /삭제하지 못했어요/);
  assert.match(failMsg(null), /삭제하지 못했어요/);
});
test('일기 화면 연결: DELETE 호출·확인 창·진행 중 비활성·성공 시 목록 다시 불러오기·실패 알림', () => {
  const a = read('app.js'), h = read('index.html');
  assert.match(a, /api\('\/v1\/me\/walks\/' \+ encodeURIComponent\(w\.id\), \{ method: 'DELETE' \}\)/);
  assert.match(a, /\$\('#diaryList'\)\.querySelectorAll\('\[data-walk-del\]'\)/);
  assert.match(a, /btn\.disabled = true; btn\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(a, /toast\(DELETE_DONE\); await loadDiary\(\)/);
  assert.match(a, /if \(e\.status === 404\) \{ toast\(DELETE_DONE\); await loadDiary\(\); return; \}/);
  assert.match(a, /toast\(deleteFailMsg\(e\)\); btn\.disabled = false/);
  assert.match(a, /if \(d\.returnValue !== 'ok'\) \{ btn\.focus\(\); return; \}/);
  assert.match(h, /<dialog id="diaryDelDialog" aria-labelledby="diaryDelTitle"><form method="dialog">/);
});
test('도움말에 일기 삭제 안내 한 줄, 보관 문구는 그대로', () => {
  const h = read('index.html');
  assert.match(h, /걷기 일기를 지울 수 있나요\?/);
  assert.match(h, /책장·걷기 일기·자주 걷는 곳은 직접 지울 때까지 보관돼요\./);
});
