import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_LIMITS, policyText, logoutUsage } from '../role-policy.js';

for (const [role, values] of Object.entries({ admin: [60,50,100,20,10000], tester: [30,30,50,20,3000], user: [10,10,10,1,1000] })) {
  test(`${role}: 역할 안내와 남은 로그인`, () => {
    const [sessionMinutes, sessionMessages, dailyMessages, dailySessions, dailyTokens] = values;
    assert.deepEqual(ROLE_LIMITS[role], {sessionMinutes, sessionMessages, dailyMessages, dailySessions, dailyTokens});
    assert.ok(policyText(role).includes(`하루 로그인 ${dailySessions}회`));
    assert.ok(logoutUsage({sessions: 1}, ROLE_LIMITS[role]).includes(`남은 로그인은 ${dailySessions-1}회`));
    assert.match(logoutUsage({sessions: dailySessions+1}, ROLE_LIMITS[role]), /남은 로그인은 0회.*KST\) 0시/);
  });
}
test('사용량 조회 실패 시 남은 횟수를 추측하지 않는다', () => assert.match(logoutUsage(null, null), /확인할 수 없습니다/));

test('서버가 돌려준 역할·한도·만료 시각으로 기존 세션을 동기화한다', async () => {
  globalThis.location = {search: '', hostname: 'localhost'};
  globalThis.window = {};
  const store = new Map();
  globalThis.localStorage = globalThis.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v) };
  const { saveAuth, syncAccount, sessionMinutes, remaining, state } = await import('../auth.js');
  saveAuth({ token: 'test', minutes: 30, user: {role: 'tester'} });
  syncAccount({ role: 'admin', user: {role: 'admin'}, limits: ROLE_LIMITS.admin, remainingSec: 42 });
  assert.equal(sessionMinutes(), 60);
  assert.equal(remaining(), 42);
  assert.equal(state.auth.user.role, 'admin');
  assert.deepEqual(JSON.parse(store.get('bookwalking.auth')).user.limits, ROLE_LIMITS.admin);
});
