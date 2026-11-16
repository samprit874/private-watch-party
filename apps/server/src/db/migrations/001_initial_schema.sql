-- PostgreSQL 13+ Schema for Private Watch Party (Native gen_random_uuid, zero external extensions required)

-- 1. Users
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

-- 2. Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(32) NOT NULL UNIQUE,
    invite_token_hash VARCHAR(64) NOT NULL UNIQUE,
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(128) NOT NULL DEFAULT 'Private Watch Party',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    max_participants SMALLINT NOT NULL DEFAULT 3 CHECK (max_participants <= 3),
    current_media_id UUID,
    media_secret VARCHAR(64) NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
    media_epoch INTEGER NOT NULL DEFAULT 1,
    is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);
CREATE INDEX IF NOT EXISTS idx_rooms_invite_hash ON rooms(invite_token_hash);

-- 3. Room Participants
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

CREATE INDEX IF NOT EXISTS idx_participants_room_connected ON participants(room_id, is_connected);

-- 4. Media Sources
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

CREATE INDEX IF NOT EXISTS idx_media_room ON media(room_id);

-- Foreign Key: rooms.current_media_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_rooms_current_media'
    ) THEN
        ALTER TABLE rooms ADD CONSTRAINT fk_rooms_current_media 
            FOREIGN KEY (current_media_id) REFERENCES media(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Uploads
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

CREATE INDEX IF NOT EXISTS idx_uploads_pending ON uploads(status, created_at) WHERE status = 'pending';

-- 6. Playback Sessions
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

-- 7. Room Messages
CREATE TABLE IF NOT EXISTS room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content VARCHAR(1000) NOT NULL,
    type VARCHAR(16) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'system', 'reaction')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created ON room_messages(room_id, created_at DESC);

-- 8. Room Permissions
CREATE TABLE IF NOT EXISTS room_permissions (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_control_playback BOOLEAN NOT NULL DEFAULT FALSE,
    can_change_media BOOLEAN NOT NULL DEFAULT FALSE,
    can_screen_share BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (room_id, user_id)
);

-- ============================================================================
-- Triggers for Media Isolation and Concurrency-Safe Room Capacity
-- ============================================================================

-- A. Media-Room Match
CREATE OR REPLACE FUNCTION check_rooms_media_match()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_media_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM media WHERE id = NEW.current_media_id AND room_id = NEW.id
        ) THEN
            RAISE EXCEPTION 'CROSS_ROOM_MEDIA_MISMATCH: Media % does not belong to Room %', 
                NEW.current_media_id, NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rooms_media_match ON rooms;
CREATE TRIGGER trg_rooms_media_match
BEFORE INSERT OR UPDATE OF current_media_id ON rooms
FOR EACH ROW EXECUTE FUNCTION check_rooms_media_match();

-- B. Upload-Media Match
CREATE OR REPLACE FUNCTION check_uploads_media_match()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.media_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM media WHERE id = NEW.media_id AND room_id = NEW.room_id
        ) THEN
            RAISE EXCEPTION 'CROSS_ROOM_UPLOAD_MISMATCH: Media % does not belong to Room %', 
                NEW.media_id, NEW.room_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_uploads_media_match ON uploads;
CREATE TRIGGER trg_uploads_media_match
BEFORE INSERT OR UPDATE OF media_id ON uploads
FOR EACH ROW EXECUTE FUNCTION check_uploads_media_match();

-- C. Concurrency-Safe Room Capacity Trigger
CREATE OR REPLACE FUNCTION enforce_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
    room_max SMALLINT;
BEGIN
    IF NEW.is_connected = TRUE THEN
        -- Atomically lock the parent room row to serialize concurrent joins
        SELECT max_participants INTO room_max 
        FROM rooms 
        WHERE id = NEW.room_id 
        FOR UPDATE;
        
        -- Count currently connected participants excluding rejoining user
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
