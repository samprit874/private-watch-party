FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

RUN npm ci
RUN npm --workspace=@watchparty/shared run build
RUN npm --workspace=@watchparty/worker run build

FROM node:20-alpine
# Install FFmpeg and ffprobe for multi-rendition HLS transcoding
RUN apk add --no-cache ffmpeg

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/dist ./packages/shared/dist
COPY apps/worker/package.json ./apps/worker/
COPY apps/worker/dist ./apps/worker/dist

RUN npm ci --omit=dev

CMD ["node", "apps/worker/dist/worker.js"]
