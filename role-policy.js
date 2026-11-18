// 로그인 전 안내와 관리자의 역할 선택에 사용한다. 실제 한도와 사용량은 서버 응답을 따른다.
export const ROLE_LABEL = Object.freeze({ admin: '관리자', tester: '내부 테스터', user: '베타 테스터' });
export const ROLE_LIMITS = Object.freeze({
  admin: Object.freeze({ sessionMinutes: 60, sessionMessages: 50, dailyMessages: 100, dailySessions: 20, dailyTokens: 10000 }),
  tester: Object.freeze({ sessionMinutes: 30, sessionMessages: 30, dailyMessages: 50, dailySessions: 20, dailyTokens: 3000 }),
  user: Object.freeze({ sessionMinutes: 10, sessionMessages: 10, dailyMessages: 10, dailySessions: 1, dailyTokens: 1000 })
});
export const DAY_NOTE = '하루 한도는 한국 시간(KST) 0시에 초기화됩니다.';
export function policyText(role) {
  const l = ROLE_LIMITS[role];
  return `${ROLE_LABEL[role]}: 로그인 1회 ${l.sessionMinutes}분, 세션당 질문 ${l.sessionMessages}건, 하루 질문 ${l.dailyMessages}건, 하루 로그인 ${l.dailySessions}회, 하루 AI 토큰 ${l.dailyTokens.toLocaleString('ko-KR')}개`;
}
export function logoutUsage(today, limits) {
  if (!today || !limits) return `오늘 남은 로그인 횟수를 확인할 수 없습니다. ${DAY_NOTE}`;
  return `오늘 남은 로그인은 ${Math.max(0, limits.dailySessions - today.sessions)}회입니다(하루 ${limits.dailySessions}회). ${DAY_NOTE}`;
}
