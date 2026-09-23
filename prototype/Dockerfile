FROM node:24.19.0-alpine3.23 AS build

ARG VITE_USE_MOCK_API
ARG VITE_API_BASE_URL

ENV VITE_USE_MOCK_API=${VITE_USE_MOCK_API}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN test "${VITE_USE_MOCK_API}" = "false" \
    && test -n "${VITE_API_BASE_URL}"

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.28.0-alpine3.21 AS runtime

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist/client/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
