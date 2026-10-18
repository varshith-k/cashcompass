FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1 CASHCOMPASS_OUTPUT=standalone
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ARG GIT_REVISION=unknown
ENV CASHCOMPASS_BUILD_SHA=$GIT_REVISION
LABEL org.opencontainers.image.revision=$GIT_REVISION
RUN groupadd --system --gid 1001 cashcompass && useradd --system --uid 1001 --gid cashcompass cashcompass
COPY --from=build --chown=cashcompass:cashcompass /app/.next/standalone ./
COPY --from=build --chown=cashcompass:cashcompass /app/.next/static ./.next/static
USER cashcompass
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=12s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/public/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
