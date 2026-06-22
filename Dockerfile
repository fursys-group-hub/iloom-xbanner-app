# 일룸 X배너 어플 — 레일웨이(Railway) 배포용 이미지
# Playwright(Chromium)로 인쇄용 PNG/PDF를 만들기 때문에
# 일반 Node 환경이 아니라 브라우저까지 깔린 서버 환경이 필요해요.

FROM node:20-bookworm-slim

WORKDIR /repo

# Ghostscript: 인쇄용 CMYK PDF 변환에 필요 (없으면 코드가 RGB로 자동 폴백)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ghostscript \
 && rm -rf /var/lib/apt/lists/*

# 1) 앱 의존성 먼저 설치 (소스보다 먼저 복사하면 캐시가 잘 들어 빌드가 빨라요)
COPY app/package.json app/package-lock.json ./app/
RUN cd app && npm ci --omit=dev

# 2) Playwright Chromium + 필요한 OS 라이브러리 설치
#    (--with-deps 가 apt 패키지까지 알아서 깔아줘요)
RUN cd app && npx playwright install --with-deps chromium

# 3) 저장소 전체 복사
#    (server.js 가 상위 폴더의 assets/ 를 참조하므로 app/ 만이 아니라 전체가 필요)
COPY . .

ENV NODE_ENV=production
# PORT 는 런타임에 주입 — server.js 가 process.env.PORT 를 읽음 (없으면 3000)
EXPOSE 3000
CMD ["node", "app/server.js"]
