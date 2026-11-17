import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('비밀키가 프런트에 없다', () => { for (const f of ['app.js', 'auth.js', 'config.js', 'admin.js', 'register.js', 'index.html']) assert.doesNotMatch(read(f), /(yk_live_|mr_[a-z]+_|xoxb-|ntn_|serviceKey=)/); });
test('기본 API 는 HTTPS /book-walking 경로', () => assert.match(read('config.js'), /BOOKWALKING_API = 'https:\/\/[^']+\/book-walking'/));
test('예스24 출처 표기와 상품 링크', () => { assert.match(read('app.js'), /예스24에서 보기/); assert.match(read('index.html'), /도서 정보 제공/); });
test('index.html 의 스크립트·스타일 버전이 같다', () => { const v = [...read('index.html').matchAll(/\?v=([\d.]+)/g)].map(m => m[1]); assert.ok(v.length >= 3); assert.equal(new Set(v).size, 1); });
