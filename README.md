TwelveChess - 실시간 십이장기 멀티플레이어 웹 게임

TwelveChess는 Firebase Realtime Database를 기반으로 한
2인용 십이장기 웹 게임입니다.
별도의 서버 없이 GitHub Pages와 Firebase만으로 실시간 플레이가 가능합니다.

---------------------------
기능 특징

- 2인 동시 접속 시 자동 매칭
- 실시간 턴 동기화 (player1 / player2)
- 기물 이동 및 승급 (子 → 候)
- 잡은 기물 표시 및 다시 놓기
- 왕 제거 또는 왕 생존 조건으로 승리
- 서버리스 구조 (Firebase만 사용)

---------------------------
폴더 구조

TwelveChess/
├── index.html           # 닉네임 + 방 ID 입력
├── game.html            # 게임 화면
├── style.css            # UI 스타일
├── firebase-config.js   # Firebase 설정 (웹 SDK)
├── game.js              # 게임 로직 (Firebase 연동)
└── README.md            # 프로젝트 설명

---------------------------
실행 방법

1. Firebase 설정
- Firebase 프로젝트 생성
- Realtime Database 활성화
- 아래와 같은 규칙 적용 (테스트용)

{
  "rules": {
    ".read": true,
    ".write": true
  }
}

- firebase-config.js에 본인의 설정 값 삽입

2. 로컬 테스트
- index.html 파일을 브라우저에서 열기
- Firebase는 HTTPS 또는 localhost에서만 동작함
- VSCode의 Live Server 확장 추천

3. GitHub Pages 배포
- GitHub 저장소 생성
- TwelveChess/ 폴더 전체 업로드
- Settings → Pages → Branch: main / root 선택
- 배포 주소 접속 (예: https://yourid.github.io/TwelveChess/)

---------------------------
방 생성 규칙

- 동일한 방 ID를 입력한 두 명이 접속하면 자동으로 player1 / player2로 배정
- 방 ID는 영문 또는 숫자로 구성 (한글 X)
- 한 방에는 최대 2명까지만 입장 가능

---------------------------
기술 스택

- Firebase Realtime Database
- HTML / CSS / JavaScript (ES Modules)
- GitHub Pages (정적 호스팅)

---------------------------
개발자

- 제작자: 재형 (이재형, JaeHyeong Lee)
- Firebase 프로젝트 ID: twelvechess-f1969