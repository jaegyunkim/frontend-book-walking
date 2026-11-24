import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canResend, resendButton, resendConfirmHtml, resendDone, resendFail, resendLabel, maskedOf } from '../admin-resend.js';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const active = { id: 7, loginId: 'demo@example.com', displayName: '다람쥐', status: 'active' };
const off = { ...active, status: 'disabled' };

test('임시 비밀번호 메일 다시 보내기: 사용 중(활성) 계정에만 버튼', () => {
  assert.equal(canResend(active), true);
  assert.equal(canResend(off), false);
  assert.equal(canResend({ ...active, status: 'pending' }), false);
  assert.equal(canResend({ ...active, status: 'rejected' }), false);
  assert.equal(canResend(null), false);
  assert.match(resendButton(active), /^<button type="button" data-a="resend" aria-label="다람쥐님에게 임시 비밀번호 메일 다시 보내기">임시 비밀번호 메일 다시 보내기<\/button>$/);
  assert.equal(resendButton(off), '');
});

test('버튼 aria-label 에 사용자 이름(없으면 아이디), 이름의 HTML 은 이스케이프', () => {
  assert.equal(resendLabel({ ...active, displayName: '' }), 'demo@example.com님에게 임시 비밀번호 메일 다시 보내기');
  assert.doesNotMatch(resendButton({ ...active, displayName: '"><img src=x>' }), /<img/);
  assert.doesNotMatch(resendConfirmHtml({ ...active, displayName: '<b>x</b>' }), /<b>x/);
});

test('확인 창 문구', () => {
  const h = resendConfirmHtml(active);
  assert.match(h, /다람쥐님에게 새 임시 비밀번호를 메일로 보낼까요\? 기존 비밀번호는 더 이상 쓸 수 없어요\./);
});

test('성공: API 가 준 마스킹 주소를 그대로 표시, 없으면 주소 없이', () => {
  assert.match(resendDone(active, { ok: true, maskedEmail: 'de***@gmail.com' }), /다람쥐님의 새 임시 비밀번호를 만들었어요 \(de\*\*\*@gmail\.com\)/);
  assert.doesNotMatch(resendDone(active, { ok: true, maskedEmail: 'de***@gmail.com', tempPassword: 'Secret-1234' }), /Secret/); // 비밀번호는 알림에 남기지 않는다
  assert.doesNotMatch(resendDone(active, { ok: true }), /\(/);
  assert.equal(maskedOf({ maskedEmail: 5 }), '');
  assert.doesNotMatch(resendDone(active, { ok: true }), /demo@example\.com/); // 프런트가 원문 메일을 만들어 쓰지 않는다
});

test('실패: 429 는 잠시 후 다시, 나머지도 쉬운 한국어', () => {
  assert.match(resendFail({ status: 429 }), /잠시 후 다시 시도/);
  assert.match(resendFail({ status: 429, retryAfterSeconds: 42.2, reason: 'minute' }), /43초 뒤에 다시 시도/);
  assert.match(resendFail({ status: 429, reason: 'day' }), /하루 5번/);
  assert.match(resendFail({ status: 404 }), /계정을 찾을 수 없어요/);
  assert.match(resendFail({ status: 409 }), /사용 중인 계정/);
  assert.match(resendFail({ status: 0 }), /네트워크.*1분 뒤에 다시 발급/);
  assert.match(resendFail({ status: 502, message: 'SMTP 535 auth failed' }), /만들지 못했어요.*1분 뒤에 다시 발급/);
  assert.doesNotMatch(resendFail({ status: 502, message: 'SMTP 535 auth failed' }), /SMTP/);
});

test('admin.js 연결: 확인 창 먼저·중복 클릭 방지·알림·기존 흐름 유지', () => {
  const a = read('admin.js');
  assert.match(a, /\$\{resendButton\(u\)\}/);
  assert.match(a, /await dialog\(resendConfirmHtml\(u\), \(\) => true\)/);
  assert.match(a, /\/v1\/admin\/users\/\$\{id\}\/resend-temp-password`, \{ method: 'POST'/);
  assert.match(a, /showSecret\(`\$\{u\.loginId\} 새 임시 비밀번호`, out\.tempPassword, u\.loginId\)/); // 승인 흐름처럼 창 + 메일 보내기(mailto)
  assert.match(a, /b\.disabled = true; b\.textContent = '보내는 중…'/);
  assert.match(a, /note\(resendFail\(e\), true\)/);
  assert.match(a, /data-a="reset">비번 초기화<\/button>/); assert.match(a, /data-review="approve"/); // 기존 버튼 그대로
  assert.doesNotMatch(a, /console\.log|localStorage\.setItem\([^)]*resend/);
  assert.match(read('admin.html'), /id="msg" class="toast" role="status" aria-live="polite"/);
});

test('좁은 화면 카드에서 긴 버튼 문구가 줄바꿈된다', () => assert.match(read('admin.css'), /\.acts button\[data-a="resend"\], \.acts button\[data-resend-reg\] \{ max-width: 100%; white-space: normal;/));

test('버전 0.4.27 가 package·admin·sw 에 일관', () => {
  const v = JSON.parse(read('package.json')).version; assert.equal(v, '0.4.27');
  const used = [...read('admin.html').matchAll(/\?v=([\d.]+)/g)].map(m => m[1]); assert.ok(used.every(x => x === v));
  assert.match(read('admin.js'), /admin-resend\.js\?v=0\.4\.27/);
  assert.match(read('sw.js'), /shell-v56/);
});

// ---- v0.4.26 가입 승인 탭: 승인 완료 카드의 '임시 비밀번호 생성' ----
import { regResendButton, regResendLabel, findAccountId } from '../admin-resend.js';
test('승인 완료 카드에만 임시 비밀번호 생성 버튼(대기·거절 없음), 이름이 든 aria-label', () => {
  const r = { id: 5, login_id: 'a@b.com', display_name: '다람쥐', status: 'approved' };
  assert.match(regResendButton(r), /data-resend-reg="5" data-login="a@b\.com" data-name="다람쥐" aria-label="다람쥐님의 임시 비밀번호 생성">임시 비밀번호 생성<\/button>/);
  assert.equal(regResendButton({ ...r, status: 'pending' }), '');
  assert.equal(regResendButton({ ...r, status: 'rejected' }), '');
  assert.doesNotMatch(regResendButton({ ...r, display_name: '"><i>' }), /<i>/);
  assert.equal(regResendLabel({ login_id: 'a@b.com', display_name: '' }), 'a@b.com님의 임시 비밀번호 생성');
});
test('신청 카드 → 계정 id: 로그인 이메일로 사용자 목록에서 찾고, 없음·정지는 404·409', () => {
  const users = [{ id: 11, loginId: 'A@b.com', status: 'active' }, { id: 12, loginId: 'off@b.com', status: 'disabled' }];
  assert.equal(findAccountId(users, 'a@b.com'), 11);
  assert.throws(() => findAccountId(users, 'none@b.com'), e => e.status === 404 && /계정을 찾을 수 없어요/.test(resendFail(e)));
  assert.throws(() => findAccountId(users, 'off@b.com'), e => e.status === 409 && /사용 중인 계정/.test(resendFail(e)));
});
test('admin.js 승인 카드 연결: 공용 runResend·기존 승인 회수/승인/거절 유지·mailto 재사용(showSecret)', () => {
  const a = read('admin.js');
  assert.match(a, /regResendButton\(r\)\+'<button class="danger" data-revoke-reg=/);
  assert.match(a, /querySelectorAll\('\[data-resend-reg\]'\)\.forEach\(b=>b\.onclick=\(\)=>runResend\(b,/);
  assert.match(a, /async function runResend\(b, u, getId\)/);
  assert.match(a, /dialog\(resendConfirmHtml\(u\), \(\) => true\)/);
  assert.match(a, /showSecret\(`\$\{u\.loginId\} 새 임시 비밀번호`, out\.tempPassword, u\.loginId\)/); // showSecret 이 approvalMailto(loginId, 비밀번호) 를 클릭 때만 만든다
  assert.match(a, /await runResend\(b, u, \(\) => id\)/); // 사용자 목록 버튼도 같은 함수
  assert.match(a, /data-review="approve"/); assert.match(a, /\[data-revoke-reg\]'\)\.forEach/);
  assert.match(read('approval-email.js'), /export function approvalMailto\(loginId, temporaryPassword\)/); // 제목·본문은 그대로
  assert.match(read('admin.css'), /\[data-resend-reg\] \{ max-width: 100%; white-space: normal;/);
});
