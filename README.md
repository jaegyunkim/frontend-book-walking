# frontend-book-walking · 북 워킹 모바일 웹

오늘 날씨에 걷기 좋은 길과 그 길에 어울리는 책 한 권, 2분 오디오 워킹을 만들어 주는 **북 워킹(Book Walking)** 의 모바일 웹입니다.

- 주소: https://jaegyunkim.github.io/frontend-book-walking/
- 백엔드: 비공개 `jaegyunkim/backend-book-walking` (맥미니 `127.0.0.1:8888`, Caddy HTTPS `/book-walking/`)
- 기반: `frontend-go-fishing`의 로그인·세션 모듈(`auth.js`)과 이용 신청 화면

## 화면
- **오늘**: 출발지·날짜·상황(예스24 상황별 베스트 11종)·동행·한마디 → 걷기 지수, 시간대별 날씨, 3줄 카드, 오늘의 책 3권, 두루누비 코스 3곳(해안 안전), 동네 공원·실내 독서 공간·서점·관광지·캠핑장·이동비, 방문 혼잡, 2분 오디오 워킹(대본 + 음성)
- **상황별 책**: 상황 × 연령 × 성별 예스24 베스트, 도서 검색
- **책장**: 담은 책
- **일기**: 걸은 코스·읽은 책·한 줄 기록, 누적 통계
- `admin.html`: 이용 신청 승인, 사용자, 최근 플랜, 코스 동기화, 운영 리포트

## 설정
- `config.js`의 `BOOKWALKING_API`(기본 `https://lonbekim.tplinkdns.com/book-walking`)
- 다른 서버를 시험할 때는 `?api=http://127.0.0.1:8888`(브라우저에 저장됨)
- 비밀키는 넣지 않습니다. 도서 정보 화면에는 예스24 출처와 상품 링크를 표시합니다.

## 로컬 실행
```bash
python3 -m http.server 8181   # 백엔드 ALLOWED_ORIGINS 에 http://localhost:8181 포함
npm test
```
