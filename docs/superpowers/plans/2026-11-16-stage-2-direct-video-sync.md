# Stage 2: Direct Video Playback & Authoritative Sync Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Engine B (Direct Video URLs), Socket.IO authoritative playback synchronization (`PLAY`, `PAUSE`, `SEEK`, `RATE_CHANGE`), NTP-style clock offset calculation, multi-tier non-destructive speed slewing ($R_{base} \times M_{sync}$), anti-SSRF URL validation, and a custom Next.js video player with drift telemetry.

**Architecture:** Node.js Socket.IO server verifying `__Host-Session-Token` cookie, authoritative monotonic revision state machine, client-side NTP sync handshake, and HTML5 / HLS.js video player with drift indicator.

**Tech Stack:** Socket.IO, Socket.IO Client, HLS.js, Express, TypeScript, Vitest, React, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-16-private-watch-party-design.md`

## Global Constraints
- Maximum 3 active participants per room.
- Base playback rate ($R_{base}$) must be preserved across slewing.
- Slewing tiers: Deadband $< 0.20$s, Micro $\pm 2\%$, Moderate $\pm 6\%$, Hard seek $\ge 1.50$s.
- Anti-SSRF validator blocks private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`).
- No placeholders, TBD, or TODOs.

---

### Task 1: Socket.IO Server Setup & Session Handshake Authentication

**Files:**
- Create: `apps/server/src/socket/socketServer.ts`
- Create: `apps/server/src/socket/middleware/auth.middleware.ts`
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/tests/socket/auth.test.ts`

**Interfaces:**
- Consumes: RoomService.verifySession(), SESSION_COOKIE_NAME.
- Produces: Authenticated socket instance with `socket.data = { userId, roomId, role, displayName }`.

- [ ] **Step 1: Write failing test for socket authentication**
- [ ] **Step 2: Implement socketServer.ts and auth.middleware.ts**
- [ ] **Step 3: Run test and verify it passes**
- [ ] **Step 4: Commit**

---

### Task 2: NTP Clock Synchronization & Drift Calculation Engine

**Files:**
- Create: `packages/shared/src/clock.ts`
- Create: `packages/shared/tests/clock.test.ts`
- Create: `apps/server/src/socket/handlers/sync.handler.ts`

**Interfaces:**
- Produces: `calculateNtpOffset()`, `computeExpectedPosition()`, `computeDriftCorrection()`.

- [ ] **Step 1: Write failing test for NTP clock offset and drift slewing math**
- [ ] **Step 2: Implement clock.ts in @watchparty/shared**
- [ ] **Step 3: Run test and verify it passes**
- [ ] **Step 4: Commit**

---

### Task 3: Authoritative Playback State Machine & Socket Handlers

**Files:**
- Create: `apps/server/src/services/playback.service.ts`
- Create: `apps/server/src/socket/handlers/playback.handler.ts`
- Create: `apps/server/tests/socket/playback.test.ts`

**Interfaces:**
- Consumes: PostgreSQL playback_sessions table.
- Produces: Authoritative event handling for `PLAY`, `PAUSE`, `SEEK`, `RATE_CHANGE`, `REQUEST_SYNC` with monotonic revision tracking.

- [ ] **Step 1: Write failing test for authoritative playback state transitions**
- [ ] **Step 2: Implement playback.service.ts and playback.handler.ts**
- [ ] **Step 3: Run test and verify it passes**
- [ ] **Step 4: Commit**

---

### Task 4: Anti-SSRF URL Validation Service for Direct URLs

**Files:**
- Create: `apps/server/src/services/ssrfValidator.ts`
- Create: `apps/server/tests/services/ssrfValidator.test.ts`
- Create: `apps/server/src/routes/media.routes.ts`

**Interfaces:**
- Produces: `validateDirectMediaUrl(url: string)`: blocks internal subnets, checks MIME types, verifies reachable public video.

- [ ] **Step 1: Write failing test for SSRF validator**
- [ ] **Step 2: Implement ssrfValidator.ts**
- [ ] **Step 3: Run test and verify it passes**
- [ ] **Step 4: Commit**

---

### Task 5: Video Player Component & Frontend Sync Hook

**Files:**
- Create: `apps/web/hooks/useSocketSync.ts`
- Create: `apps/web/components/player/VideoPlayer.tsx`
- Create: `apps/web/components/player/DriftIndicator.tsx`
- Modify: `apps/web/app/room/[slug]/page.tsx`

**Interfaces:**
- Consumes: Socket.IO client, `@watchparty/shared` clock math.
- Produces: Synced HTML5 / HLS.js video player with live drift telemetry badge.

- [ ] **Step 1: Implement useSocketSync hook with slewing and hard seek logic**
- [ ] **Step 2: Implement VideoPlayer with custom scrub bar and play/pause controls**
- [ ] **Step 3: Integrate VideoPlayer into Room page**
- [ ] **Step 4: Verify Next.js build and commit**
