# Stage 1: Room Infrastructure & Guest Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the foundational monorepo workspace, containerized PostgreSQL environment, schema migrations with triggers, guest session authentication, and concurrency-safe room creation/joining API strictly enforcing the 3-participant limit.

**Architecture:** Monorepo with npm workspaces containing Express REST API, shared TypeScript schemas, and Next.js frontend. PostgreSQL 16 database with triggers for atomic room locking (`SELECT ... FOR UPDATE`), SHA-256 token hashing, and session management.

**Tech Stack:** Node.js, Express, TypeScript, PostgreSQL 16, Drizzle ORM (or raw pg with Kysely/SQL migrations), Jest / Vitest for testing, Next.js 14/15, Tailwind CSS, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-16-private-watch-party-design.md`

## Global Constraints

- Monorepo root is `d:\testing\Streaming Platform`.
- Node.js version $\ge 18.0.0$, TypeScript $\ge 5.0$.
- Maximum 3 active participants per room strictly enforced by DB row locking.
- All secrets (invite tokens, session tokens) must be stored in PostgreSQL as SHA-256 hashes.
- Guest sessions must use cryptographic tokens stored in `HttpOnly; Secure; SameSite=Lax` cookies.
- No placeholders, TBD, or TODOs in task deliverables.

---

### Task 1: Monorepo Foundation & Workspace Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`

**Interfaces:**
- Produces: Monorepo workspace configuration (`apps/*`, `packages/*`), shared constants (`MAX_PARTICIPANTS = 3`), shared TypeScript interfaces (`User`, `Room`, `Participant`).

- [ ] **Step 1: Write root workspace configuration and tsconfig**

```json
// package.json
{
  "name": "private-watch-party",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "npm run --workspaces build",
    "test": "npm run --workspaces test",
    "dev:server": "npm --workspace=@watchparty/server run dev",
    "dev:web": "npm --workspace=@watchparty/web run dev"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create root tsconfig.json and .gitignore**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Define packages/shared with core domain types and constants**

```typescript
// packages/shared/src/constants.ts
export const MAX_ROOM_PARTICIPANTS = 3;
export const ROOM_EXPIRY_HOURS = 24;
export const SESSION_COOKIE_NAME = '__Host-Session-Token';

// packages/shared/src/types.ts
export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isGuest: boolean;
  email?: string | null;
  createdAt: Date;
}

export interface Room {
  id: string;
  slug: string;
  inviteTokenHash: string;
  hostId: string;
  title: string;
  isLocked: boolean;
  maxParticipants: number;
  currentMediaId?: string | null;
  mediaSecret: string;
  mediaEpoch: number;
  isSuspended: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface Participant {
  id: string;
  roomId: string;
  userId: string;
  sessionTokenHash: string;
  socketId?: string | null;
  role: 'host' | 'co-host' | 'viewer';
  isConnected: boolean;
  joinedAt: Date;
  lastSeenAt: Date;
  disconnectedAt?: Date | null;
}
```

- [ ] **Step 4: Create docker-compose.yml for local PostgreSQL**

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: watchparty-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: watchparty
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 5: Verify workspace build and commit**

```bash
git add package.json tsconfig.json docker-compose.yml .gitignore .env.example packages/shared
git commit -m "chore: scaffold monorepo workspace and shared package"
```

---

### Task 2: Database Schema & Migration Runner

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/db/migrations/001_initial_schema.sql`
- Create: `apps/server/src/db/migrate.ts`
- Create: `apps/server/src/db/pool.ts`
- Create: `apps/server/tests/db/schema.test.ts`

**Interfaces:**
- Consumes: PostgreSQL connection string from environment.
- Produces: Initialized PostgreSQL database with 8 tables and `enforce_room_capacity()` row-locking trigger.

- [ ] **Step 1: Write migration SQL script with triggers and constraints**

```sql
-- apps/server/src/db/migrations/001_initial_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(64) NOT NULL,
    avatar_url VARCHAR(255),
    is_guest BOOLEAN NOT NULL DEFAULT TRUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(32) NOT NULL UNIQUE,
    invite_token_hash VARCHAR(64) NOT NULL UNIQUE,
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(128) NOT NULL DEFAULT 'Private Watch Party',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    max_participants SMALLINT NOT NULL DEFAULT 3 CHECK (max_participants <= 3),
    current_media_id UUID,
    media_secret VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    media_epoch INTEGER NOT NULL DEFAULT 1,
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    socket_id VARCHAR(64),
    role VARCHAR(16) NOT NULL DEFAULT 'viewer' CHECK (role IN ('host', 'co-host', 'viewer')),
    is_connected BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    CONSTRAINT unique_user_per_room UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    engine_type VARCHAR(20) NOT NULL CHECK (engine_type IN ('screen_share', 'direct_url', 'upload')),
    title VARCHAR(255) NOT NULL,
    source_url TEXT,
    duration DOUBLE PRECISION DEFAULT 0.0,
    mime_type VARCHAR(64),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rooms ADD CONSTRAINT fk_rooms_current_media 
    FOREIGN KEY (current_media_id) REFERENCES media(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed')),
    progress_percentage SMALLINT DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    retry_count SMALLINT NOT NULL DEFAULT 0,
    max_retries SMALLINT NOT NULL DEFAULT 3,
    error_message TEXT,
    hls_master_key VARCHAR(512),
    renditions JSONB DEFAULT '[]'::jsonb,
    locked_by_worker VARCHAR(64),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS playback_sessions (
    room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'paused' CHECK (status IN ('playing', 'paused')),
    position DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    base_playback_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    server_timestamp BIGINT NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Concurrency-Safe Room Capacity Trigger Function
CREATE OR REPLACE FUNCTION enforce_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
    room_max SMALLINT;
BEGIN
    IF NEW.is_connected = TRUE THEN
        SELECT max_participants INTO room_max 
        FROM rooms 
        WHERE id = NEW.room_id 
        FOR UPDATE;
        
        SELECT COUNT(*) INTO active_count 
        FROM participants 
        WHERE room_id = NEW.room_id 
          AND is_connected = TRUE 
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
        
        IF active_count >= room_max THEN
            RAISE EXCEPTION 'ROOM_CAPACITY_EXCEEDED: Room has reached maximum of % participants', room_max;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_room_capacity ON participants;
CREATE TRIGGER trg_check_room_capacity
BEFORE INSERT OR UPDATE OF is_connected ON participants
FOR EACH ROW EXECUTE FUNCTION enforce_room_capacity();
```

- [ ] **Step 2: Write failing unit test verifying schema & capacity trigger**

```typescript
// apps/server/tests/db/schema.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool';

describe('Database Schema & Triggers', () => {
  it('should enforce 3-participant limit via trigger', async () => {
    // Attempting to insert 4 active participants into the same room must throw ROOM_CAPACITY_EXCEEDED
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query("INSERT INTO users (display_name) VALUES ('Host') RETURNING id");
      const hostId = userRes.rows[0].id;
      const roomRes = await client.query(
        "INSERT INTO rooms (slug, invite_token_hash, host_id) VALUES ('test-slug', 'hash1', $1) RETURNING id",
        [hostId]
      );
      const roomId = roomRes.rows[0].id;

      // Insert 3 participants
      for (let i = 1; i <= 3; i++) {
        const u = await client.query("INSERT INTO users (display_name) VALUES ($1) RETURNING id", [`User ${i}`]);
        await client.query(
          "INSERT INTO participants (room_id, user_id, session_token_hash, is_connected) VALUES ($1, $2, $3, TRUE)",
          [roomId, u.rows[0].id, `sess_${i}`]
        );
      }

      // 4th participant must fail
      const u4 = await client.query("INSERT INTO users (display_name) VALUES ('User 4') RETURNING id");
      await expect(
        client.query(
          "INSERT INTO participants (room_id, user_id, session_token_hash, is_connected) VALUES ($1, $2, 'sess_4', TRUE)",
          [roomId, u4.rows[0].id]
        )
      ).rejects.toThrow('ROOM_CAPACITY_EXCEEDED');

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
```

- [ ] **Step 3: Implement pool.ts and migration runner**
- [ ] **Step 4: Run test and verify it passes**
- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add database schema and concurrency-safe capacity trigger"
```

---

### Task 3: Guest Session & Cryptographic Token Utilities

**Files:**
- Create: `apps/server/src/utils/crypto.ts`
- Create: `apps/server/tests/utils/crypto.test.ts`

**Interfaces:**
- Produces: `generateRandomToken()`, `hashToken(token: string): string`, `createGuestSession()`.

- [ ] **Step 1: Write failing test for crypto utilities**

```typescript
// apps/server/tests/utils/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { generateRandomToken, hashToken } from '../../src/utils/crypto';

describe('Crypto Utilities', () => {
  it('generates a 64-character hex token with sufficient entropy', () => {
    const token = generateRandomToken();
    expect(token).toHaveLength(64);
    expect(typeof token).toBe('string');
  });

  it('hashes token deterministically using SHA-256', () => {
    const token = 'test-token-12345';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });
});
```

- [ ] **Step 2: Implement crypto utilities**

```typescript
// apps/server/src/utils/crypto.ts
import crypto from 'crypto';

export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 3: Run test and verify it passes**
- [ ] **Step 4: Commit**

```bash
git add apps/server/src/utils apps/server/tests/utils
git commit -m "feat(server): add cryptographic token generation and SHA-256 hashing"
```

---

### Task 4: Room Creation & Invitation Verification API

**Files:**
- Create: `apps/server/src/services/room.service.ts`
- Create: `apps/server/src/controllers/room.controller.ts`
- Create: `apps/server/src/routes/room.routes.ts`
- Create: `apps/server/tests/routes/room.test.ts`

**Interfaces:**
- Consumes: PostgreSQL pool, crypto utilities.
- Produces: REST endpoints:
  - `POST /api/rooms` (Creates guest user, creates room, adds host participant, sets cookie, returns cleartext invite link).
  - `GET /api/rooms/invite/:token` (Validates invite token hash, checks room status and participant count).
  - `POST /api/rooms/join` (Adds guest viewer, enforces 3-person limit atomically).

- [ ] **Step 1: Write failing test for room creation and joining**

```typescript
// apps/server/tests/routes/room.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Room API', () => {
  it('creates a room and returns slug and raw invite token', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ displayName: 'Alex Host', title: 'Friday Movie Night' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('slug');
    expect(res.body).toHaveProperty('inviteToken');
    expect(res.headers['set-cookie']).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement room.service.ts with explicit transaction**
- [ ] **Step 3: Implement room.controller.ts and room.routes.ts**
- [ ] **Step 4: Run test and verify it passes**
- [ ] **Step 5: Commit**

```bash
git add apps/server/src apps/server/tests
git commit -m "feat(server): add room creation, invite resolution, and atomic join endpoints"
```

---

### Task 5: Next.js Frontend Shell & Room Landing Page

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.js`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/join/[token]/page.tsx`
- Create: `apps/web/app/room/[slug]/page.tsx`

**Interfaces:**
- Consumes: Shared types from `@watchparty/shared`, Server REST APIs.
- Produces: Responsive UI with instant "Create Room", invite link copy, and participant capacity warning overlay.

- [ ] **Step 1: Initialize Next.js app with Tailwind CSS**
- [ ] **Step 2: Create Landing Page with "Create Room" modal and display name input**
- [ ] **Step 3: Create Join Page verifying invite token and prompting viewer display name**
- [ ] **Step 4: Create Cinema Room shell layout with 3-seat participant bar and player placeholder**
- [ ] **Step 5: Verify build (`npm --workspace=@watchparty/web run build`) and commit**

```bash
git add apps/web
git commit -m "feat(web): add responsive landing page, join flow, and room cinema shell"
```

---

## Plan Review & Handoff Checklist

1. **Spec Coverage:** Covers Stage 1 deliverables completely (monorepo, PostgreSQL schema, capacity trigger, guest auth, room API, Next.js UI).
2. **Zero Placeholders:** All SQL migrations, interfaces, and test scenarios are fully written out.
3. **Type Consistency:** Domain interfaces in `@watchparty/shared` match database schema exactly.
