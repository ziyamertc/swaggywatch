# Nuxt (Nitro) — Docker imajı
# Render / Northflank / Google Cloud Run / Fly / Railway / Oracle hepsi kullanabilir.
#
# Not: node:22-slim (Debian/glibc) kullanıyoruz — Alpine (musl) esbuild'in
# native binary'siyle sorun çıkarabiliyor. Boyut farkı deploy için önemsiz.
FROM node:22-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NITRO_PORT=3000

COPY --from=build /app/.output ./.output
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
