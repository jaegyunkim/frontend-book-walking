// 기본 백엔드 주소(맥미니 Caddy HTTPS, 어디물어와 같은 도메인의 /book-walking 경로 → 127.0.0.1:8888). 비밀키는 절대 넣지 않습니다.
window.BOOKWALKING_API = 'https://lonbekim.tplinkdns.com/book-walking';
// 기본 주소에 연결되지 않을 때 차례로 시도하는 예비 주소
window.BOOKWALKING_API_FALLBACKS = ['https://121-175-197-249.sslip.io/book-walking'];
window.BOOKWALKING_PUBLIC_URL = 'https://jaegyunkim.github.io/frontend-book-walking/';
