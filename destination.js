// 상세는 선택한 목적지 하나만 조회한다. 플랜 생성·다시 보기에는 추가 조회가 없다.
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = value => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const fmt = n => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(n);
const modes = { walk: '도보', bike: '자전거', transit: '대중교통', car: '자동차' };
export function pointOf(p) {
  const lat = num(p?.lat), lon = num(p?.lon);
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0) ? { lat, lon } : null;
}
const mapUrl = p => pointOf(p) ? `https://map.kakao.com/link/map/${encodeURIComponent(p.name)},${p.lat},${p.lon}` : null;
function placeLink(p) {
  let url;
  try { const u = new URL(p.url || p.homepage); if (u.protocol === 'https:') url = u.href; } catch { /* 외부 링크가 없으면 좌표 지도 */ }
  return url || mapUrl(p);
}
export function detailRequest(origin, item, mode, vehicle, efficiency, unitPrice) {
  const point = pointOf(item);
  const from = pointOf(origin) || (typeof origin === 'string' && origin.trim());
  if (!from || !point || !Object.hasOwn(modes, mode)) throw new Error('출발지와 목적지 위치를 확인해 주세요.');
  const body = { origin: from, destination: { ...point, name: item.name }, mode };
  if (item.source === '한국관광공사 국문 관광정보' && /^\d+$/.test(String(item.id))) body.destination.contentId = String(item.id);
  if (mode === 'car') {
    const e = num(efficiency), p = num(unitPrice);
    const entered = v => v != null && String(v).trim() !== '';
    if (!['gasoline', 'ev'].includes(vehicle) || (entered(efficiency) && (e === null || e <= 0 || e > 100)) || (entered(unitPrice) && (p === null || p < 0 || p > 10000))) throw new Error('연비·전비는 0 초과 100 이하, 단가는 0~10,000원으로 입력해 주세요.');
    body.vehicle = vehicle;
    if (e !== null) body.efficiency = e;
    if (p !== null) body.unitPrice = p;
  }
  return body;
}
function placeSection(title, items, status) {
  const rows = (items ?? []).map(p => {
    const link = placeLink(p);
    return `<li>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a>` : esc(p.name)}<small>${esc(p.address || '주소 미제공')}</small><small>${[num(p.distanceM) !== null ? `목적지에서 ${fmt(p.distanceM)}m` : '', p.source].filter(Boolean).map(esc).join(' · ')}</small></li>`;
  });
  return `<section><h3>${title}</h3>${rows.length ? `<ul>${rows.join('')}</ul>` : `<p class="muted">${status === 'unavailable' ? '제공처에서 정보를 불러오지 못했어요.' : '이 반경에서 찾은 장소가 없어요.'}</p>`}</section>`;
}
export function resultHtml(data) {
  const t = data.travel || {}, f = t.fuel;
  const duration = num(t.minutes), distance = num(t.distanceKm);
  const cost = v => num(v) === null ? '정보가 없어요' : `${fmt(v)}원`;
  const times = t.timeSource !== 'unavailable' && duration !== null ? `약 ${fmt(duration)}분` : '시간 정보가 없어요';
  const radius = num(data.radiusM) === null ? '목적지 주변' : `목적지 반경 ${fmt(data.radiusM / 1000)}km`;
  return `<section><h3>${esc(modes[t.mode] || '목적지')} 이동 · 편도</h3><p><b>${times}</b>${distance === null ? '' : ` · ${fmt(distance)}km`}${t.timeSource === 'estimate' ? ' (추정)' : t.timeSource === 'route' ? ' (경로 기준)' : ''}</p>${t.basis ? `<p class="muted">${esc(t.basis)}</p>` : ''}
    ${t.mode === 'car' ? `<p><b>예상 ${f?.type === 'ev' ? '충전비' : f ? '휘발유비' : '차량 에너지 비용'}</b> · 편도 ${cost(f?.oneWayKrw)} / 왕복 ${cost(f?.estimateKrw)}</p>${f?.basis ? `<p class="muted">${esc(f.basis)}</p>` : ''}<p class="muted">편도 통행료(별도): ${cost(t.toll)}</p>` : ''}</section>
    ${placeSection(`${radius} 관광지`, data.attractions, data.nearbyStatus?.attractions)}${placeSection(`${radius} 숙박`, data.lodgings, data.nearbyStatus?.lodgings)}`;
}
export function createDestinationDialog(doc, api) {
  const el = id => doc.getElementById(id);
  const dialog = el('destinationDialog'), form = el('destForm'), result = el('destResult');
  const mode = el('destMode'), vehicle = el('destVehicle'), efficiency = el('destEfficiency'), price = el('destPrice'), originInput = el('destOrigin');
  let lastPlan, active, version = 0, previousVehicle, values;
  function carFields() { el('destCar').disabled = el('destCar').hidden = mode.value !== 'car'; }
  function vehicleFields() {
    if (previousVehicle) values[previousVehicle] = [efficiency.value, price.value];
    const ev = vehicle.value === 'ev';
    el('destEfficiencyLabel').textContent = ev ? '전비 (km/kWh)' : '연비 (km/L)';
    el('destPriceLabel').textContent = ev ? '충전 단가 (원/kWh)' : '휘발유 가격 (원/L)';
    [efficiency.value, price.value] = values[vehicle.value]; previousVehicle = vehicle.value;
  }
  function invalidate() { ++version; el('destSubmit').disabled = false; result.textContent = '조건이 바뀌었어요. 다시 조회해 주세요.'; }
  form.oninput = invalidate;
  mode.onchange = () => { carFields(); invalidate(); };
  vehicle.onchange = () => { vehicleFields(); invalidate(); };
  el('destClose').onclick = () => dialog.close();
  dialog.onclose = () => { if (!dialog.open) { ++version; active = null; } };
  async function load() {
    const seq = ++version;
    try {
      const body = detailRequest(active.origin || originInput.value, active.item, mode.value, vehicle.value, efficiency.value, price.value);
      el('destSubmit').disabled = true; result.textContent = '이동 시간과 주변 장소를 불러오는 중…';
      const data = await api('/v1/destination/detail', { method: 'POST', body: JSON.stringify(body) });
      if (seq === version && dialog.open) {
        if (data.destination?.address) el('destAddress').textContent = data.destination.address;
        el('destOverview').textContent = data.destination?.overview || active.item.summary || active.item.line || '';
        el('destPhone').textContent = data.destination?.tel || active.item.tel ? '문의: ' + (data.destination?.tel || active.item.tel) : '';
        result.innerHTML = resultHtml(data);
      }
    } catch (e) { if (seq === version && dialog.open) result.textContent = `조회할 수 없어요. ${e.message}`; }
    finally { if (seq === version) el('destSubmit').disabled = false; }
  }
  form.onsubmit = e => { e.preventDefault(); load(); };
  return (plan, item) => {
    ++version; active = { origin: pointOf(plan.origin), item };
    el('destTitle').textContent = item.name;
    const url = mapUrl(item), link = placeLink(item);
    el('destInfo').innerHTML = `<p>${esc(item.kind)}</p><p class="muted" id="destAddress">${esc(item.address || item.sigun || '')}</p><p id="destOverview">${esc(item.summary || item.line || '')}</p><p id="destPhone" class="muted">${item.tel ? '문의: ' + esc(item.tel) : ''}</p>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">목적지 지도</a>` : ''}${link && link !== url ? ` · <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">장소 정보</a>` : ''}`;
    el('destFrom').textContent = active.origin ? `출발지: ${plan.origin.label || plan.place || `${active.origin.lat}, ${active.origin.lon}`}` : `이전 기록에 출발지 좌표가 없어요. 출발지를 확인한 뒤 조회하세요.`;
    originInput.disabled = el('destOriginField').hidden = !!active.origin;
    originInput.value = active.origin ? '' : plan.origin?.label || plan.place || '';
    if (lastPlan !== plan) {
      lastPlan = plan; mode.value = Object.hasOwn(modes, plan.transport) ? plan.transport : 'walk';
      vehicle.value = 'gasoline'; previousVehicle = null; values = { gasoline: ['', ''], ev: ['', ''] }; vehicleFields();
    }
    carFields();
    result.textContent = ''; el('destSubmit').disabled = false;
    dialog.showModal(); dialog.scrollTop = 0;
    if (active.origin) load();
  };
}
