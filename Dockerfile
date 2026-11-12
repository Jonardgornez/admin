# Builds the admin console and serves it with nginx, which also forwards /api (and the live-view WebSocket) to the server.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
# The console listens on loopback only, like the server's admin port. Both ports can be changed in compose.yaml.
ENV ADMIN_PORT=5173 \
    SERVER_PORT=5000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
