// 북 워킹 관리자 화면(관리자 계정 로그인 상태에서만). 로그인은 서비스 화면에서 하고, 같은 탭 세션 토큰을 쓴다.
import { state, api, health } from './auth.js?v=0.1.2';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = d => d ? new Date(new Date(d).getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '-';
const say = m => { $('#admMsg').textContent = m; };
async function load() {
  const [h, me] = [await health(), state.auth ? await api('/v1/auth/me').catch(e => ({ error: e.message })) : null];
  if (h.error) return say('서버에 연결하지 못했습니다: ' + h.error);
  if (!me || me.error || me.role !== 'admin') return say('관리자 계정으로 서비스 화면에서 먼저 로그인해 주세요(같은 탭).');
  $('#admBody').hidden = false; say('');
  const [regs, users, plans, model] = await Promise.all([api('/v1/admin/registrations'), api('/v1/admin/users'), api('/v1/admin/plans?limit=50'), api('/v1/admin/model')]);
  $('#admMetrics').innerHTML = `<div class="metric"><div class="metric-num">${users.users.length}</div><div class="metric-label">계정(정원 ${regs.capacity?.users?.max ?? "-"})</div></div><div class="metric"><div class="metric-num">${h.courses?.count ?? '-'}</div><div class="metric-label">두루누비 코스 · ${t(h.courses?.syncedAt)}</div></div><div class="metric"><div class="metric-num">${model.ai.available ? '정상' : '잠김'}</div><div class="metric-label">AI ${esc(model.llm.model ?? '-')} · v${esc(h.version)}</div></div>`;
  $('#regRows').innerHTML = regs.requests.map(r => `<tr><td>${t(r.created_at)}</td><td>${esc(r.login_id)}</td><td>${esc(r.display_name)}</td><td>${esc(r.status)}</td><td class="actions">${r.status === 'pending' ? `<button class="ghost small" data-rev="${r.id}" data-a="approve">승인</button><button class="ghost small" data-rev="${r.id}" data-a="reject">거절</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">신청 없음</td></tr>';
  $('#userRows').innerHTML = users.users.map(u => `<tr><td>${esc(u.loginId)}</td><td>${esc(u.displayName)}</td><td>${esc(u.role)}</td><td>${esc(u.status)}</td><td>${u.today.messages}건 · ${u.today.tokens}토큰</td><td>${t(u.lastLoginAt)}</td><td class="actions"><button class="ghost small" data-u="${u.id}" data-p='{"status":"${u.status === 'active' ? 'disabled' : 'active'}"}'>${u.status === 'active' ? '중지' : '재개'}</button><button class="ghost small" data-u="${u.id}" data-p='{"resetPassword":true,"unlock":true}'>비번 초기화</button></td></tr>`).join('');
  $('#planRows').innerHTML = plans.plans.map(p => `<tr><td>${t(p.created_at)}</td><td>${esc(String(p.trip_date).slice(0, 10))}</td><td>${esc(p.sigungu)}</td><td>${esc(p.situation)}</td><td>${p.score ?? '-'} ${esc(p.gate ?? '')}</td><td>${esc(p.course ?? '-')}</td><td>${esc(p.book ?? '-')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">아직 없음</td></tr>';
  // 모바일(720px 이하) 카드형: 각 칸에 표 머리글을 붙인다
  document.querySelectorAll('.adm table').forEach(t => { const hs = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim()); t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (td.colSpan > 1) return; td.dataset.label = hs[i] ?? ''; })); });
  document.querySelectorAll('[data-rev]').forEach(b => b.onclick = async () => { const r = await api(`/v1/admin/registrations/${b.dataset.rev}/review`, { method: 'POST', body: JSON.stringify({ action: b.dataset.a }) }).catch(e => ({ error: e.message })); $('#opsOut').textContent = r.error ?? (r.tempPassword ? `승인 완료. 임시 비밀번호(이 화면에서 1회만 표시): ${r.tempPassword}` : '처리했습니다'); load(); });
  document.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => { const r = await api(`/v1/admin/users/${b.dataset.u}`, { method: 'PATCH', body: b.dataset.p }).catch(e => ({ error: e.message })); $('#opsOut').textContent = r.error ?? (r.tempPassword ? `임시 비밀번호(1회 표시): ${r.tempPassword}` : '변경했습니다'); load(); });
}
$('#btnSync').onclick = async () => { $('#opsOut').textContent = '동기화 중…'; const r = await api('/v1/admin/courses/sync', { method: 'POST', body: '{}', timeoutMs: 120000 }).catch(e => ({ error: e.message })); $('#opsOut').textContent = JSON.stringify(r, null, 1); load(); };
$('#btnReport').onclick = async () => { const r = await api('/v1/admin/reports/generate', { method: 'POST', body: '{}' }).catch(e => ({ error: e.message })); $('#opsOut').textContent = r.error ?? `${r.report.date} ${r.report.status}\n${r.report.summary ?? ''}`; };
$('#btnRecheck').onclick = async () => { const r = await api('/v1/admin/model/recheck', { method: 'POST', body: '{}' }).catch(e => ({ error: e.message })); $('#opsOut').textContent = JSON.stringify(r.ai ?? r, null, 1); };
load().catch(e => say(e.message));
