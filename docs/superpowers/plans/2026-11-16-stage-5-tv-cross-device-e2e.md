# Stage 5: Cross-Device, Smart TV Navigation & End-to-End Acceptance Testing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement 10-foot Smart TV spatial navigation, complete TV cinema receiver mode, mobile/tablet responsive touch experience, and comprehensive end-to-end acceptance test suite covering all 12 platform acceptance criteria.

**Architecture:** Client-side spatial navigation engine maps remote D-Pad arrow keys and TV back keys to Euclidean 2D focus coordinates. Smart TV receiver page mounts synchronized video/webrtc player in view-only mode with audio unlock overlay. Responsive controls optimize for touch gestures and mobile viewports. Vitest E2E suite validates 3-participant concurrency locks, multi-tier sync drift, SSRF protection, LiveKit authorization, and HLS epoch revocation.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Lucide icons, Vitest, Supertest, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-16-private-watch-party-design.md`

## Global Constraints
- Strict 3-participant maximum enforced server-side.
- Smart TV 10-foot UI: High-contrast focus rings (`outline: 3px solid #F59E0B`), D-Pad navigation, remote keycode handling (10009 Tizen, 461 webOS, 13 Enter, 27 Escape).
- Mobile viewports: Touch gesture scrubbing, screen sharing publication limitation notice.
- Comprehensive end-to-end verification of all 12 blueprint acceptance criteria.

---

### Task 1: Smart TV Spatial Navigation Engine

**Files:**
- Create: `packages/shared/src/spatialNavigation.ts`
- Create: `apps/web/lib/spatialNavigation.ts`
- Create: `apps/server/tests/spatialNavigation.test.ts`

- [x] **Step 1: Write unit tests for spatial navigation 2D distance calculation and keycode dispatch**
- [x] **Step 2: Implement SpatialNavigator class supporting element registration, directional movement, and remote keys**
- [x] **Step 3: Run tests and verify they pass**
- [x] **Step 4: Commit**

---

### Task 2: Smart TV Receiver Integration

**Files:**
- Modify: `apps/web/app/tv/[slug]/page.tsx`
- Modify: `apps/web/components/player/VideoPlayer.tsx`

- [x] **Step 1: Integrate SpatialNavigator into TV receiver page**
- [x] **Step 2: Mount VideoPlayer and LiveKitScreenPlayer in receiver-only mode**
- [x] **Step 3: Add D-pad navigable audio unlock modal and TV remote status bar**
- [x] **Step 4: Verify Next.js compilation and commit**

---

### Task 3: Mobile & Tablet Responsive Optimizations

**Files:**
- Modify: `apps/web/app/room/[slug]/page.tsx`
- Modify: `apps/web/components/player/VideoPlayer.tsx`
- Modify: `apps/web/hooks/useLiveKitRoom.ts`

- [x] **Step 1: Add mobile touch gesture handling (tap to toggle controls, double tap seek)**
- [x] **Step 2: Add mobile screen share publisher warning (mobile browsers do not support getDisplayMedia)**
- [x] **Step 3: Add responsive cinema layout adjustments for portrait and landscape tablet/phone**
- [x] **Step 4: Commit**

---

### Task 4: Comprehensive End-to-End Acceptance Test Suite

**Files:**
- Create: `apps/server/tests/e2e/watchParty.e2e.test.ts`

- [x] **Step 1: Write E2E acceptance suite covering 12 blueprint acceptance criteria**
  - Test 1: Room creation & invite token hashing
  - Test 2: Host auto-join
  - Test 3: Viewer 1 & Viewer 2 joining (capacity = 3)
  - Test 4: 4th participant rejection with 409 Conflict (concurrency lock)
  - Test 5: Engine B playback sync state and monotonic revisions
  - Test 6: 3-way NTP clock sync offset
  - Test 7: Multi-tier drift correction with $R_{base}$ preservation
  - Test 8: Engine A LiveKit host/viewer token permissions
  - Test 9: Engine C pre-signed uploads & directory pre-creation
  - Test 10: Anti-SSRF protection against internal IPs
  - Test 11: Edge HLS token verification & epoch revocation
  - Test 12: TV spatial navigation and remote key mapping
- [x] **Step 2: Run all tests across workspaces (`npm test`)**
- [x] **Step 3: Run production Next.js build (`npm --workspace=@watchparty/web run build`)**
- [x] **Step 4: Commit**
