# PROGRESS · 가입 승인 탭 승인 완료 카드 '임시 비밀번호 생성' (task_0d0ee9fdee32, v0.4.26)

「신청 승인」 탭의 승인 완료(approved) 카드에만 '임시 비밀번호 생성' 버튼(aria-label '○○님의 임시 비밀번호 생성', 대기·거절 카드엔 없음, 기존 승인·거절·승인 회수 그대로). 사용자 목록 버튼과 같은 공용 함수 runResend(admin.js)를 써서 확인 창 → `POST /v1/admin/users/:id/resend-temp-password` → showSecret(승인 때와 같은 팝업, '메일 보내기'는 클릭 때만 approvalMailto(login_id, 비밀번호) 로 mailto 생성, approval-email.js 제목·본문 그대로) → 마스킹 주소 알림. 오류는 v0.4.25 resendFail(429 retryAfterSeconds 포함) 재사용.
계정 id 찾는 법: GET /v1/admin/registrations 행(id,login_id,display_name,status,…)에는 계정 id 가 없어(DB 의 user_id 는 목록 응답에 안 나옴) 백엔드 수정 없이, 버튼을 누르고 확인한 뒤 GET /v1/admin/users 에서 loginId(대소문자 무시)로 찾는다(findAccountId). 목록에 없으면 404, 사용 중이 아니면 409 로 처리해 API 호출 없이 쉬운 한국어 오류 알림.
파일: admin-resend.js(regResendButton·findAccountId), admin.js(runResend 추출·카드 연결), admin.css, test/admin-resend.test.mjs, 버전 0.4.26·sw 캐시 v55.
시험: npm test 62/62. 가짜 API+헤드리스 Chrome 320·375·768·1280: 승인 완료 3장에만 버튼, 가로 넘침 없음·버튼이 카드 안, 확인 창 문구·Esc(호출 0), 429·500·계정 없음(404)·정지(409) 알림(API 호출 없음), 성공 시 비밀번호 팝업+메일 보내기 버튼+마스킹 알림, 저장소·화면에 비밀번호 없음. 실제 호출 없음.

---

# PROGRESS · 관리자 '임시 비밀번호 메일 다시 보내기' (task_19ab5e834bae, v0.4.25)

사용자 목록의 사용 중(status active) 계정마다 버튼(aria-label '○○님에게 임시 비밀번호 메일 다시 보내기'). 누르면 확인 창(기존 dialog) → `POST /v1/admin/users/:id/resend-temp-password` → 서버는 메일을 보내지 않으므로(오너 결정) 응답의 tempPassword 를 기존 showSecret 창으로 한 번 보여 주고 '메일 보내기'(클릭 때만 approvalMailto 생성)로 메일 앱을 연다. 완료 알림에는 마스킹 주소(maskedEmail)만, 비밀번호는 알림·저장소에 안 남김. 429·기타 오류는 쉬운 한국어. 진행 중 버튼 비활성·aria-busy.
파일: admin-resend.js(신규, 문구·조건), admin.js, admin.html(알림 aria-live), admin.css, test/admin-resend.test.mjs, 버전 0.4.25·sw 캐시 v54.
시험: npm test 59/59. 가짜 API + 헤드리스 Chrome(320·375·768·1280): 정지 계정엔 버튼 없음, 가로 넘침 없음, 확인 창 문구·포커스 이동·Esc 닫힘(호출 0), 429·500 알림, 성공 시 비밀번호 창+마스킹 알림. 실제 전송·운영 호출 없음.
429 는 본문 retryAfterSeconds·reason(minute|day)을 읽어 안내(auth.js api() 오류에 두 필드 추가), 응답 유실 시 "1분 뒤 다시 발급" 안내를 오류 알림에 포함.
- [ ] 푸시·배포(백엔드 v0.1.26 배포 뒤 코디네이터 승인 필요)

---

# PROGRESS · 가입 신청 화면 안내 문구 2개 제거 (task_a98622d76f57, v0.4.24)

오너 지시로 register.html '북 워킹 이용 신청'에서 두 문단 제거: ① 베타 테스트 서비스·30일 이내 삭제 안내(.beta-note) ② 베타 테스터 한도 안내(#signupPolicy). register.js 의 한도 채움 코드(role-policy 가져오기·/healthz 호출)도 함께 제거. role-policy.js 값 자체는 다른 화면이 쓰므로 그대로. 입력칸·신청 버튼·돌아가기 링크 유지. 버전 0.4.24, sw 캐시 v53.
다른 화면 잔존 문구: app.js 로그인 '이용 안내'(#loginPolicy)·로그아웃 확인창·도움말(FAQ)이 policyText/DAY_NOTE 로 같은 한도 문구 사용, admin.js 권한 안내(policyGuide·'베타 테스터: 한 기기에서만 로그인…'). 수정하지 않음.

---

# (이전) PROGRESS · Manus 점검 보고서 반영 (task_e9109996f3cd, v0.4.23)

보고서: ~/Downloads/북워킹_마누스/북워킹_서비스_리포트/ 01·03·05(+02 우선순위 1). 백엔드 짝: v0.1.25 `walk.evidence`(배포 완료 통보 받음).
검증 도구(저장소 밖): 가짜 API(node, 127.0.0.1:8899) + python3 http.server 8181 + 헤드리스 Chrome(CDP). 스크린샷 /private/tmp/bw-manus-check/{before,final,noevidence}. 운영 API 에 쓰기 없음.

| # | 항목 | 재현(수정 전) | 수정 | 수정 후 |
|---|---|---|---|---|
| 1 | 머리줄 줄바꿈 | 320·360·375 에서 남은 시간 칸 높이 104·85·46px(세로로 쪼개짐) | 타이머를 버튼 묶음 밖으로, nowrap·flex:none, 안 들어가면 버튼 묶음만 둘째 줄 오른쪽 | 모든 폭 한 줄 글자(27px), 로그아웃 오른쪽 끝 12px 안 |
| 2 | 고정 버튼 가림 | Tab 포커스가 고정 '만들기' 아래 숨음(320×800: 11칸, ×480: 14칸) | html scroll-padding(머리줄 높이 --top-h·하단 메뉴+고정 버튼+safe-area), 버튼 둘레 카드색, 높이 560px 이하는 고정 안 함 | 4폭×3높이 모두 가려진 포커스 0 |
| 3 | 라디오 방향키 | 날짜·출발지·상황·누구와 모두 방향키 무반응, 칸마다 Tab | radio-group.js(roving tabindex·방향키·Home/End), 그룹 이름표, 출발지 저장·추가 버튼은 그룹 밖, 상황별 책·별점도 라디오로 | 방향키로 이동·선택, Tab 은 그룹당 1번 |
| 4 | 일기 날짜 잘림 | 320 날짜 칸 126px 에 '2026. 11. 2' | 374px 이하 날짜·별점 세로 | 320 날짜 칸 260px |
| 5 | 관리자 메뉴 | 오른쪽 흐림만, 왼쪽에 가려진 메뉴 표시 없음(자동 스크롤은 이미 있음) | at-start 클래스로 가려진 쪽 끝 흐림(양쪽) | 확인 |
| 6 | 포커스·대비 | 기본 1px 파란 테두리, 추천 버튼은 노란 테두리(대비 1.7) | 3px #24553F 통일. 대비 미달만: 강수확률 글자 4.06→5.64, 별점 1.42→3.63/1.86→3.32(30px), 오디오 설명 3.73→4.92, 고른 뒤 흐려진 추천 버튼 2.80→4.68 | |
| 7 | h1 | 화면마다 h2 뿐 | 화면 제목 h2→h1, 오늘은 숨김 h1 '오늘의 북 워킹', 결과는 숨김 h2, 탭 바꿀 때 문서 제목 | |
| 8 | CLS | 머리줄이 늦게 두 줄이 되며 0.074, 상황 목록 늦게 와 폼 밀림, 일기 통계 0.043, 책 목록 0.014 | 타이머·관리자 버튼 먼저, 폼 먼저 그리고 상황 칸 자리 확보(aria-busy), 일기 통계·책 목록 min-height | 오늘 0·책 0·책장 0·일기 0.003(375, 가짜 API 500ms 지연). 웹폰트 교체·오늘의 추천 카드는 남음 |
| 9 | 걷기 지수 근거 | - | evidence.js: walk.evidence 접이식(출처·역할·기준 시각 KST·몇 분 전·오래된/빠진 자료·이유), 없거나 모양 다르면 '' | 근거 없는 응답 화면에 아무것도 없음 확인 |
| 10 | 도움말 | - | 설정 창 '도움말 · 자주 묻는 질문' → helpDialog. 보관·위치·한도는 로그인 '이용 안내' li 를 그대로 복사 | |
| 11 | 문구 | - | 03 버튼 후보는 기존 용어(북 워킹 만들기·기록하기)와 겹치거나 사실과 달라(일기는 오늘 아닌 날도) 넣지 않음. '참고용·현장 확인' 문구만 근거·FAQ 에 | |

## 넣지 않은 것
- FAQ: 일기 직접 삭제(이용자 삭제 API 없음 — 백엔드 확인), 홈 화면 추가·앱 설치 방식, 문의처, 처리방침 초안·대괄호 자리표시자, 기상특보·안전 보장 문구, '각 3개' 같은 기획상 수치.
- 로그인 '이용 안내'의 "책장·걷기 일기·자주 걷는 곳은 직접 지울 때까지 보관돼요"는 지시대로 그대로 재사용했으나, 걷기 일기는 이용자가 지울 수 없어 문구가 오해 소지 있음 → 코디네이터 판단 필요(고치지 않음).

## 커밋·배포
- [x] 커밋 8462474 / [x] macmini 푸시 / [x] main fast-forward(780f5c1..8462474) / [x] 운영 사본(~/dev/frontend-book-walking) pull --ff-only / [x] Pages: index app.js?v=0.4.23, evidence.js 응답, sw.js 캐시 v52 확인

---

# (이전) PROGRESS · go-fishing 프론트엔드 11-21 변경 이식 (task_fb1e497031bd)

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
