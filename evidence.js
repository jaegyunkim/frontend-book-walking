// 걷기 지수 근거(백엔드 v0.1.25 walk.evidence) 접이식 요약. 표시만 하며 지수 산식·판정은 건드리지 않는다.
// 필드가 없거나 형태가 다르면(예전 플랜·예전 서버) 빈 문자열 → 아무것도 그리지 않는다.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { 'no-data': '자료 없음', error: '받지 못함', unauthorized: '연결 안 됨', 'missing-key': '연결 안 됨' };

/** ISO 시각 → 한국 시간 '11/23 14:00'(잘못된 값이면 null) */
export function kstShort(iso) {
  if (typeof iso !== 'string' || !iso) return null;
  const t = Date.parse(iso); if (!Number.isFinite(t)) return null;
  const d = new Date(t + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
/** 분 → '3시간 30분 전' */
export function agoText(min) {
  const m = Math.round(Number(min)); if (!Number.isFinite(m) || m < 0) return null;
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60), r = m % 60;
  return h >= 48 ? `${Math.floor(h / 24)}일 전` : `${h}시간${r ? ` ${r}분` : ''} 전`;
}
/** 항목 하나의 상태 문구 */
export function itemState(it) {
  if (it.status === 'ok') return it.used === false ? '점수에 안 씀' : '반영';
  return STATUS[it.status] ?? '확인 못 함';
}

/** walk.evidence → <details> HTML. 없거나 모양이 다르면 '' */
export function evidenceHtml(ev) {
  if (!ev || typeof ev !== 'object' || !Array.isArray(ev.items)) return '';
  const items = ev.items.filter(it => it && typeof it === 'object' && it.provider && it.status !== 'not-requested');
  if (!items.length) return '';
  const nStale = items.filter(it => it.stale === true && it.used !== false).length;
  const nMiss = items.filter(it => it.status !== 'ok').length;
  const flags = [nStale ? `오래된 자료 ${nStale}` : '', nMiss ? `빠진 자료 ${nMiss}` : ''].filter(Boolean).join(' · ');
  const checked = kstShort(ev.checkedAt);
  const rows = items.map(it => {
    const base = kstShort(it.baseAt), ago = agoText(it.ageMinutes), st = itemState(it);
    const when = base ? `${base} 기준${ago ? ` · ${ago}` : ''}` : '';
    const bad = it.status !== 'ok', old = it.stale === true;
    return `<li class="${bad ? 'miss' : old ? 'old' : 'ok'}"><div class="eb-head"><b>${esc(it.provider)}</b><span class="eb-state">${esc(st)}${old ? ' · 오래된 자료' : ''}</span></div>`
      + `${it.role ? `<div class="eb-role">${esc(it.role)}</div>` : ''}${when ? `<div class="eb-when">${esc(when)}</div>` : ''}${it.reason ? `<div class="eb-reason">${esc(it.reason)}</div>` : ''}</li>`;
  }).join('');
  return `<details class="walk-basis"><summary><span class="wb-title">걷기 지수 근거 보기</span>${flags ? `<span class="wb-flag">⚠ ${esc(flags)}</span>` : ''}</summary>`
    + `<p class="wb-lead">${[ev.basis ? `계산 기준: ${esc(ev.basis)}` : '', checked ? `확인 시각: ${esc(checked)}(한국 시간)` : ''].filter(Boolean).join(' · ')}</p>`
    + `<ul class="eb-list">${rows}</ul><p class="wb-note">근거는 참고용이에요. 나서기 전에 현장 날씨도 한 번 더 확인해 주세요.</p></details>`;
}
