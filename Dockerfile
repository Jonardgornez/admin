# pc-server (default target): builds the admin console and serves it with nginx, which also forwards /api (and the
# live-view WebSocket) to the server running on Windows. See DOCKER.md.
# Development (`target: dev`, used by ../compose.yaml): runs the Vite dev server against a bind-mounted source tree.

FROM node:22-alpine AS deps
LABEL app=lykantra-admin
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
LABEL app=lykantra-admin
ENV SERVER_HOST=host.docker.internal \
    SERVER_PORT=5000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
