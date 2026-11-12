# Builds the admin console and serves it with nginx, which also forwards /api (and the live-view WebSocket) to the
# server running on Windows.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
ENV SERVER_HOST=host.docker.internal \
    SERVER_PORT=5000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
