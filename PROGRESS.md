# PROGRESS · go-fishing 프론트엔드 11-21 변경 이식 (task_fb1e497031bd)

원본: ~/dev/frontend-go-fishing 53b989e → d61ca41 → daedae6 → 9887317 (v1.19.0~v1.22.0)
백엔드 짝: backend-book-walking 워크트리 bw-backend-session-limits (go-fishing 1da0a65 이식: 최근 24시간 로그인 창 `logins {limit, used, left, nextAt}`, LOGIN_DAILY_LIMIT 에 `nextLoginAt`·`loginLimit`)

| 단계 | 원본 | 이 레포 | 상태 |
|---|---|---|---|
| 1 | 53b989e 한도 창·계정 한도 기준 안내 | v0.4.19 | 완료 b22e0c3 |
| 2 | d61ca41 남은 토큰·세션 시간 실시간·로그아웃 안내·토큰 잠금·지우기 | v0.4.20 | 완료 27ded9d |
| 3 | daedae6 추천 질문 버튼 | v0.4.21 | 완료 3b71e32 |
| 4 | 9887317 카드·행·링크를 버튼처럼 | v0.4.22 | 완료 451397b |
| 5 | 코디네이터 배포 승인 → macmini·main 푸시 → Pages 확인 | - | 대기 |

## 메모
- 1단계: 이 레포 관리자 한도 창은 이미 모든 칸 수정 가능(백엔드 `patch.limits`)이라 입력값 안내·목록 표시·문구만 옮김.
- 버전 올리기: `?v=` 쿼리(index/admin/register.html, register/visit/admin/app.js), package.json, sw.js 캐시 번호 +1.
- 3단계: 대화형 추천 질문 버튼이 없어 오늘의 추천·기록 버튼에 적용. 백엔드 v0.1.24(6470e8d) 배포 완료 통보 받음 → 커밋 후 바로 푸시해도 됨(코디네이터).
