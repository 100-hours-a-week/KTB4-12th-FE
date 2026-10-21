FROM node:24.19.0-alpine3.23 AS build

# 의존성 설치는 Vite 설정과 독립적으로 캐시. 설정 변경 시 앱 빌드만 재실행.
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

ARG VITE_USE_MOCK_API
ARG VITE_API_BASE_URL
ARG VITE_BUG_REPORT_ENDPOINT
ARG VITE_SENTRY_DSN

ENV VITE_USE_MOCK_API=${VITE_USE_MOCK_API}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_BUG_REPORT_ENDPOINT=${VITE_BUG_REPORT_ENDPOINT}
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

RUN test "${VITE_USE_MOCK_API}" = "false" \
    && test -n "${VITE_API_BASE_URL}" \
    && test -n "${VITE_BUG_REPORT_ENDPOINT}" \
    && test -n "${VITE_SENTRY_DSN}"

RUN npm run build

FROM nginx:1.28.0-alpine3.21 AS runtime

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist/client/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
