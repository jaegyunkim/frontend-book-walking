// 북 워킹 모바일 웹. 로그인·세션은 frontend-go-fishing/auth.js 를 그대로 쓴다(토큰은 sessionStorage, 서버가 만료 최종 판단).
import { state, api, health, login, logout, startTimer, setOnAuthLost, setOnMustChange, saveAuth } from './auth.js?v=0.1.2';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => /^https:\/\//.test(u ?? '') ? u : null;
const km = m => m == null ? '-' : m >= 1000 ? (Math.round(m / 100) / 10) + 'km' : Math.round(m) + 'm';
let timer = null, situations = [], lastPlan = null;
const sel = { date: 'today', situation: null, companion: null, bookSituation: 'solo_walk' };

function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms); }
function kstDate(offset = 0) { return new Date(Date.now() + 9 * 3600000 + offset * 86400000).toISOString().slice(0, 10); }
function nextSaturday() { const d = new Date(Date.now() + 9 * 3600000); const add = (6 - d.getUTCDay() + 7) % 7; return kstDate(add); }

// ---------- 칩 ----------
function chips(el, items, current, onPick) {
  el.innerHTML = items.map(i => `<button type="button" class="chip" role="radio" aria-checked="${i.id === current}" data-id="${esc(i.id)}">${i.emoji ? i.emoji + ' ' : ''}${esc(i.label)}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('.chip'); if (!b) return; const id = b.dataset.id; const next = id === current && el.dataset.toggle ? null : id; current = next; el.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-checked', String(c.dataset.id === next))); onPick(next); };
}
function drawForm() {
  const sat = nextSaturday();
  chips($('#dateChips'), [{ id: 'today', label: '오늘' }, { id: 'tomorrow', label: '내일' }, { id: 'after', label: '모레' }, { id: 'sat', label: `토요일(${sat.slice(5).replace('-', '/')})` }, { id: 'sun', label: '일요일' }], sel.date, v => { sel.date = v ?? 'today'; });
  $('#situationChips').dataset.toggle = '1';
  chips($('#situationChips'), situations, sel.situation, v => { sel.situation = v; });
  $('#companionChips').dataset.toggle = '1';
  chips($('#companionChips'), [{ id: 'solo', label: '혼자' }, { id: 'pair', label: '둘이' }, { id: 'family', label: '아이·가족' }, { id: 'group', label: '여럿이' }], sel.companion, v => { sel.companion = v; });
  chips($('#bookSituationChips'), situations, sel.bookSituation, v => { sel.bookSituation = v ?? 'solo_walk'; loadBooks(); });
  const saved = localStorage.getItem('bookwalking.origin'); if (saved && !$('#origin').value) $('#origin').value = saved;
}
const dateValue = () => ({ today: kstDate(0), tomorrow: kstDate(1), after: kstDate(2), sat: nextSaturday(), sun: kstDate(Math.round((Date.parse(nextSaturday()) - Date.parse(kstDate(0))) / 86400000) + 1) })[sel.date];

// ---------- 플랜 ----------
$('#btnLocate').onclick = () => {
  if (!navigator.geolocation) return toast('이 기기에서는 위치를 쓸 수 없습니다');
  navigator.geolocation.getCurrentPosition(p => { $('#origin').value = `${p.coords.latitude.toFixed(4)},${p.coords.longitude.toFixed(4)}`; toast('현재 위치를 넣었습니다'); }, () => toast('위치 권한이 없어 동네 이름을 직접 입력해 주세요'), { timeout: 8000, maximumAge: 600000 });
};
$('#planForm').onsubmit = async e => {
  e.preventDefault();
  const origin = $('#origin').value.trim(); if (!origin) return;
  localStorage.setItem('bookwalking.origin', origin);
  const btn = $('#btnPlan'); btn.disabled = true; btn.textContent = '데이터 모으는 중…';
  const steps = ['기상청 예보', '에어코리아 미세먼지', '두루누비 걷기길', '예스24 상황별 베스트', 'Jev 도서 매칭', '주변 서점·관광지'];
  let i = 0; $('#planResult').innerHTML = `<div class="loading">북 워킹을 만들고 있어요 · <b id="stepName">${steps[0]}</b></div>`;
  const tick = setInterval(() => { i = (i + 1) % steps.length; const s = $('#stepName'); if (s) s.textContent = steps[i]; }, 900);
  try {
    const r = await api('/v1/plans', { method: 'POST', body: JSON.stringify({ origin, date: dateValue(), situation: sel.situation, companion: sel.companion, message: $('#message').value.trim() || undefined }), timeoutMs: 90000 });
    lastPlan = r; renderPlan(r);
  } catch (err) { $('#planResult').innerHTML = `<p class="msg">${esc(err.message)}</p>`; }
  finally { clearInterval(tick); btn.disabled = false; btn.textContent = '북 워킹 만들기'; }
};

function renderPlan({ id, plan: p, voice }) {
  const w = p.walk, s = p.weather.short;
  const hours = s?.hourly?.filter(h => h.hour % 2 === 0 || h.precip !== '없음').slice(0, 9) ?? [];
  const courses = p.courses ?? [];
  const nearbyList = (arr, title, note = '') => arr?.length ? `<div class="sec"><h3>${title}<small>${note}</small></h3><ul class="places">${arr.map(x => `<li><span>${safeUrl(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)} <small class="muted">${esc(x.category ?? x.type ?? '')}</small></span><span class="d">${x.distanceM != null ? km(x.distanceM) : ''}</span></li>`).join('')}</ul></div>` : '';
  $('#planResult').innerHTML = `
    <div class="metric-strip">
      <div class="metric"><div class="metric-num ${w.gate}">${w.score}</div><div class="metric-label">${esc(w.gateName)}</div></div>
      <div class="metric"><div class="metric-num">${s?.temp ? `${s.temp.min}~${s.temp.max}°` : p.weather.mid?.temp?.min != null ? `${p.weather.mid.temp.min}~${p.weather.mid.temp.max}°` : '-'}</div><div class="metric-label">${esc(p.dateLabel.slice(5))} 기온</div></div>
      <div class="metric"><div class="metric-num">${p.weather.air ? esc(p.weather.air.gradeName) : s?.popMax != null ? s.popMax + '%' : '-'}</div><div class="metric-label">${p.weather.air ? `미세먼지 PM10 ${p.weather.air.pm10 ?? '-'}` : '강수확률 최대'}</div></div>
    </div>
    <div class="card-lines">${p.card.map(l => `<p>${esc(l)}</p>`).join('')}</div>
    <ul class="reasons">${(w.reasons.length ? w.reasons : w.gate === 'caution' ? [`걷기 지수 ${w.score}점: 기온·바람 조건이 조금 아쉬워요`] : []).map(r => `<li>${esc(r)}</li>`).join('')}${w.tips.map(t => `<li>💡 ${esc(t)}</li>`).join('')}</ul>
    ${hours.length ? `<div class="hours">${hours.map(h => `<div class="hour">${esc(h.time)}<b>${h.temp ?? '-'}°</b>${esc(h.precip && h.precip !== '없음' ? h.precip : h.sky ?? '')}<div class="pop">${h.pop ?? 0}%</div></div>`).join('')}</div>` : ''}
    <div class="audio" id="audioBox"><h3>🎧 2분 오디오 워킹</h3><p class="muted">날씨·코스·책을 엮은 대본을 AI가 쓰고 음성으로 읽어 드려요. 걷기 직전에 들어 보세요.</p><button class="primary" type="button" id="btnScript">오디오 워킹 만들기</button></div>
    <div class="sec"><h3>📚 오늘의 책 <small>${esc(p.situation.emoji)} ${esc(p.situation.label)} · 예스24 베스트</small></h3>${p.books.map(b => bookHtml(b, p.situation.id)).join('') || '<p class="empty">책을 불러오지 못했습니다</p>'}</div>
    <div class="sec"><h3>🚶 걷기 코스 <small>두루누비 · 출발지 반경 ${p.courseSearch?.radiusKm ?? '-'}km</small></h3>${courses.map(courseHtml).join('') || '<p class="empty">가까운 코리아둘레길 코스가 없습니다</p>'}</div>
    ${nearbyList((p.nearby.parks ?? []).filter(x => !/화장실|주차장|매점|관리사무소/.test(x.name + x.category)), '🌳 동네 산책', '출발지 3km 안 공원')}
    ${nearbyList(p.indoor, '☔ 실내에서 읽기', '도서관·북카페')}
    ${nearbyList(p.nearby.bookstores, '🏬 코스 근처 서점', '카카오 로컬')}
    ${nearbyList(p.nearby.spots, '📍 코스 근처 관광지', '한국관광공사')}
    ${p.nearby.camps?.length ? `<div class="sec"><h3>🏕️ 근처 캠핑장 <small>한국관광공사 고캠핑</small></h3><ul class="places">${p.nearby.camps.map(c => `<li><span>${safeUrl(c.homepage) ? `<a href="${esc(c.homepage)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)} <small class="muted">${esc(c.type ?? '')}</small><br><small class="muted">${esc(c.address ?? '')}</small></span><a class="d" href="https://map.kakao.com/link/to/${encodeURIComponent(c.name)},${c.lat},${c.lon}" target="_blank" rel="noopener">길찾기</a></li>`).join('')}</ul></div>` : ''}
    ${p.drive ? `<div class="sec"><h3>🚗 캠핑장까지 <small>카카오모빌리티·오피넷·ITS</small></h3><p>${esc(p.drive.to)}까지 약 <b>${p.drive.distanceKm ?? '-'}km · ${p.drive.minutes ?? '-'}분</b>${p.drive.toll ? `, 통행료 ${p.drive.toll.toLocaleString()}원` : ''}${p.drive.fuel ? `, 왕복 기름값 약 ${p.drive.fuel.estimateKrw.toLocaleString()}원` : ''}</p>${p.drive.fuel ? `<p class="muted">${esc(p.drive.fuel.basis)} (휘발유 ${p.drive.fuel.price}원/L)</p>` : ''}${p.drive.incidents.length ? `<ul class="reasons">${p.drive.incidents.slice(0, 3).map(x => `<li>${esc(x.road ?? '')} ${esc(x.type ?? '')}: ${esc(x.message)}</li>`).join('')}</ul>` : '<p class="muted">경로 주변 돌발상황 없음(현재 기준)</p>'}</div>` : ''}
    ${p.crowd ? `<div class="sec"><h3>👥 방문 혼잡 <small>${esc(p.crowd.note)}</small></h3><p>${esc(p.crowd.name)} 같은 요일 평균 방문자는 평소의 <b>${Math.round(p.crowd.ratio * 100)}%</b> — ${esc(p.crowd.crowd)}</p></div>` : ''}
    ${p.weather.message ? `<details class="sec"><summary>기상청 예보관 통보문</summary><p class="muted" style="white-space:pre-line">${esc(p.weather.message)}</p></details>` : ''}
    <div class="sources">${p.sources.map(x => `<span class="${x.status === 'ok' ? '' : 'bad'}">${esc(x.provider)} ${x.status === 'ok' ? '✓' : esc(x.status)}</span>`).join('')}<p>${esc(p.attribution)}</p><p>AI: Jev 상황 분류 ${esc(p.ai.jev.status)} · 도서 재순위화 ${esc(p.ai.rerank.status)}${p.ai.rerank.model ? ` (${esc(p.ai.rerank.model)})` : ''}</p></div>`;
  $('#btnScript').onclick = () => makeAudio(id, voice);
  $('#planResult').querySelectorAll('[data-shelf]').forEach(b => b.onclick = () => addShelf(JSON.parse(b.dataset.shelf), b));
  $('#planResult').querySelectorAll('[data-diary]').forEach(b => b.onclick = () => { const c = courses[Number(b.dataset.diary)]; $('#diaryCourse').value = c?.name ?? ''; $('#diaryBook').value = p.books[0]?.title ?? ''; go('diary'); });
  $('#planResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function bookHtml(b, situation) {
  const data = esc(JSON.stringify({ itemId: b.itemId, isbn13: b.isbn13, title: b.title, author: b.author, cover: b.cover, link: b.link, situation }));
  return `<div class="book">${safeUrl(b.cover) ? `<img src="${esc(b.cover)}" alt="" loading="lazy">` : '<div></div>'}<div><div class="t">${esc(b.title)}</div><div class="a">${esc(b.author)}${b.publisher ? ' · ' + esc(b.publisher) : ''}${b.category ? ' · ' + esc(b.category) : ''}${b.rank ? ` · ${b.rank}위` : ''}</div>${b.intro ? `<div class="i">${esc(b.intro)}</div>` : ''}<div class="acts">${safeUrl(b.link) ? `<a href="${esc(b.link)}" target="_blank" rel="noopener">예스24에서 보기</a>` : ''}<button class="ghost small" type="button" data-shelf="${data}">책장에 담기</button></div></div></div>`;
}
function courseHtml(c, i) {
  const g = c.safety?.gate;
  return `<div class="course"><div><b>${esc(c.name)}</b> ${g ? `<span class="tag ${g}">${g === 'go' ? '해안 안전' : g === 'caution' ? '해안 주의' : '해안 금지'}</span>` : ''}${c.coastal && !g ? '<span class="tag caution">해안길</span>' : ''}</div>
    <div class="meta">출발지에서 ${c.travelKm}km · 코스 ${c.distanceKm ?? '-'}km · ${c.minutes ? Math.round(c.minutes / 6) / 10 + '시간' : '-'} · ${esc(c.levelName ?? '')} · ${esc(c.sigun ?? '')}</div>
    ${c.summary ? `<p>${esc(c.summary.split('\n')[0].replace(/^-\s*/, ''))}</p>` : ''}
    ${c.tip ? `<p class="muted">👣 ${esc(c.tip)}</p>` : ''}${c.safety?.sea ? `<p class="muted">🌊 ${esc(c.safety.sea.name)} 실측 파고 ${c.safety.sea.wave ?? '-'}m · 풍속 ${c.safety.sea.wind ?? '-'}m/s (${esc(c.safety.sea.observedAt)})</p>` : ''}
    <div class="links">${c.start ? `<a href="https://map.kakao.com/link/map/${encodeURIComponent(c.name + ' 시작점')},${c.start.lat},${c.start.lon}" target="_blank" rel="noopener">시작점 지도</a><a href="https://map.kakao.com/link/to/${encodeURIComponent(c.name + ' 시작점')},${c.start.lat},${c.start.lon}" target="_blank" rel="noopener">길찾기</a>` : ''}<a href="https://www.durunubi.kr/" target="_blank" rel="noopener">두루누비</a><a href="#" data-diary="${i}">다녀왔어요</a></div></div>`;
}
async function makeAudio(id, voice) {
  const box = $('#audioBox'), btn = $('#btnScript');
  btn.disabled = true; btn.textContent = '대본 쓰는 중…';
  try {
    const r = await api(`/v1/plans/${id}/script`, { method: 'POST', body: '{}', timeoutMs: 90000 });
    box.innerHTML = `<h3>🎧 2분 오디오 워킹 <small class="muted">${r.status === 'ok' ? esc(r.model ?? 'AI') : '기본 대본'}</small></h3><p class="script">${esc(r.script)}</p>${r.speechId && voice !== false ? '<button class="primary" type="button" id="btnPlay">음성으로 듣기</button>' : '<p class="muted">음성 합성을 쓸 수 없어 대본만 보여 드립니다.</p>'}`;
    const play = $('#btnPlay');
    if (play) play.onclick = async () => {
      play.disabled = true; play.textContent = '음성 만드는 중…(첫 재생은 10초쯤 걸려요)';
      try {
        const res = await fetch(`${state.api}/v1/tts/${r.speechId}`, { headers: state.auth?.token ? { Authorization: 'Bearer ' + state.auth.token } : {}, signal: AbortSignal.timeout(90000) });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'HTTP ' + res.status); }
        const a = document.createElement('audio'); a.controls = true; a.src = URL.createObjectURL(await res.blob()); play.replaceWith(a); a.play().catch(() => {});
      } catch (e) { play.disabled = false; play.textContent = '다시 시도'; toast(e.message); }
    };
  } catch (e) { btn.disabled = false; btn.textContent = '다시 만들기'; toast(e.message); }
}

// ---------- 상황별 책 / 검색 ----------
async function loadBooks() {
  const el = $('#bookList'); el.innerHTML = '<p class="loading">예스24 베스트를 불러오는 중…</p>';
  try {
    const r = await api(`/v1/books?situation=${encodeURIComponent(sel.bookSituation)}&age=${$('#bookAge').value}&sex=${$('#bookSex').value}`);
    el.innerHTML = r.items.slice(0, 20).map(b => bookHtml(b, sel.bookSituation)).join('') || '<p class="empty">책이 없습니다</p>';
    bindShelf(el);
  } catch (e) { el.innerHTML = `<p class="msg">${esc(e.message)}</p>`; }
}
$('#bookAge').onchange = loadBooks; $('#bookSex').onchange = loadBooks;
$('#searchForm').onsubmit = async e => {
  e.preventDefault(); const q = $('#searchQ').value.trim(); if (!q) return loadBooks();
  const el = $('#bookList'); el.innerHTML = '<p class="loading">검색 중…</p>';
  try { const r = await api('/v1/books/search?q=' + encodeURIComponent(q)); el.innerHTML = r.items.map(b => bookHtml(b, null)).join('') || '<p class="empty">검색 결과가 없습니다</p>'; bindShelf(el); }
  catch (err) { el.innerHTML = `<p class="msg">${esc(err.message)}</p>`; }
};
const bindShelf = el => el.querySelectorAll('[data-shelf]').forEach(b => b.onclick = () => addShelf(JSON.parse(b.dataset.shelf), b));
async function addShelf(book, btn) {
  try { await api('/v1/me/shelf', { method: 'POST', body: JSON.stringify({ book, situation: book.situation ?? null }) }); btn.textContent = '담았어요 ✓'; btn.disabled = true; }
  catch (e) { toast(e.message); }
}

// ---------- 책장 ----------
async function loadShelf() {
  const el = $('#shelfList');
  try {
    const r = await api('/v1/me/shelf');
    el.innerHTML = r.books.map(b => `<div class="book">${safeUrl(b.cover) ? `<img src="${esc(b.cover)}" alt="" loading="lazy">` : '<div></div>'}<div><div class="t">${esc(b.title)}</div><div class="a">${esc(b.author ?? '')}</div><div class="acts">${safeUrl(b.link) ? `<a href="${esc(b.link)}" target="_blank" rel="noopener">예스24에서 보기</a>` : ''}<button class="ghost small" type="button" data-use="${esc(b.title)}">일기에 쓰기</button><button class="ghost small" type="button" data-del="${b.itemId}">빼기</button></div></div></div>`).join('') || '<p class="empty">아직 담은 책이 없습니다. 오늘 탭에서 추천받은 책을 담아 보세요.</p>';
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await api('/v1/me/shelf/' + b.dataset.del, { method: 'DELETE' }); loadShelf(); });
    el.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { $('#diaryBook').value = b.dataset.use; go('diary'); });
  } catch (e) { el.innerHTML = `<p class="msg">${esc(e.message)}</p>`; }
}

// ---------- 일기 ----------
async function loadDiary() {
  $('#diaryDate').value ||= kstDate(0);
  try {
    const r = await api('/v1/me/walks');
    $('#diaryStats').innerHTML = `<div class="metric"><div class="metric-num">${r.stats.walks}</div><div class="metric-label">북 워킹 횟수</div></div><div class="metric"><div class="metric-num">${r.stats.courses}</div><div class="metric-label">걸은 코스</div></div><div class="metric"><div class="metric-num">${r.stats.books}</div><div class="metric-label">함께한 책</div></div>`;
    $('#diaryList').innerHTML = r.walks.map(w => `<li><div class="when">${esc(String(w.walkedOn).slice(0, 10))} ${w.rating ? '★'.repeat(w.rating) : ''}</div><b>${esc(w.courseName ?? '코스 없음')}</b>${w.bookTitle ? ` · 『${esc(w.bookTitle)}』` : ''}${w.note ? `<p>${esc(w.note)}</p>` : ''}</li>`).join('') || '<li class="empty">첫 북 워킹을 기록해 보세요.</li>';
  } catch (e) { $('#diaryList').innerHTML = `<li class="msg">${esc(e.message)}</li>`; }
}
$('#diaryForm').onsubmit = async e => {
  e.preventDefault();
  const plan = lastPlan?.plan, title = $('#diaryBook').value.trim();
  const book = plan?.books?.find(b => b.title === title) ?? (title ? { itemId: 0, title } : null);
  const course = plan?.courses?.find(c => c.name === $('#diaryCourse').value.trim());
  try {
    await api('/v1/me/walks', { method: 'POST', body: JSON.stringify({ planId: lastPlan?.id, courseId: course?.id, courseName: $('#diaryCourse').value.trim(), book: book?.itemId ? book : null, bookTitle: title, date: $('#diaryDate').value, rating: Number($('#diaryRating').value) || null, note: [title && !book?.itemId ? `『${title}』` : '', $('#diaryNote').value.trim()].filter(Boolean).join(' ') }) });
    $('#diaryForm').reset(); $('#diaryDate').value = kstDate(0); toast('기록했어요'); loadDiary();
  } catch (err) { toast(err.message); }
};

// ---------- 탭 ----------
function go(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'books' && !$('#bookList').children.length) loadBooks();
  if (tab === 'shelf') loadShelf();
  if (tab === 'diary') loadDiary();
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => go(b.dataset.tab));

// ---------- 로그인 ----------
function showLogin(msg = '') {
  timer?.stop(); $('#appView').hidden = true; $('#loginView').hidden = false; $('#loginMsg').textContent = msg;
  const id = localStorage.getItem('bookwalking.loginId'); if (id) { $('#loginId').value = id; $('#rememberId').checked = true; }
}
async function showApp() {
  $('#loginView').hidden = true; $('#appView').hidden = false;
  if (!situations.length) { try { situations = (await api('/v1/situations', { noAuth: true })).situations; } catch { situations = []; } }
  drawForm();
  syncAdmin();
  if (state.auth) timer = startTimer($('#timer'), { onWarn: () => toast('1분 뒤 자동 로그아웃됩니다'), onExpire: () => { logout('expired'); showLogin('이용 시간이 끝나 로그아웃했습니다. 다시 로그인해 주세요.'); } });
  if (state.auth?.user?.mustChangePassword) openPw();
}
/** 관리자 계정이면 상단에 관리자 페이지 버튼(같은 탭 세션을 그대로 쓴다) */
async function syncAdmin() {
  const btn = $('#btnAdmin'); btn.hidden = state.auth?.user?.role !== 'admin';
  try { const me = await api('/v1/auth/me'); const role = me.role ?? me.user?.role; btn.hidden = role !== 'admin'; if (state.auth?.user) saveAuth({ ...state.auth, user: { ...state.auth.user, role } }); } catch { /* 표시만 영향 */ }
}
function openPw() { $('#pwMsg').textContent = ''; $('#pwDialog').showModal(); }
$('#pwForm').onsubmit = async e => {
  e.preventDefault();
  try {
    const r = await api('/v1/auth/password', { method: 'POST', body: JSON.stringify({ current: $('#pwCur').value, next: $('#pwNew').value }) });
    if (r.token) saveAuth({ ...state.auth, token: r.token });
    saveAuth({ ...state.auth, user: { ...state.auth.user, mustChangePassword: false } });
    $('#pwDialog').close(); toast('비밀번호를 바꿨습니다');
  } catch (err) { $('#pwMsg').textContent = err.message; }
};
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const btn = $('#loginBtn'); btn.disabled = true; $('#loginMsg').textContent = '';
  try {
    const id = $('#loginId').value.trim();
    await login(id, $('#loginPw').value);
    if ($('#rememberId').checked) localStorage.setItem('bookwalking.loginId', id); else localStorage.removeItem('bookwalking.loginId');
    $('#loginPw').value = ''; await showApp();
  } catch (err) { $('#loginMsg').textContent = err.message; }
  finally { btn.disabled = false; }
};
$('#btnLogout').onclick = () => { logout(); $('#btnAdmin').hidden = true; showLogin('로그아웃했습니다.'); };
setOnAuthLost(msg => showLogin(msg || '다시 로그인해 주세요'));
setOnMustChange(openPw);

(async () => {
  const h = await health();
  $('#serverLine').textContent = h.error ? `서버 미연결: ${state.api || '주소 없음'} (${h.error})` : `서버 연결됨 · ${state.api} · v${h.version}`;
  if (h.error) return showLogin('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  if (state.authMode === 'off' || state.auth) return showApp();
  showLogin();
})();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
