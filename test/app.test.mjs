import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('비밀키가 프런트에 없다', () => { for (const f of ['app.js', 'auth.js', 'config.js', 'admin.js', 'approval-email.js', 'register.js', 'index.html']) assert.doesNotMatch(read(f), /(yk_live_[0-9a-f]{8}|mr_[a-z]+_[A-Za-z0-9-]{8}|xoxb-\d|ntn_\d{6}|serviceKey=[A-Za-z0-9%])/); });
test('기본 API 는 HTTPS /book-walking 경로', () => assert.match(read('config.js'), /BOOKWALKING_API = 'https:\/\/[^']+\/book-walking'/));
test('예스24 출처 표기와 상품 링크', () => { assert.match(read('app.js'), /class="ghost small yes24"[^>]*>예스24(<b aria-hidden="true">↗<\/b>)?<\/a>/); assert.match(read('index.html'), /도서 정보 제공/); });
test('index.html 의 스크립트·스타일 버전이 같다', () => { const v = [...read('index.html').matchAll(/\?v=([\d.]+)/g)].map(m => m[1]); assert.ok(v.length >= 3); assert.equal(new Set(v).size, 1); });
test('로그인 아이디·비밀번호 칸에 ⓧ 지우기 버튼', () => { const h = read('index.html'); for (const id of ['loginId', 'loginPw']) assert.match(h, new RegExp(`<span class="clearable[^"]*"><input id="${id}" data-clearable[^>]*><button type="button" class="clear-btn"[^>]*hidden><svg[^>]*><circle`)); assert.match(read('app.js'), /input\[data-clearable\]/); assert.match(read('style.css'), /\.clear-btn\[hidden\]/); });
test('일기 날짜·별점 칸이 겹치지 않게(iOS 날짜 칸 최소 너비 해제)', () => { const c = read('style.css'); assert.match(c, /\.row > \.field \{ min-width: 0; \}/); assert.match(c, /input\[type="date"\] \{[^}]*appearance: none;[^}]*min-width: 0;/); });
test('오늘의 걷기 날씨 카드: 상태 칩·팁·시간별 예보 한 카드', () => { const a = read('app.js'), c = read('style.css'); assert.match(a, /function weatherCard\(w, hours\)/); assert.match(a, /\$\{weatherCard\(w, hours\)\}/); assert.match(c, /\.wx-hours \{[^}]*grid-auto-columns: minmax\(68px, 1fr\)/); });
test('하단 메뉴 아래로 본문이 비치지 않게 흰 배경을 아래로 늘인다', () => assert.match(read('style.css'), /\.tabbar::after \{[^}]*top: 100%;[^}]*background: #fff;/));
test('책장 버튼 문구: 예스24 · 일기 쓰기 · 책장 정리', () => { const a = read('app.js'); assert.match(a, />일기 쓰기<\/button>/); assert.match(a, />책장 정리<\/button>/); assert.doesNotMatch(a, />빼기<|일기에 쓰기|예스24에서 보기</); });
test('상황 선택은 가로 2칸 격자(같은 너비·간격)', () => { assert.match(read('index.html'), /id="bookSituationChips" class="chips wrap sit-grid"/); assert.match(read('style.css'), /\.chips\.sit-grid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/); });
test('오디오 워킹 제목에 AI 모델 이름을 표시하지 않는다', () => assert.doesNotMatch(read('app.js'), /2분 오디오 워킹 <small[^<]*\$\{[^}]*r\.model/));
test('출발지 고르기 위계: 선택 배너 · 현재 위치 · 자주 걷는 곳 타일 · 글자 버튼', () => { const a = read('app.js'); for (const c of ['origin-gps', 'origin-sub', 'origin-places', 'origin-tile', 'origin-actions', 'origin-link']) assert.match(a, new RegExp(`class="${c}"`)); assert.match(read('index.html'), /<p id="originNow" class="origin-now"[^>]*><\/p>\s*<div id="placeChips" class="origin-picker"/); });
test('메인 폼: 단계 번호·날짜 5칸·누구와 4칸·선택 표시', () => { const h = read('index.html'), c = read('style.css'); assert.match(h, /class="chips date-grid"/); assert.match(h, /class="chips who-grid"/); assert.ok((h.match(/class="opt">선택</g) || []).length >= 3); assert.match(c, /\.plan-form > \.field > span::before \{ content: counter\(step\)/); });
test('화면 문구는 해요체(합니다·십시오체가 남지 않음)', () => { for (const f of ['index.html', 'register.html', 'app.js', 'register.js', 'admin.js', 'auth.js', 'role-policy.js', 'destination.js']) assert.doesNotMatch(read(f).replace(/감사합니다/g, ''), /[가-힣](습니다|십시오|됩니다|합니다|입니다)(?![가-힣])/, f); });
test('관리자 화면도 서비스 화면과 같은 색·모서리(디자인 통일)', () => { const c = read('admin.css'); assert.match(c, /--acc: #2F6B4F;/); assert.match(c, /--r: 12px;/); });
test('로그인 화면: 짧은 헤드라인·이용 신청 버튼(설명·칩 없음)', () => { const h = read('index.html'); assert.match(h, /<h1 class="login-title">걷고, 읽고,<br><em>쉬어 가요<\/em><\/h1>/); assert.doesNotMatch(h, /class="login-feats"|class="deck"/); assert.match(h, /class="signup"[^>]*>처음이에요 · 이용 신청하기/); });
test('지도·길찾기·두루누비·목적지 지도는 버튼 모양', () => { assert.match(read('style.css'), /\.links a, \.dest-links a\.link-btn \{[^}]*border: 1px solid var\(--hair\);[^}]*border-radius: var\(--r-sm\)/); assert.match(read('destination.js'), /<a class="link-btn"[^>]*>목적지 지도<\/a>/); });
test("'목적지 상세' 문구는 모두 '상세 정보'로", () => { for (const f of ['index.html', 'app.js']) assert.doesNotMatch(read(f), /목적지 상세/, f); });
test('오디오 워킹 오류는 버튼 아래 말풍선으로, 토스트와 같은 디자인', () => { const a = read('app.js'), c = read('style.css'); assert.match(a, /bubble\(btn, e\.message\)/); assert.match(a, /bubble\(play, e\.message\)/); assert.match(c, /\.bubble::before \{/); assert.match(c, /\.toast \{[^}]*background: #fff;/); });
test('머리줄 로고·이름을 누르면 홈(오늘 탭)으로', () => { assert.match(read('index.html'), /<a class="brand" id="brandHome" href="\.\/"/); assert.match(read('app.js'), /\$\('#brandHome'\)\.onclick = e => \{ e\.preventDefault\(\); go\('plan'\); \}/); });
test('이미 만든 대본은 다시 보기에서 바로 불러온다(다시 만들기 버튼만 보이지 않게)', () => { const a = read('app.js'); assert.match(a, /script: r\.script \?\? null \}; go\('plan'\); renderPlan\(lastPlan\)/); assert.match(a, /if \(script\) makeAudio\(id, voice, \{ saved: true \}\)/); });
test('관리자 사용자 탭에 ElevenLabs 음성 사용량(오늘·누적 횟수·글자) 칸', () => { const a = read('admin.js'); assert.match(a, /<th class="num">음성\(ElevenLabs\)<\/th>/); assert.match(a, /u\.today\.tts\?\.count/); assert.match(a, /u\.ttsTotal\?\.chars/); });
test('비밀번호 칸: 지우기와 보기 버튼 공존(보기는 오른쪽 고정, 누르면 보이기/숨기기 전환, 로그인 때 다시 가림)', () => { const h = read('index.html'), a = read('app.js'), c = read('style.css'); assert.match(h, /<span class="clearable has-eye"><input id="loginPw"[^>]*>(<button[^>]*class="clear-btn"[\s\S]*?<\/button>)<button type="button" class="eye-btn" id="pwToggle" aria-label="비밀번호 보기" aria-pressed="false"/); assert.match(a, /setPwVisible\(false\); \/\/ 보낼 때는 다시 가린다/); assert.match(c, /\.clearable\.has-eye \.clear-btn \{ right: 46px; \}/); });

test('누를 수 있는 요소 공통 표시: 추천 버튼·상세 정보·빈 화면 이동 버튼·장소 이름 ↗', () => {
  const app = read('app.js'), css = read('style.css'), html = read('index.html');
  assert.match(html, /id="todayTipMore" class="act"/);
  assert.match(app, /actionHintNeeded\(\)/);
  assert.match(app, /class="act small dest-open"/);
  assert.match(app, /goBtn\('plan'/); assert.match(app, /goBtn\('books'/);
  assert.match(css, /\.places a\.ext::after/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.actions\.fresh button\.act/);
});
test('남은 AI 사용량 표시·소진 잠금·한마디 지우기 버튼', () => {
  const app = read('app.js'), html = read('index.html');
  assert.match(html, /id="tokenLeft"/);
  assert.match(html, /<textarea id="message" data-clearable/);
  assert.match(app, /if \(tokenLocked\) \{ toast\(TOKEN_EMPTY_MSG\); return; \}/);
  assert.match(app, /setInterval\(\(\) => \{ if \(state\.auth && document\.visibilityState === 'visible'\) refreshUsage\(\); \}, 60000\)/);
});

// ---- v0.4.24 Manus 점검 반영 ----
test('라디오 그룹 방향키: 다음·이전(끝에서 돌기)·Home·End', async () => {
  const { nextIndex } = await import('../radio-group.js');
  assert.equal(nextIndex(5, 0, 'ArrowRight'), 1); assert.equal(nextIndex(5, 4, 'ArrowRight'), 0);
  assert.equal(nextIndex(5, 0, 'ArrowLeft'), 4); assert.equal(nextIndex(5, 2, 'ArrowUp'), 1); assert.equal(nextIndex(5, 2, 'ArrowDown'), 3);
  assert.equal(nextIndex(5, 3, 'Home'), 0); assert.equal(nextIndex(5, 1, 'End'), 4);
  assert.equal(nextIndex(5, 1, 'Enter'), null); assert.equal(nextIndex(0, 0, 'ArrowRight'), null);
});
test('선택 그룹마다 이름표와 방향키 조작(날짜·상황·누구와·출발지·상황별 책·별점)', () => {
  const h = read('index.html'), a = read('app.js');
  assert.match(h, /id="dateChips"[^>]*role="radiogroup" aria-labelledby="dateLabel"/);
  assert.match(h, /id="situationChips"[^>]*role="radiogroup" aria-label=/);
  assert.match(h, /id="companionChips"[^>]*role="radiogroup" aria-label=/);
  assert.match(h, /id="bookSituationChips"[^>]*role="radiogroup" aria-label=/);
  assert.match(h, /class="star" role="radio" aria-checked="false"/);
  assert.doesNotMatch(h, /id="placeChips"[^>]*role="radiogroup"/); // 저장·추가 버튼은 라디오 그룹 밖
  assert.match(a, /class="origin-radios" role="radiogroup" aria-labelledby="originLabel"/);
  assert.match(a, /bindRadioGroup\(el\); syncRoving\(el\);/);
  assert.match(a, /bindRadioGroup\(\$\('\.stars'\)\)/);
});
test('걷기 지수 근거: 없는 응답(예전 플랜·서버)은 아무것도 그리지 않는다', async () => {
  const { evidenceHtml } = await import('../evidence.js');
  for (const v of [undefined, null, {}, 'x', { items: 'x' }, { items: [] }, { items: [{ key: 'mid', provider: '기상청 중기예보', status: 'not-requested' }] }]) assert.equal(evidenceHtml(v), '');
});
test('걷기 지수 근거: 출처·기준 시각(한국 시간)·오래된 자료·빠진 자료를 접이식으로, 글자는 이스케이프', async () => {
  const { evidenceHtml, kstShort, agoText } = await import('../evidence.js');
  const html = evidenceHtml({ version: 1, basis: '단기예보', checkedAt: '2026-11-23T05:30:00.000Z', missing: ['living'], stale: ['air'], items: [
    { key: 'short', provider: '기상청 단기예보', role: '기온·강수·바람', status: 'ok', used: true, baseAt: '2026-11-23T02:00:00.000Z', ageMinutes: 210, stale: false, reason: null },
    { key: 'mid', provider: '기상청 중기예보', status: 'not-requested', used: false, baseAt: null, reason: '중기예보는 3일 뒤부터 반영해요' },
    { key: 'air', provider: '에어코리아 대기오염정보', status: 'ok', used: true, baseAt: '2026-11-23T00:00:00.000Z', ageMinutes: 330, stale: true, reason: '측정 후 5시간이 지난 자료예요' },
    { key: 'living', provider: '<b>생활</b>', status: 'error', used: false, baseAt: null, reason: '제공기관 요청 시간 초과' }] });
  assert.match(html, /^<details class="walk-basis">/);
  assert.match(html, /오래된 자료 1 · 빠진 자료 1/);
  assert.match(html, /11\/23 11:00 기준 · 3시간 30분 전/);
  assert.match(html, /측정 후 5시간이 지난 자료예요/);
  assert.match(html, /받지 못함/);
  assert.doesNotMatch(html, /중기예보/); // 날짜 범위상 요청하지 않은 항목은 숨김
  assert.doesNotMatch(html, /<b>생활<\/b>/); assert.match(html, /&lt;b&gt;생활/);
  assert.equal(kstShort('bad'), null); assert.equal(agoText(45), '45분 전'); assert.equal(agoText(3000), '2일 전');
  assert.match(read('app.js'), /\$\{evidenceHtml\(w\.evidence\)\}/);
});
test('도움말: 설정 창에서 열고, 보관·위치·한도 문구는 로그인 화면 안내를 그대로 옮겨 쓴다(자리표시자·처리방침 초안 없음)', () => {
  const h = read('index.html'), a = read('app.js');
  assert.match(h, /id="btnHelp"/); assert.match(h, /<dialog id="helpDialog"/);
  for (const id of ['noteKeep', 'noteLocation', 'noteSession', 'loginPolicy']) { assert.match(h, new RegExp(`<li id="${id}">`)); assert.match(h, new RegExp(`data-note="${id}"`)); }
  assert.match(a, /p\.textContent = document\.getElementById\(p\.dataset\.note\)\?\.textContent/);
  const faq = h.slice(h.indexOf('<dialog id="helpDialog"'), h.indexOf('</dialog>', h.indexOf('<dialog id="helpDialog"')));
  assert.doesNotMatch(faq, /\[[^\]]*\]|개인정보 처리방침|확인 필요|30일|직접 지울/); // 보관 기간은 로그인 문구로만
});
test('화면마다 h1 하나(오늘은 숨김 제목), 좁은 머리줄은 줄바꿈 대신 둘째 줄로', () => {
  const h = read('index.html'), c = read('style.css');
  assert.match(h, /<h1 id="planTitle" class="visually-hidden">오늘의 북 워킹<\/h1>/);
  for (const t of ['상황별 베스트', '내 책장', '북 워킹 일기', '내 북 워킹 기록', '의견 보내기']) assert.match(h, new RegExp(`<h1>${t}</h1>`));
  assert.match(c, /\.top \{ flex-wrap: wrap;/); assert.match(c, /\.timer \{ flex: none; white-space: nowrap;/);
  assert.match(c, /html \{ scroll-padding-top: calc\(var\(--top-h, 64px\) \+ 8px\); scroll-padding-bottom:/);
  assert.match(c, /@media \(max-width: 374px\) \{ \.diary-form \.row \{ flex-direction: column;/);
});
