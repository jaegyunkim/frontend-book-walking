import { ROLE_LABEL, DAY_NOTE, policyText, logoutUsage } from './role-policy.js?v=0.3.3';
// 북 워킹 모바일 웹. 로그인·세션은 frontend-go-fishing/auth.js 를 그대로 쓴다(토큰은 sessionStorage, 서버가 만료 최종 판단).
import { state, api, health, login, logout, startTimer, setOnAuthLost, setOnMustChange, saveAuth, syncAccount, remaining, sessionMinutes } from './auth.js?v=0.3.3';

import { createDestinationDialog, pointOf } from './destination.js?v=0.1.8';
const openDestination = createDestinationDialog(document, api);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => /^https:\/\//.test(u ?? '') ? u : null;
const km = m => m == null ? '-' : m >= 1000 ? (Math.round(m / 100) / 10) + 'km' : Math.round(m) + 'm';
let timer = null, situations = [], lastPlan = null;
const sel = { date: 'today', situation: null, companion: null, bookSituation: 'solo_walk' };

function toast(msg, ms = 3200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms); }
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
  const saved = localStorage.getItem('bookwalking.origin'); if (saved && !$('#origin').value) setOrigin(saved); else renderPlaces();
}
const dateValue = () => ({ today: kstDate(0), tomorrow: kstDate(1), after: kstDate(2), sat: nextSaturday(), sun: kstDate(Math.round((Date.parse(nextSaturday()) - Date.parse(kstDate(0))) / 86400000) + 1) })[sel.date];

// ---------- 플랜 ----------
// ---------- 출발지: 칩 한 줄로 고른다([◎ 현재 위치] [자주 걷는 곳…] [＋ 주소로 추가]) ----------
// 현재 위치는 화면에 장소 이름(예: 경남 양산 동면 금오13길, 번지 제외)을 보여 주고, 계산에는 좌표를 쓴다.
let here = (() => { try { return JSON.parse(localStorage.getItem('bookwalking.here') || 'null'); } catch { return null; } })(); // { label, coords:'위도,경도' }
let locating = false;
const originValue = () => { const v = $('#origin').value.trim(); return here && v === here.label ? here.coords : v; };
function setOrigin(v) { $('#origin').value = String(v ?? '').trim(); renderPlaces(); }
function locateHere() {
  if (!navigator.geolocation) return toast('이 기기에서는 위치를 쓸 수 없습니다. 주소로 추가해 주세요');
  if (locating) return; locating = true; renderPlaces();
  navigator.geolocation.getCurrentPosition(async p => {
    const lat = p.coords.latitude.toFixed(4), lon = p.coords.longitude.toFixed(4), coords = `${lat},${lon}`;
    let label = null;
    try { label = (await api(`/v1/place-name?lat=${lat}&lon=${lon}`, { timeoutMs: 10000 })).label; } catch { /* 이름을 못 찾으면 기본 문구 */ }
    here = { label: label || '현재 위치', coords }; localStorage.setItem('bookwalking.here', JSON.stringify(here));
    locating = false; setOrigin(here.label);
  }, () => { locating = false; renderPlaces(); toast('위치 권한이 없어요. 주소로 추가해 주세요'); }, { timeout: 8000, maximumAge: 600000 });
}
// ---------- 만들기 전 안내: 한마디가 비었으면 상황·누구와 고르기를 권하고, 아무것도 없으면 AI 맞춤 추천을 알린다 ----------
const COMPANIONS = [{ id: 'solo', label: '혼자' }, { id: 'pair', label: '둘이' }, { id: 'family', label: '아이·가족' }, { id: 'group', label: '여럿이' }];
let skipAskOnce = false; // 오늘의 추천·기록 '오늘 다시'처럼 조건이 정해진 만들기는 묻지 않는다
const eulReul = w => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '을' : '를'; };
const askSkipKey = () => 'bookwalking.askSkip.' + (state.auth?.user?.id ?? '');
function askBeforePlan() {
  if ($('#message').value.trim() || (sel.situation && sel.companion) || localStorage.getItem(askSkipKey()) === kstDate(0)) return Promise.resolve(true);
  const dlg = $('#askDialog'), noSit = !sel.situation, noComp = !sel.companion, none = noSit && noComp;
  const where = esc($('#origin').value.trim());
  const refresh = () => {
    const empty = !sel.situation && !sel.companion;
    $('#askTitle').textContent = empty ? 'AI가 알아서 골라 드릴까요?' : '이대로 만들어 볼까요?';
    $('#askMsg').innerHTML = empty
      ? `상황이나 함께 걷는 분을 골라 주시면 더 꼭 맞는 길과 책을 찾아 드려요.<br>고르지 않으셔도 괜찮아요. 그동안 만들어 주신 북 워킹 기록과 <b>${where}</b>${eulReul($('#origin').value)} 바탕으로 AI가 오늘에 어울리는 길과 책을 골라 드릴게요.`
      : `${!sel.situation ? '어떤 걷기인지' : '누구와 걷는지'}도 알려 주시면 더 잘 맞춰 드려요. 그대로 두셔도 <b>${where}</b>의 오늘 날씨와 그동안의 기록에 맞춰 골라 드릴게요.`;
    $('#askGo').textContent = empty ? 'AI에게 맡기기' : '이대로 만들기';
  };
  $('#askSituationBox').hidden = !noSit; $('#askCompanionBox').hidden = !noComp;
  if (noSit) { $('#askSituation').dataset.toggle = '1'; chips($('#askSituation'), situations.filter(x => x.id !== 'rainy').slice(0, 8), sel.situation, v => { sel.situation = v; drawForm(); refresh(); }); }
  if (noComp) { $('#askCompanion').dataset.toggle = '1'; chips($('#askCompanion'), COMPANIONS, sel.companion, v => { sel.companion = v; drawForm(); refresh(); }); }
  $('#askSkipToday').checked = false; refresh();
  return new Promise(ok => {
    const finish = go => { if (go && $('#askSkipToday').checked) localStorage.setItem(askSkipKey(), kstDate(0)); dlg.onclose = null; dlg.close(); ok(go); };
    $('#askGo').onclick = () => finish(true);
    $('#askMessage').onclick = () => { finish(false); go('plan'); $('#message').focus(); $('#message').scrollIntoView({ block: 'center' }); };
    dlg.onclose = () => ok(false); dlg.oncancel = () => ok(false);
    dlg.showModal();
  });
}
$('#planForm').onsubmit = async e => {
  e.preventDefault();
  const origin = originValue(); if (!origin) { toast('출발지를 먼저 골라 주세요'); return; }
  const skip = skipAskOnce; skipAskOnce = false;
  if (!skip && !(await askBeforePlan())) return;
  localStorage.setItem('bookwalking.origin', $('#origin').value.trim());
  const btn = $('#btnPlan'); btn.disabled = true; btn.textContent = '데이터 모으는 중…';
  const steps = ['기상청 예보', '에어코리아 미세먼지', '두루누비 걷기길', '예스24 상황별 베스트', 'Jev 도서 매칭', '주변 서점·관광지'];
  let i = 0; $('#planResult').innerHTML = `<div class="loading">북 워킹을 만들고 있어요 · <b id="stepName">${steps[0]}</b></div>`;
  const tick = setInterval(() => { i = (i + 1) % steps.length; const s = $('#stepName'); if (s) s.textContent = steps[i]; }, 900);
  try {
    const r = await api('/v1/plans', { method: 'POST', body: JSON.stringify({ origin, date: dateValue(), situation: sel.situation, companion: sel.companion, message: $('#message').value.trim() || undefined }), timeoutMs: 90000 });
    lastPlan = r; renderPlan(r); refreshUsage();
  } catch (err) { if (err.code === 'AI_CREDIT_EXHAUSTED') refreshUsage(); $('#planResult').innerHTML = `<p class="msg">${esc(err.message)}</p>`; }
  finally { clearInterval(tick); btn.disabled = false; btn.textContent = '북 워킹 만들기'; }
};

function renderPlan({ id, plan: p, voice }) {
  const w = p.walk, s = p.weather.short;
  const hours = s?.hourly?.filter(h => h.hour % 2 === 0 || h.precip !== '없음').slice(0, 9) ?? [];
  const courses = p.courses ?? [];
  const destinations = [];
  function detailButton(item, kind, point = item) {
    if (!item.name || !pointOf(point)) return '<small class="muted">상세 위치 미제공</small>';
    const index = destinations.push({ ...item, ...pointOf(point), kind }) - 1;
    return `<button type="button" class="ghost small dest-open" data-destination="${index}" aria-label="${esc(item.name)} 목적지 상세">목적지 상세</button>`;
  }
  const nearbyList = (arr, title, note = '') => arr?.length ? `<div class="sec"><h3>${title}<small>${note}</small></h3><ul class="places">${arr.map(x => `<li><span>${safeUrl(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)} <small class="muted">${esc(x.category ?? x.type ?? '')}</small><br>${detailButton(x, x.category ?? x.type ?? title)}</span><span class="d">${x.distanceM != null ? km(x.distanceM) : ''}</span></li>`).join('')}</ul></div>` : '';
  $('#planResult').innerHTML = `
    <div class="metric-strip">
      <div class="metric"><div class="metric-num ${w.gate}">${w.score}</div><div class="metric-label">${esc(w.gateName)}</div></div>
      <div class="metric"><div class="metric-num">${s?.temp ? `${s.temp.min}~${s.temp.max}°` : p.weather.mid?.temp?.min != null ? `${p.weather.mid.temp.min}~${p.weather.mid.temp.max}°` : '-'}</div><div class="metric-label">${esc(p.dateLabel.slice(5))} 기온</div></div>
      <div class="metric"><div class="metric-num">${p.weather.air ? esc(p.weather.air.gradeName) : s?.popMax != null ? s.popMax + '%' : '-'}</div><div class="metric-label">${p.weather.air ? `미세먼지 PM10 ${p.weather.air.pm10 ?? '-'}` : '강수확률 최대'}</div></div>
    </div>
    ${p.auto ? `<p class="auto-note">✨ AI 맞춤 추천 · ${p.auto.basis === 'history' ? `최근 북 워킹 ${p.auto.plans}번의 기록에서 자주 고르신 '${esc(p.situation.label)}'${p.auto.companion ? '·' + esc(({ solo: '혼자', pair: '둘이', family: '아이·가족', group: '여럿이' })[p.auto.companion] ?? '') : ''}을(를)` : '오늘 날씨에 맞춰 상황을'} 골랐어요. 출발지는 ${esc(p.place)}.</p>` : ''}
    <div class="card-lines">${p.card.map(l => `<p>${esc(l)}</p>`).join('')}</div>
    <ul class="reasons">${(w.reasons.length ? w.reasons : w.gate === 'caution' ? [`걷기 지수 ${w.score}점: 기온·바람 조건이 조금 아쉬워요`] : []).map(r => `<li>${esc(r)}</li>`).join('')}${w.tips.map(t => `<li>💡 ${esc(t)}</li>`).join('')}</ul>
    ${hours.length ? `<div class="hours">${hours.map(h => `<div class="hour">${esc(h.time)}<b>${h.temp ?? '-'}°</b>${esc(h.precip && h.precip !== '없음' ? h.precip : h.sky ?? '')}<div class="pop">${h.pop ?? 0}%</div></div>`).join('')}</div>` : ''}
    <div class="audio" id="audioBox"><h3>🎧 2분 오디오 워킹</h3><p class="muted">날씨·코스·책을 엮은 대본을 AI가 쓰고 음성으로 읽어 드려요. 걷기 직전에 들어 보세요.</p><button class="primary" type="button" id="btnScript">오디오 워킹 만들기</button></div>
    <div class="sec"><h3>📚 오늘의 책 <small>${esc(p.situation.emoji)} ${esc(p.situation.label)} · 예스24 베스트</small></h3>${p.books.map(b => bookHtml(b, p.situation.id)).join('') || '<p class="empty">책을 불러오지 못했습니다</p>'}</div>
    <div class="sec"><h3>🚶 걷기 코스 <small>두루누비 · 출발지 반경 ${p.courseSearch?.radiusKm ?? '-'}km</small></h3>${courses.map((c, i) => courseHtml(c, i, detailButton(c, '걷기 코스 시작점', c.start ?? null))).join('') || '<p class="empty">가까운 코리아둘레길 코스가 없습니다</p>'}</div>
    ${nearbyList((p.nearby.parks ?? []).filter(x => !/화장실|주차장|매점|관리사무소/.test(x.name + x.category)), '🌳 동네 산책', '출발지 3km 안 공원')}
    ${nearbyList(p.indoor, '☔ 실내에서 읽기', '도서관·북카페')}
    ${nearbyList(p.nearby.bookstores, '🏬 코스 근처 서점', '카카오 로컬')}
    ${nearbyList(p.nearby.spots, '📍 코스 근처 관광지', '한국관광공사')}
    ${p.nearby.camps?.length ? `<div class="sec"><h3>🏕️ 근처 캠핑장 <small>한국관광공사 고캠핑</small></h3><ul class="places">${p.nearby.camps.map(c => `<li><span>${safeUrl(c.homepage) ? `<a href="${esc(c.homepage)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)} <small class="muted">${esc(c.type ?? '')}</small><br><small class="muted">${esc(c.address ?? '')}</small><br>${detailButton(c, '캠핑장')}</span><a class="d" href="https://map.kakao.com/link/to/${encodeURIComponent(c.name)},${c.lat},${c.lon}" target="_blank" rel="noopener">길찾기</a></li>`).join('')}</ul></div>` : ''}
    ${p.drive ? `<div class="sec"><h3>🚗 캠핑장까지 <small>카카오모빌리티·오피넷·ITS</small></h3><p>${esc(p.drive.to)}까지 약 <b>${p.drive.distanceKm ?? '-'}km · ${p.drive.minutes ?? '-'}분</b>${p.drive.toll ? `, 통행료 ${p.drive.toll.toLocaleString()}원` : ''}${p.drive.fuel ? `, 왕복 기름값 약 ${p.drive.fuel.estimateKrw.toLocaleString()}원` : ''}</p>${p.drive.fuel ? `<p class="muted">${esc(p.drive.fuel.basis)} (휘발유 ${p.drive.fuel.price}원/L)</p>` : ''}${p.drive.incidents.length ? `<ul class="reasons">${p.drive.incidents.slice(0, 3).map(x => `<li>${esc(x.road ?? '')} ${esc(x.type ?? '')}: ${esc(x.message)}</li>`).join('')}</ul>` : '<p class="muted">경로 주변 돌발상황 없음(현재 기준)</p>'}</div>` : ''}
    ${p.crowd ? `<div class="sec"><h3>👥 방문 혼잡 <small>${esc(p.crowd.note)}</small></h3><p>${esc(p.crowd.name)} 같은 요일 평균 방문자는 평소의 <b>${Math.round(p.crowd.ratio * 100)}%</b> — ${esc(p.crowd.crowd)}</p></div>` : ''}
    ${p.weather.message ? `<details class="sec"><summary>기상청 예보관 통보문</summary><p class="muted" style="white-space:pre-line">${esc(p.weather.message)}</p></details>` : ''}
    <div class="sources">${p.sources.map(x => `<span class="${x.status === 'ok' ? '' : 'bad'}">${esc(x.provider)} ${x.status === 'ok' ? '✓' : esc(x.status)}</span>`).join('')}<p>${esc(p.attribution)}</p><p>AI: Jev 상황 분류 ${esc(p.ai.jev.status)} · 도서 재순위화 ${esc(p.ai.rerank.status)}${p.ai.rerank.model ? ` (${esc(p.ai.rerank.model)})` : ''}</p></div>`;
  $('#planResult').querySelectorAll('[data-destination]').forEach(b => b.onclick = () => openDestination(p, destinations[Number(b.dataset.destination)]));
  $('#btnScript').onclick = () => makeAudio(id, voice);
  $('#planResult').querySelectorAll('[data-shelf]').forEach(b => b.onclick = () => addShelf(JSON.parse(b.dataset.shelf), b));
  $('#planResult').querySelectorAll('[data-diary]').forEach(b => b.onclick = () => { const c = courses[Number(b.dataset.diary)]; $('#diaryCourse').value = c?.name ?? ''; $('#diaryBook').value = p.books[0]?.title ?? ''; go('diary'); });
  $('#planResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function bookHtml(b, situation) {
  const data = esc(JSON.stringify({ itemId: b.itemId, isbn13: b.isbn13, title: b.title, author: b.author, cover: b.cover, link: b.link, situation }));
  return `<div class="book">${safeUrl(b.cover) ? `<img src="${esc(b.cover)}" alt="" loading="lazy">` : '<div></div>'}<div><div class="t">${esc(b.title)}</div><div class="a">${esc(b.author)}${b.publisher ? ' · ' + esc(b.publisher) : ''}${b.category ? ' · ' + esc(b.category) : ''}${b.rank ? ` · ${b.rank}위` : ''}</div>${b.intro ? `<div class="i">${esc(b.intro)}</div>` : ''}<div class="acts">${safeUrl(b.link) ? `<a href="${esc(b.link)}" target="_blank" rel="noopener">예스24에서 보기</a>` : ''}<button class="ghost small" type="button" data-shelf="${data}">책장에 담기</button></div></div></div>`;
}
function courseHtml(c, i, detail) {
  const g = c.safety?.gate;
  return `<div class="course"><div><b>${esc(c.name)}</b> ${g ? `<span class="tag ${g}">${g === 'go' ? '해안 안전' : g === 'caution' ? '해안 주의' : '해안 금지'}</span>` : ''}${c.coastal && !g ? '<span class="tag caution">해안길</span>' : ''}</div>
    <div class="meta">출발지에서 ${c.travelKm}km · 코스 ${c.distanceKm ?? '-'}km · ${c.minutes ? Math.round(c.minutes / 6) / 10 + '시간' : '-'} · ${esc(c.levelName ?? '')} · ${esc(c.sigun ?? '')}</div>
    ${c.summary ? `<p>${esc(c.summary.split('\n')[0].replace(/^-\s*/, ''))}</p>` : ''}
    ${c.tip ? `<p class="muted">👣 ${esc(c.tip)}</p>` : ''}${c.safety?.sea ? `<p class="muted">🌊 ${esc(c.safety.sea.name)} 실측 파고 ${c.safety.sea.wave ?? '-'}m · 풍속 ${c.safety.sea.wind ?? '-'}m/s (${esc(c.safety.sea.observedAt)})</p>` : ''}
    <div class="links">${detail}${pointOf(c.start) ? `<a href="https://map.kakao.com/link/map/${encodeURIComponent(c.name + ' 시작점')},${c.start.lat},${c.start.lon}" target="_blank" rel="noopener">시작점 지도</a><a href="https://map.kakao.com/link/to/${encodeURIComponent(c.name + ' 시작점')},${c.start.lat},${c.start.lon}" target="_blank" rel="noopener">길찾기</a>` : ''}<a href="https://www.durunubi.kr/" target="_blank" rel="noopener">두루누비</a><a href="#" data-diary="${i}">다녀왔어요</a></div></div>`;
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
  if (tab === 'history') loadHistory();
  if (tab !== 'plan') hideTipView(); else if (tipData && !tipClosed) $('#todayTip').hidden = false;
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => go(b.dataset.tab));

// ---------- 자주 걷는 곳(최대 5곳, 어디물어 '출발지'와 같은 역할) ----------
let places = [];
const short = l => String(l).split(' ').slice(-2).join(' ');
function renderPlaces() {
  const box = $('#placeChips'), cur = $('#origin').value.trim(), full = places.length >= 5;
  $('#placeCount').textContent = `자주 걷는 곳 ${places.length}/5`; $('#placeCount2').textContent = `${places.length}/5`;
  const isHere = Boolean(here && cur && cur === here.label), saved = places.find(p => p.label === cur);
  const temp = cur && !isHere && !saved ? cur : null; // 기록·추천·이번만 쓰기로 정한 출발지(저장 안 된 곳)
  const canSave = !full && (isHere || temp);
  box.innerHTML =
    `<button type="button" class="chip gps" role="radio" aria-checked="${isHere}" data-here>${locating ? '◎ 찾는 중…' : isHere ? '◎ ' + esc(here.label) : '◎ 현재 위치'}</button>`
    + places.map(p => `<button type="button" class="chip" role="radio" aria-checked="${p.label === cur}" data-place="${p.id}">${esc(short(p.label))}</button>`).join('')
    + (temp ? `<button type="button" class="chip" role="radio" aria-checked="true" data-temp>📍 ${esc(short(temp))}</button>` : '')
    + (canSave ? '<button type="button" class="chip add" id="placeSaveCur">☆ 이곳 저장</button>' : '')
    + `<button type="button" class="chip add" id="placeManage">${full ? '✎ 자주 걷는 곳 고치기' : '＋ 주소로 추가'}</button>`;
  $('#originNow').innerHTML = cur ? `📍 <b>${esc(cur)}</b>에서 출발해요` : '출발지를 골라 주세요';
  $('#originNow').classList.toggle('empty', !cur);
  box.querySelector('[data-here]').onclick = locateHere;
  box.querySelectorAll('[data-place]').forEach(b => b.onclick = async () => {
    const p = places.find(x => String(x.id) === b.dataset.place); setOrigin(p.label);
    try { places = (await api(`/v1/me/places/${p.id}/select`, { method: 'POST', body: '{}' })).places; renderPlaces(); } catch { /* 표시만 */ }
  });
  $('#placeManage').onclick = () => openPlaces();
  const sv = $('#placeSaveCur');
  if (sv) sv.onclick = async () => {
    sv.disabled = true;
    if (isHere) { if (await addPlace(here.coords)) setOrigin(places.find(p => p.selected)?.label ?? cur); }
    else if (await addPlace(temp)) setOrigin(places.find(p => p.selected)?.label ?? cur); else openPlaces(temp);
    renderPlaces();
  };
  $('#placeList').innerHTML = places.map(p => `<li><span>${p.selected ? '✓ ' : ''}${esc(p.label)}</span><button type="button" class="ghost small" data-del="${p.id}">지우기</button></li>`).join('') || '<li class="muted">아직 저장한 곳이 없습니다.</li>';
  $('#placeList').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { places = (await api(`/v1/me/places/${b.dataset.del}/delete`, { method: 'POST', body: '{}' })).places; renderPlaces(); });
  if ($('#placeAdd')) syncPlaceButtons();
}
async function loadPlaces() { try { places = (await api('/v1/me/places')).places; renderPlaces(); const s = places.find(p => p.selected); if (s && !$('#origin').value) setOrigin(s.label); } catch { /* 부가 기능 */ } }
async function addPlace(text) {
  $('#placeMsg').textContent = '';
  try { const r = await api('/v1/me/places', { method: 'POST', body: JSON.stringify({ text }) }); places = r.places; renderPlaces(); toast(`'${r.place.label}'을 저장했어요`); return true; }
  catch (e) { $('#placeMsg').textContent = e.message; toast(e.message); return false; }
}
// 저장 절차(어디물어 '출발지 추가'와 같음): ① 동네·도로명 입력 → ② 다음(카카오) 우편번호 검색에서 선택 → ③ 저장.
// 서버에는 시·도 시·군·구 읍·면·동까지만 보낸다(도로명·건물번호는 보내지도 저장하지도 않음).
let pickedPlace = null, postcodeLoading = null;
function loadPostcode() {
  if (window.daum?.Postcode) return Promise.resolve();
  return postcodeLoading ??= new Promise((ok, no) => {
    const urls = ['https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js', 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'];
    const tryNext = i => { if (i >= urls.length) { postcodeLoading = null; return no(new Error('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')); }
      const s = document.createElement('script'); s.src = urls[i]; s.async = true; s.onload = () => ok(); s.onerror = () => { s.remove(); tryNext(i + 1); }; document.head.appendChild(s); };
    tryNext(0);
  });
}
function closePostcode() { $('#postcodeWrap').hidden = true; $('#postcodeBox').innerHTML = ''; }
const coarseAddress = d => [d.sido, d.sigungu, d.bname1 || d.bname || ''].filter(Boolean).join(' ');
async function openPostcode(query) {
  try { await loadPostcode(); } catch (e) { $('#placeMsg').textContent = e.message; return; }
  const wrap = $('#postcodeWrap'), box = $('#postcodeBox'); box.innerHTML = ''; wrap.hidden = false;
  new window.daum.Postcode({ width: '100%', height: '100%', oncomplete: d => {
    closePostcode(); $('#placeInput').value = d.roadAddress || d.jibunAddress || coarseAddress(d); setPicked(coarseAddress(d));
  } }).embed(box, { q: query, autoClose: false });
  wrap.scrollIntoView({ block: 'nearest' });
}
function syncPlaceButtons() {
  const full = places.length >= 5;
  $('#postcodeOpen').disabled = !$('#placeInput').value.trim();
  $('#placeAdd').disabled = full || !pickedPlace; $('#placeOnce').disabled = !pickedPlace;
  if (full) $('#placeInput').placeholder = '5곳이 찼어요(저장은 하나를 지운 뒤, 이번만 쓰기는 가능)';
  else $('#placeInput').placeholder = '동네·도로명 입력 (예: 망원동)';
}
function setPicked(coarse) { pickedPlace = coarse || null; $('#placePicked').hidden = !pickedPlace; $('#placePickedText').textContent = pickedPlace ?? ''; syncPlaceButtons(); if (pickedPlace) $('#placeAdd').focus(); }
function openPlaces(query = '') {
  $('#settingsDialog').open && $('#settingsDialog').close();
  $('#placeMsg').textContent = ''; $('#placeInput').value = query; closePostcode(); renderPlaces(); setPicked(null); $('#placesDialog').showModal();
  if (query) openPostcode(query); else setTimeout(() => $('#placeInput').focus(), 50);
}
$('#placeInput').addEventListener('input', () => { if (pickedPlace) setPicked(null); else syncPlaceButtons(); });
$('#placeForm').addEventListener('submit', e => { e.preventDefault(); const q = $('#placeInput').value.trim(); $('#placeMsg').textContent = ''; if (!q) { $('#placeMsg').textContent = '찾을 동네나 도로명을 먼저 입력해 주세요.'; return; } openPostcode(q); });
$('#postcodeClose').onclick = closePostcode;
$('#placesClose').onclick = () => { closePostcode(); $('#placesDialog').close(); };
$('#placeAdd').onclick = async () => {
  if (!pickedPlace) { $('#placeMsg').textContent = '찾기에서 주소를 먼저 골라 주세요.'; return; }
  const btn = $('#placeAdd'); btn.disabled = true; btn.textContent = '저장 중…';
  const ok = await addPlace(pickedPlace); btn.textContent = '저장';
  if (ok) { $('#placeInput').value = ''; setPicked(null); $('#placesDialog').close(); closePostcode(); const s = places.find(p => p.selected); if (s) setOrigin(s.label); } else syncPlaceButtons();
};
// ☆ 저장: 현재 위치(좌표)는 그대로 저장하고, 글자로 적은 출발지는 주소 찾기를 거쳐 저장한다
$('#placeOnce').onclick = () => { if (!pickedPlace) return; const v = pickedPlace; $('#placeInput').value = ''; setPicked(null); closePostcode(); $('#placesDialog').close(); setOrigin(v); toast(`이번에는 '${v}'에서 출발해요`); };

// ---------- 오늘의 북 워킹(하루 한 번 말풍선, 음성은 버튼을 눌렀을 때만) ----------
let tipData = null, tipAudio = null, tipUrl = null;
const dailyKey = () => 'bookwalking.dailyAt.' + (state.auth?.user?.id ?? '');
let tipClosed = false;
function hideTipView() { $('#todayTip').hidden = true; }
function hideTip() { tipClosed = true; $('#todayTip').hidden = true; if (tipAudio) tipAudio.pause(); }
async function showDailyTip() {
  if (!state.auth || aiLocked || localStorage.getItem(dailyKey()) === kstDate(0)) return;
  try {
    const t = await api('/v1/suggest/daily', { timeoutMs: 30000 });
    if (!t?.available || !state.auth) return;
    localStorage.setItem(dailyKey(), kstDate(0)); tipData = t;
    $('#todayTipBadge').textContent = `🚶 오늘의 북 워킹 · ${t.basisLabel}`;
    $('#todayTipText').textContent = t.text; $('#todayTipSrc').textContent = '출처: ' + t.source;
    $('#todayTipVoice').hidden = !(t.voice && t.speechId); $('#todayTipVoice').textContent = '🔊 듣기';
    if (tipUrl) { URL.revokeObjectURL(tipUrl); tipUrl = null; tipAudio = null; }
    tipClosed = false; $('#todayTip').hidden = !document.querySelector('#tab-plan').classList.contains('active');
  } catch { /* 부가 기능: 실패하면 보이지 않음 */ }
}
$('#todayTipClose').onclick = hideTip;
$('#todayTipMore').onclick = () => { const a = tipData?.action; hideTip(); if (!a) return; setOrigin(a.origin); sel.situation = a.situation; sel.date = 'today'; drawForm(); (skipAskOnce = true, $('#planForm').requestSubmit()); };
$('#todayTipVoice').onclick = async () => {
  const b = $('#todayTipVoice');
  if (tipAudio && !tipAudio.paused) { tipAudio.pause(); tipAudio.currentTime = 0; b.textContent = '🔊 듣기'; return; }
  if (!tipAudio) {
    b.disabled = true; b.textContent = '불러오는 중…';
    try {
      const r = await fetch(`${state.api}/v1/tts/${tipData.speechId}`, { headers: { Authorization: 'Bearer ' + state.auth.token }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || '음성을 불러오지 못했습니다'); }
      tipUrl = URL.createObjectURL(await r.blob()); tipAudio = new Audio(tipUrl); tipAudio.onended = () => { b.textContent = '🔊 다시 듣기'; };
    } catch (e) { b.disabled = false; b.textContent = '🔊 듣기'; return toast(e.message); }
    b.disabled = false;
  }
  try { await tipAudio.play(); b.textContent = '⏹ 멈추기'; } catch { b.textContent = '🔊 듣기'; toast('소리를 재생하지 못했습니다. 무음 모드인지 확인해 주세요.'); }
};

// ---------- 내 기록(최근 30일 플랜) ----------
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const kst = iso => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return { date: `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}(${WD[d.getUTCDay()]})`, time: d.toISOString().slice(11, 16) }; };
async function loadHistory() {
  const box = $('#history'); box.innerHTML = '<p class="loading">기록을 불러오는 중…</p>';
  try {
    const { plans } = await api('/v1/me/plans?limit=100');
    if (!plans.length) { box.innerHTML = '<p class="empty">아직 만든 북 워킹이 없습니다. 오늘 탭에서 첫 북 워킹을 만들어 보세요!</p>'; return; }
    const days = {}; for (const p of plans) (days[kst(p.created_at).date] ??= []).push(p);
    box.innerHTML = Object.entries(days).map(([d, ps], i) => `<details class="hist-day"${i === 0 ? ' open' : ''}><summary><b>${esc(d)}</b><span class="muted">북 워킹 ${ps.length}개</span></summary>${ps.map(p => `
      <div class="hist-item">${safeUrl(p.cover) ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : '<div></div>'}<div>
        <div class="muted small-text">${esc(kst(p.created_at).time)} · ${esc(p.trip_date)} · ${esc(p.emoji ?? '')} ${esc(p.situation_label ?? p.situation ?? '')}</div>
        <b>${esc(p.sigungu ?? '')}</b> <span class="tag ${p.gate}">${esc(p.gate_name ?? p.gate ?? '')} ${p.score ?? ''}</span>
        <div class="small-text">${esc(p.course ?? '동네 산책')}${p.book ? ` · 『${esc(p.book)}』` : ''}${p.has_script ? ' · 🎧' : ''}</div>
        <div class="acts"><button type="button" class="ghost small" data-view="${p.id}">다시 보기</button><button type="button" class="ghost small" data-again="${p.id}" data-place="${esc(p.sigungu ?? '')}" data-sit="${esc(p.situation ?? '')}" data-comp="${esc(p.companion ?? '')}">오늘 다시</button></div>
      </div></div>`).join('')}</details>`).join('') + '<p class="muted small-text">플랜은 서비스 개선과 운영을 위해 30일간 보관된 뒤 자동으로 지워집니다.</p>';
    box.querySelectorAll('[data-view]').forEach(b => b.onclick = async () => { try { const r = await api('/v1/plans/' + b.dataset.view); lastPlan = { id: r.id, plan: r.plan, voice: true }; go('plan'); renderPlan(lastPlan); } catch (e) { toast(e.message); } });
    box.querySelectorAll('[data-again]').forEach(b => b.onclick = () => { setOrigin(b.dataset.place); sel.situation = b.dataset.sit || null; sel.companion = ['solo', 'pair', 'family', 'group'].includes(b.dataset.comp) ? b.dataset.comp : null; sel.date = 'today'; go('plan'); drawForm(); (skipAskOnce = true, $('#planForm').requestSubmit()); });
  } catch (e) { box.innerHTML = `<p class="msg">${esc(e.message)}</p>`; }
}
$('#btnHistory').onclick = () => go('history');

// ---------- 의견 보내기(별점 선택 + 500자, 하루 5번) ----------
let rating = null;
function setRating(v) { rating = rating === v ? null : v; document.querySelectorAll('.star').forEach(b => { b.classList.toggle('on', !!rating && Number(b.dataset.v) <= rating); b.setAttribute('aria-pressed', String(Number(b.dataset.v) === rating)); }); }
document.querySelectorAll('.star').forEach(b => b.onclick = () => setRating(Number(b.dataset.v)));
$('#opinionText').addEventListener('input', () => { $('#opinionCount').textContent = `${$('#opinionText').value.length}/500`; });
$('#opinionForm').onsubmit = async e => {
  e.preventDefault(); const text = $('#opinionText').value.trim(), m = $('#opinionMsg');
  if (!text) { m.textContent = '의견을 한 줄이라도 적어 주세요.'; return; }
  $('#opinionSend').disabled = true; m.textContent = '';
  try { await api('/v1/opinions', { method: 'POST', body: JSON.stringify({ rating, text }) }); $('#opinionText').value = ''; $('#opinionCount').textContent = '0/500'; rating = null; setRating(null); go('plan'); toast('소중한 의견 감사합니다! 더 나은 북 워킹으로 보답할게요.'); }
  catch (err) { m.textContent = err.message || '의견을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; }
  finally { $('#opinionSend').disabled = false; }
};

// ---------- 계정 설정·사용량·AI 잠금 ----------
$('#loginPolicy').textContent = policyText('user') + '. ' + DAY_NOTE;
let usage = null, aiLocked = false;
async function refreshUsage() {
  const token = state.auth?.token;
  if (!token) return;
  try {
    const me = await api('/v1/auth/me', { timeoutMs: 10000 });
    if (!me.user || token !== state.auth?.token) return;
    syncAccount(me);
    $('#btnAdmin').hidden = state.auth.user.role !== 'admin';
    usage = { limits: me.limits, today: me.usage.today, session: me.session?.messages ?? 0 };
    applyAiLock(me.ai);
  } catch { if (token === state.auth?.token) usage = null; /* 401은 자동 로그아웃 처리 */ }
}
function applyAiLock(ai) {
  aiLocked = ai && ai.available === false && state.auth?.user?.role !== 'admin';
  $('#aiLock').hidden = !aiLocked; if (aiLocked) { $('#aiLockMsg').textContent = ai.message || '지금은 AI 이용량이 모두 소진되어 잠시 이용할 수 없습니다.'; hideTip(); }
  $('#btnPlan').disabled = !!aiLocked;
}
async function openSettings() {
  await refreshUsage();
  const a = state.auth; if (!a) return;
  $('#accountInfo').textContent = `${a.user.displayName}(${a.user.loginId}) · ${ROLE_LABEL[a.user.role] ?? a.user.role} · 남은 시간 ${Math.floor(remaining() / 60)}분 ${remaining() % 60}초`;
  $('#usageInfo').textContent = usage ? `이번 세션(${usage.limits.sessionMinutes}분) 질문 ${usage.session}/${usage.limits.sessionMessages}건 · 오늘 질문 ${usage.today.messages}/${usage.limits.dailyMessages}건 · 오늘 로그인 ${usage.today.sessions}/${usage.limits.dailySessions}회 · 오늘 AI 토큰 ${usage.today.tokens}/${usage.limits.dailyTokens}개. ${DAY_NOTE}` : '사용량을 확인할 수 없습니다.';
  $('#settingsDialog').showModal();
}
$('#btnSettings').onclick = openSettings;
$('#btnHistory2').onclick = () => { $('#settingsDialog').close(); go('history'); };
$('#btnPlaces').onclick = () => openPlaces();
$('#btnPw').onclick = () => { $('#settingsDialog').close(); openPw(false); };
function showNotice(title, msg) { const d = $('#noticeDialog'); if (d.open) return; $('#noticeTitle').textContent = title; $('#noticeMsg').textContent = msg; try { d.showModal(); } catch { /* 로그인 화면 문구로 안내 */ } }

// ---------- 로그인 위치(허용한 경우만 세션당 1회, 서버가 약 100m 단위로 저장·30일 보관) ----------
function recordLoginLocation() {
  const sid = state.auth?.token?.slice(-12); if (!sid || sessionStorage.getItem('bookwalking.locAsked') === sid) return;
  sessionStorage.setItem('bookwalking.locAsked', sid);
  const post = body => api('/v1/auth/location', { method: 'POST', body: JSON.stringify(body), timeoutMs: 10000 }).catch(() => {});
  if (!navigator.geolocation) return post({ status: 'unavailable' });
  navigator.geolocation.getCurrentPosition(p => post({ status: 'granted', lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }), e => post({ status: e.code === 1 ? 'denied' : 'unavailable' }), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

// ---------- 무응답 자동 로그아웃: 15분(14분에 경고). 플랜을 만드는 중·음성 재생 중은 사용 중으로 본다 ----------
const IDLE_MS = 15 * 60 * 1000, IDLE_WARN_MS = 14 * 60 * 1000;
let lastActive = Date.now(), idleWarned = false;
const markActive = () => { lastActive = Date.now(); idleWarned = false; };
['pointerdown', 'touchstart', 'keydown', 'input', 'wheel', 'scroll'].forEach(ev => window.addEventListener(ev, markActive, { passive: true, capture: true }));
const audioPlaying = () => [...document.querySelectorAll('audio')].some(a => !a.paused) || (tipAudio && !tipAudio.paused);
setInterval(() => {
  if (!state.auth) { markActive(); return; }
  if (audioPlaying() || $('#btnPlan').textContent.includes('모으는 중')) { markActive(); return; }
  const idle = Date.now() - lastActive;
  if (idle >= IDLE_MS) { endSession('15분 동안 사용이 없어 자동 로그아웃했습니다.', 'idle'); showNotice('자동 로그아웃되었습니다', '15분 동안 사용이 없어 안전을 위해 로그아웃했습니다.\n다시 로그인해 주세요.'); }
  else if (idle >= IDLE_WARN_MS && !idleWarned) { idleWarned = true; toast('1분 동안 사용이 없으면 자동 로그아웃됩니다. 화면을 터치하면 계속 이용할 수 있어요.', 8000); }
}, 15000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') lastActive = Math.min(lastActive, Date.now()); });

// ---------- 로그인 ----------
function showLogin(msg = '') {
  timer?.stop(); timer = null; hideTip(); applyAiLock(null);
  for (const d of ['#settingsDialog', '#placesDialog', '#pwDialog', '#logoutDialog', '#destinationDialog']) if ($(d).open) $(d).close();
  $('#appView').hidden = true; $('#loginView').hidden = false; $('#loginMsg').textContent = msg; $('#btnAdmin').hidden = true;
  usage = null;
  const id = localStorage.getItem('bookwalking.loginId'); if (id) { $('#loginId').value = id; $('#rememberId').checked = true; }
}
let ending = false;
function endSession(msg, reason = 'logout') { if (ending) return; ending = true; logout(reason); lastPlan = null; $('#planResult').innerHTML = ''; showLogin(msg); ending = false; }
async function showApp() {
  $('#loginView').hidden = true; $('#appView').hidden = false;
  if (!situations.length) { try { situations = (await api('/v1/situations', { noAuth: true })).situations; } catch { situations = []; } }
  drawForm();
  if (!state.auth) return;
  $('#btnAdmin').hidden = state.auth.user?.role !== 'admin';
  markActive();
  timer?.stop();
  timer = startTimer($('#timer'), { onWarn: () => toast('1분 뒤 자동 로그아웃됩니다. 필요한 내용은 지금 확인해 주세요.', 8000), onExpire: () => { const min = sessionMinutes(); endSession(`${min}분 이용 시간이 끝나 로그아웃했습니다.`, 'expired'); showNotice('이용 시간이 끝났습니다', `로그인 1회에 ${min}분 이용할 수 있습니다.\n이용해 주셔서 감사합니다.`); } });
  if (state.auth.user?.mustChangePassword) openPw(true);
  refreshUsage();
  loadPlaces().then(showDailyTip);
  recordLoginLocation();
}
function openPw(forced = true) {
  $('#pwMsg').textContent = ''; $('#pwCur').value = ''; $('#pwNew').value = ''; $('#pwNew2').value = '';
  $('#pwReason').textContent = forced ? '처음 로그인했거나 관리자가 초기화한 계정입니다. 새 비밀번호를 정해 주세요.' : '지금 비밀번호와 새 비밀번호를 입력해 주세요.';
  $('#pwCancel').hidden = forced; $('#pwDialog').showModal();
}
$('#pwCancel').onclick = () => $('#pwDialog').close();
$('#pwDialog').addEventListener('cancel', e => { if ($('#pwCancel').hidden) e.preventDefault(); }); // 첫 로그인 변경은 닫지 못하게
$('#pwForm').onsubmit = async e => {
  e.preventDefault();
  if ($('#pwNew').value !== $('#pwNew2').value) { $('#pwMsg').textContent = '새 비밀번호 두 칸이 서로 다릅니다'; return; }
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
  } catch (err) {
    if (err.code === 'ACTIVE_SESSION') { $('#loginPw').value = ''; showNotice('다른 기기에서 이용 중이에요', err.message); }
    else if (err.code === 'LOGIN_DAILY_LIMIT') showNotice('오늘 로그인 횟수를 모두 쓰셨어요', '다음 날 한국 시간(KST) 0시부터 다시 로그인할 수 있습니다.');
    else $('#loginMsg').textContent = err.message;
  } finally { btn.disabled = false; }
};
// 로그아웃: 확인 창 먼저(확인 = 로그아웃, 취소 = 그대로)
$('#btnLogout').onclick = () => {
  const d = $('#logoutDialog');
  const update = () => { $('#logoutMsg').textContent = '이용해 주셔서 감사합니다.\n' + logoutUsage(usage?.today, usage?.limits); };
  update();
  refreshUsage().then(() => { if (d.open) update(); });
  d.returnValue = 'cancel';
  d.onclose = () => { if (d.returnValue === 'ok') endSession('로그아웃했습니다.'); else markActive(); };
  d.showModal();
};
setOnAuthLost(msg => endSession(msg || '다시 로그인해 주세요', 'lost'));
setOnMustChange(() => openPw(true));

(async () => {
  const h = await health();
  $('#serverLine').textContent = h.error ? `서버 미연결: ${state.api || '주소 없음'} (${h.error})` : `서버 연결됨 · ${state.api} · v${h.version}`;
  if (h.error) return showLogin('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  if (state.authMode === 'off' || state.auth) return showApp();
  showLogin();
})();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
