import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('비밀키가 프런트에 없다', () => { for (const f of ['app.js', 'auth.js', 'config.js', 'admin.js', 'approval-email.js', 'register.js', 'index.html']) assert.doesNotMatch(read(f), /(yk_live_[0-9a-f]{8}|mr_[a-z]+_[A-Za-z0-9-]{8}|xoxb-\d|ntn_\d{6}|serviceKey=[A-Za-z0-9%])/); });
test('기본 API 는 HTTPS /book-walking 경로', () => assert.match(read('config.js'), /BOOKWALKING_API = 'https:\/\/[^']+\/book-walking'/));
test('예스24 출처 표기와 상품 링크', () => { assert.match(read('app.js'), /예스24에서 보기/); assert.match(read('index.html'), /도서 정보 제공/); });
test('index.html 의 스크립트·스타일 버전이 같다', () => { const v = [...read('index.html').matchAll(/\?v=([\d.]+)/g)].map(m => m[1]); assert.ok(v.length >= 3); assert.equal(new Set(v).size, 1); });
test('로그인 아이디·비밀번호 칸에 ⓧ 지우기 버튼', () => { const h = read('index.html'); for (const id of ['loginId', 'loginPw']) assert.match(h, new RegExp(`<span class="clearable"><input id="${id}" data-clearable[^>]*><button type="button" class="clear-btn"[^>]*hidden><svg[^>]*><circle`)); assert.match(read('app.js'), /input\[data-clearable\]/); assert.match(read('style.css'), /\.clear-btn\[hidden\]/); });
