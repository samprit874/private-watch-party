FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN npm ci
RUN npm --workspace=@watchparty/shared run build
RUN npm --workspace=@watchparty/server run build

FROM node:20-alpine
# Install FFmpeg and ffprobe for multi-rendition HLS transcoding
RUN apk add --no-cache ffmpeg

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/dist ./packages/shared/dist
COPY apps/server/package.json ./apps/server/
COPY apps/server/dist ./apps/server/dist
COPY apps/server/src/db/migrations ./apps/server/dist/db/migrations

RUN npm ci --omit=dev

EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
