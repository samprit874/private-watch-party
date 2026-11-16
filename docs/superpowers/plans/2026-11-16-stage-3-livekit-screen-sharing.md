# Stage 3: Screen Sharing via LiveKit (Engine A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement Engine A (WebRTC Screen Sharing via LiveKit SFU), including backend token minting with role-based permissions, 15-second host disconnect grace period, audio track detection, track replacement, and viewer rendering.

**Architecture:** LiveKit SFU handles WebRTC packet forwarding. The Node.js server mints LiveKit JWTs using `livekit-server-sdk`. Next.js web client uses `livekit-client` to publish and subscribe to screen and system audio tracks.

**Tech Stack:** `livekit-server-sdk`, `livekit-client`, Express, Socket.IO, React, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-16-private-watch-party-design.md`

## Global Constraints
- Maximum 3 active participants per room.
- Only the room Host (or authorized user) can publish screen share tracks.
- LiveKit API secret must never be exposed to the client.
- System audio must be detected; video-only warnings must be displayed when audio capture is unavailable.
- 15-second grace period for host reconnection before screen share terminates.

---

### Task 1: Backend LiveKit Token Service & Route

**Files:**
- Create: `apps/server/src/services/livekit.service.ts`
- Create: `apps/server/src/controllers/livekit.controller.ts`
- Create: `apps/server/src/routes/livekit.routes.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/tests/services/livekit.test.ts`

**Interfaces:**
- Produces: `LiveKitService.generateToken(roomId, userId, displayName, isHost): Promise<string>`.
- Route: `POST /api/rooms/:roomId/livekit-token` returning `{ token, serverUrl }`.

- [x] **Step 1: Write failing test for LiveKit token minting**
- [x] **Step 2: Implement LiveKit service and controller**
- [x] **Step 3: Run test and verify it passes**
- [x] **Step 4: Commit**

---

### Task 2: Screen Sharing Socket Lifecycle & Grace Period

**Files:**
- Modify: `apps/server/src/socket/socketServer.ts`
- Create: `apps/server/tests/socket/screenshare.test.ts`

**Interfaces:**
- Produces: Socket events `SCREEN_SHARE_START`, `SCREEN_SHARE_STOP`, `SCREEN_SHARE_INTERRUPTED`, `SCREEN_SHARE_AUDIO_STATUS`.
- Handles 15-second disconnect watchdog.

- [x] **Step 1: Write failing test for screen share socket state machine**
- [x] **Step 2: Implement socket handlers and 15s grace timer**
- [x] **Step 3: Run test and verify it passes**
- [x] **Step 4: Commit**

---

### Task 3: Client LiveKit Hook & Screen Share Publisher/Receiver

**Files:**
- Create: `apps/web/hooks/useLiveKitRoom.ts`
- Create: `apps/web/components/player/LiveKitScreenPlayer.tsx`
- Modify: `apps/web/components/player/VideoPlayer.tsx`
- Modify: `apps/web/app/room/[slug]/page.tsx`

**Interfaces:**
- Produces: `startScreenShare()`, `stopScreenShare()`, `replaceScreenTrack()`.
- Renders remote video track and audio track with platform compatibility badges.

- [x] **Step 1: Implement useLiveKitRoom hook**
- [x] **Step 2: Implement LiveKitScreenPlayer component**
- [x] **Step 3: Integrate Screen Share toggle into Room controls**
- [x] **Step 4: Verify Next.js build and commit**
