# Stage 4: Video Uploads & FFmpeg Pipeline (Engine C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement Engine C (Uploaded Videos), S3/R2 pre-signed upload flow, private token-authorized HLS media delivery, and an isolated FFmpeg worker generating adaptive multi-bitrate HLS ladders.

**Architecture:** Express upload endpoints generate storage keys and pre-signed URLs. Background worker claims jobs atomically via `SELECT ... FOR UPDATE SKIP LOCKED`, creates output directories, normalizes audio with `ffprobe` duration binding, generates multi-rendition HLS, validates `.ts` segments, and links to `media` table.

**Tech Stack:** Node.js, Express, TypeScript, FFmpeg/ffprobe, PostgreSQL, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.

**Spec:** `docs/superpowers/specs/2026-11-16-private-watch-party-design.md`

## Global Constraints
- Max 4GB per uploaded video.
- All HLS assets protected by HMAC token and `__Host-Media-Token` cookie.
- Output subdirectories (`rendition_0/`, etc.) must be pre-created before FFmpeg is executed.
- Silent audio injection must bind to explicit probed duration (`-t <duration>`).
- Exactly 1 active transcode job per VPS instance, capped to 1.5 CPU cores.

---

### Task 1: Upload Initiation & Pre-Signed S3/R2 Endpoint

**Files:**
- Create: `apps/server/src/services/storage.service.ts`
- Create: `apps/server/src/controllers/upload.controller.ts`
- Create: `apps/server/src/routes/upload.routes.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/tests/routes/upload.test.ts`

- [x] **Step 1: Write failing test for upload initiation**
- [x] **Step 2: Implement storage.service.ts and upload.controller.ts**
- [x] **Step 3: Run test and verify it passes**
- [x] **Step 4: Commit**

---

### Task 2: Token-Authorized Media Gateway & Epoch Revocation

**Files:**
- Create: `apps/server/src/services/mediaAuth.service.ts`
- Create: `apps/server/src/routes/hlsGateway.routes.ts`
- Create: `apps/server/tests/services/mediaAuth.test.ts`

- [x] **Step 1: Write failing test for HLS HMAC tokens and epoch revocation**
- [x] **Step 2: Implement mediaAuth.service.ts and hlsGateway.routes.ts**
- [x] **Step 3: Run test and verify it passes**
- [x] **Step 4: Commit**

---

### Task 3: FFmpeg Transcoding Worker

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/transcoder.ts`
- Create: `apps/worker/src/worker.ts`
- Create: `apps/worker/tests/transcoder.test.ts`

- [x] **Step 1: Write failing test for command synthesis and directory pre-creation**
- [x] **Step 2: Implement transcoder.ts and atomic job claim loop**
- [x] **Step 3: Run test and verify it passes**
- [x] **Step 4: Commit**

---

### Task 4: Frontend Upload Modal & HLS Player Integration

**Files:**
- Create: `apps/web/components/upload/UploadModal.tsx`
- Modify: `apps/web/components/player/VideoPlayer.tsx`
- Modify: `apps/web/app/room/[slug]/page.tsx`

- [x] **Step 1: Implement UploadModal with drag-and-drop and progress bar**
- [x] **Step 2: Add Upload Video button to room header and player**
- [x] **Step 3: Verify Next.js build and commit**
