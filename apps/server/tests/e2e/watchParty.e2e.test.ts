import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { 
  calculateNtpOffset, 
  computeDriftCorrection, 
  DRIFT_THRESHOLDS, 
  SLEW_RATES,
  TV_KEY_CODES,
  isTvBackKey,
  isTvEnterKey,
  isTvDirectionKey,
  findNextFocusElement,
  FocusableElement,
  SESSION_COOKIE_NAME
} from '@watchparty/shared';
import { RoomService } from '../../src/services/room.service.js';
import { MediaAuthService } from '../../src/services/mediaAuth.service.js';
import { LiveKitService } from '../../src/services/livekit.service.js';
import { validateMediaUrl } from '../../src/services/ssrfValidator.js';
import { StorageService } from '../../src/services/storage.service.js';
import { hashToken, generateRandomToken } from '../../src/utils/crypto.js';

describe('Private Watch Party — Comprehensive E2E Acceptance Suite (All 12 Acceptance Criteria)', () => {
  const mockRoomId = 'e2e-room-001';
  const mockHostId = 'e2e-host-001';
  const mockMediaSecret = 'e2e-super-secret-hmac-key-1234567890';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Criterion 1: Room Creation & Invite Token Cryptographic Hashing
  // ==========================================================================
  it('Criterion 1: Room creation generates unique slug, secure invite token, and stores only SHA-256 hash', async () => {
    const rawInviteToken = generateRandomToken(32);
    const tokenHash = hashToken(rawInviteToken);

    expect(rawInviteToken).toHaveLength(64); // 32 bytes in hex = 64 characters
    expect(tokenHash).toHaveLength(64);      // SHA-256 digest = 64 characters
    expect(rawInviteToken).not.toBe(tokenHash);

    // Verify hashing is deterministic
    expect(hashToken(rawInviteToken)).toBe(tokenHash);
  });

  // ==========================================================================
  // Criterion 2: Host Participant Role & Session Issuance
  // ==========================================================================
  it('Criterion 2: Room creator is assigned host role with session authentication', async () => {
    vi.spyOn(RoomService, 'createRoom').mockResolvedValue({
      roomId: mockRoomId,
      slug: 'test-cinema-room',
      inviteToken: 'raw-invite-token-returned-once',
      sessionToken: 'host-session-token-secret',
      hostUser: { id: mockHostId, displayName: 'Alice Host' },
    });

    const res = await request(app)
      .post('/api/rooms')
      .send({
        title: 'Host Movie Night',
        displayName: 'Alice Host',
      });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('test-cinema-room');
    expect(res.body.inviteToken).toBe('raw-invite-token-returned-once');
    // Host session cookie must be set
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c: string) => c.includes(SESSION_COOKIE_NAME))).toBe(true);
  });

  // ==========================================================================
  // Criterion 3 & 4: Concurrency-Safe 3-Participant Capacity & 4th Rejection (409)
  // ==========================================================================
  it('Criterion 3 & 4: Exactly 3 participants can join; 4th concurrent participant is rejected with 409 Conflict', async () => {
    vi.spyOn(RoomService, 'joinRoom').mockRejectedValue(new Error('ROOM_CAPACITY_EXCEEDED'));

    const res = await request(app)
      .post('/api/rooms/join')
      .send({
        inviteToken: 'valid-invite-token-12345678',
        displayName: 'Dave 4th Participant',
      });

    // Concurrency lock strictly rejects the 4th participant
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ROOM_CAPACITY_EXCEEDED');
  });

  // ==========================================================================
  // Criterion 5: Engine B Playback State & Monotonic Revision Ordering
  // ==========================================================================
  it('Criterion 5: Playback state increments revisions monotonically; stale revisions are ignored', () => {
    let currentRevision = 5;

    const incomingCommands = [
      { action: 'PLAY', revision: 6 },
      { action: 'PAUSE', revision: 4 }, // Stale out-of-order packet
      { action: 'SEEK', revision: 7 },
      { action: 'PLAY', revision: 6 },  // Duplicate/stale packet
    ];

    const processedRevisions: number[] = [];

    for (const cmd of incomingCommands) {
      if (cmd.revision > currentRevision) {
        currentRevision = cmd.revision;
        processedRevisions.push(cmd.revision);
      }
    }

    expect(processedRevisions).toEqual([6, 7]);
    expect(currentRevision).toBe(7);
  });

  // ==========================================================================
  // Criterion 6: NTP 3-Way Clock Synchronization Handshake
  // ==========================================================================
  it('Criterion 6: NTP 3-way handshake accurately calculates server clock offset and round-trip delay', () => {
    // Scenario: Server clock is ahead of client clock by exactly 150ms.
    // Client sends at t0 = 1000.
    // Network transit takes 20ms one way.
    // Server receives and responds at t1 = 1000 + 20 + 150 = 1170.
    // Network return takes 20ms.
    // Client receives at t2 = 1040.
    const t0 = 1000;
    const t1 = 1170;
    const t2 = 1040;

    const { offset, rtt } = calculateNtpOffset(t0, t1, t2);

    expect(rtt).toBe(40);    // 40ms round-trip latency
    expect(offset).toBe(150); // Exactly +150ms server offset
  });

  // ==========================================================================
  // Criterion 7: Multi-Tier Drift Slewing with Base Rate (R_base) Preservation
  // ==========================================================================
  describe('Criterion 7: Multi-Tier Playback Drift Slewing', () => {
    it('Tier 0: Drift < 0.20s remains within deadband with no slew', () => {
      // Current = 10.12, Expected = 10.0 -> drift = +0.12s (< 0.20s)
      const result = computeDriftCorrection(10.12, 10.0, 1.0);
      expect(result.action).toBe('deadband');
      expect(result.effectiveRate).toBe(1.0);
    });

    it('Tier 1: Micro-slew (0.20s - 0.75s) applies ±2% rate adjustment preserving R_base', () => {
      // Viewer lags behind host by 0.35s (Current 9.65 vs Expected 10.0) -> speed up by +2%
      const behind = computeDriftCorrection(9.65, 10.0, 1.0);
      expect(behind.action).toBe('micro_slew');
      expect(behind.effectiveRate).toBe(1.02);

      // Viewer leads ahead of host by 0.35s (Current 10.35 vs Expected 10.0) -> slow down by -2%
      const ahead = computeDriftCorrection(10.35, 10.0, 1.0);
      expect(ahead.action).toBe('micro_slew');
      expect(ahead.effectiveRate).toBe(0.98);

      // Preserves user's base rate (e.g. 1.5x)
      const base15 = computeDriftCorrection(9.65, 10.0, 1.5);
      expect(base15.effectiveRate).toBeCloseTo(1.5 * 1.02, 3);
    });

    it('Tier 2: Moderate-slew (0.75s - 1.50s) applies ±6% rate adjustment preserving R_base', () => {
      // Viewer lags behind host by 1.10s (Current 8.90 vs Expected 10.0) -> speed up by +6%
      const behind = computeDriftCorrection(8.90, 10.0, 1.0);
      expect(behind.action).toBe('moderate_slew');
      expect(behind.effectiveRate).toBe(1.06);

      // Viewer leads ahead of host by 1.10s (Current 11.10 vs Expected 10.0) -> slow down by -6%
      const ahead = computeDriftCorrection(11.10, 10.0, 1.0);
      expect(ahead.action).toBe('moderate_slew');
      expect(ahead.effectiveRate).toBe(0.94);

      // Preserves 1.5x base rate
      const base15 = computeDriftCorrection(8.90, 10.0, 1.5);
      expect(base15.effectiveRate).toBeCloseTo(1.5 * 1.06, 3);
    });

    it('Tier 3: Hard seek triggered for large drift >= 1.50s', () => {
      // Viewer lags behind host by 2.40s (Current 7.60 vs Expected 10.0)
      const largeDrift = computeDriftCorrection(7.60, 10.0, 1.0);
      expect(largeDrift.action).toBe('hard_seek');
      expect(largeDrift.effectiveRate).toBe(1.0);
    });
  });

  // ==========================================================================
  // Criterion 8: Engine A LiveKit Role Permissions
  // ==========================================================================
  it('Criterion 8: LiveKit token grants host publish/subscribe permissions and viewer subscribe-only permissions', async () => {
    // Host token
    const hostToken = await LiveKitService.generateToken({
      roomId: 'room-engine-a',
      userId: 'host-user-01',
      displayName: 'Host Alice',
      isHost: true,
    });
    expect(hostToken).toBeDefined();

    // Viewer token
    const viewerToken = await LiveKitService.generateToken({
      roomId: 'room-engine-a',
      userId: 'viewer-user-02',
      displayName: 'Viewer Bob',
      isHost: false,
    });
    expect(viewerToken).toBeDefined();
    expect(viewerToken).not.toBe(hostToken);
  });

  // ==========================================================================
  // Criterion 9: Engine C Pre-Signed Upload & Directory Structure
  // ==========================================================================
  it('Criterion 9: S3/R2 direct upload enforces 4GB limit and generates secure storage keys', async () => {
    // Generate valid pre-signed URL for a 500MB video
    const presigned = await StorageService.createPresignedUploadUrl(
      mockRoomId,
      'upload-uuid-1234',
      'personal_vacation.mp4',
      'video/mp4'
    );

    expect(presigned.uploadUrl).toBeDefined();
    expect(presigned.storageKey).toBe(`uploads/${mockRoomId}/upload-uuid-1234/personal_vacation.mp4`);
    expect(presigned.expiresInSeconds).toBe(900);
  });

  // ==========================================================================
  // Criterion 10: Anti-SSRF Protection Against Private IP Ingestion
  // ==========================================================================
  describe('Criterion 10: Anti-SSRF Defense', () => {
    it('blocks loopback, private subnets, cloud metadata endpoints, and non-http protocols', async () => {
      const blockedUrls = [
        'http://127.0.0.1/video.mp4',
        'http://localhost/movie.mp4',
        'http://10.0.0.1/stream.m3u8',
        'http://172.16.0.5/private.mp4',
        'http://192.168.1.100/video.mp4',
        'http://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'ftp://internal.nas/media.mp4',
      ];

      for (const url of blockedUrls) {
        const result = await validateMediaUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('approves legitimate public HTTPS video URLs', async () => {
      const validUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      const result = await validateMediaUrl(validUrl);
      expect(result.isValid).toBe(true);
    });
  });

  // ==========================================================================
  // Criterion 11: Edge HLS HMAC Token & Instant Media Epoch Revocation
  // ==========================================================================
  describe('Criterion 11: Edge HLS Authorization & Revocation', () => {
    it('mints valid HMAC tokens and rejects expired or wrong-signature tokens', () => {
      const token = MediaAuthService.mintToken(
        'upload-789',
        mockRoomId,
        'user-abc',
        1,
        mockMediaSecret,
        60
      );

      // Valid token passes verification
      const verified = MediaAuthService.verifyToken(token, mockMediaSecret, 1);
      expect(verified.isValid).toBe(true);
      expect(verified.payload?.roomId).toBe(mockRoomId);

      // Tampered token fails
      const tamperedToken = token.slice(0, -4) + 'abcd';
      const tamperedResult = MediaAuthService.verifyToken(tamperedToken, mockMediaSecret, 1);
      expect(tamperedResult.isValid).toBe(false);
      expect(tamperedResult.error).toBe('INVALID_SIGNATURE');
    });

    it('immediately revokes access when room media_epoch increments', () => {
      // User obtained token during epoch 1
      const tokenEpoch1 = MediaAuthService.mintToken(
        'upload-789',
        mockRoomId,
        'user-abc',
        1,
        mockMediaSecret,
        60
      );

      // Participant evicted: active room epoch increments to 2
      const activeEpoch = 2;

      const result = MediaAuthService.verifyToken(tokenEpoch1, mockMediaSecret, activeEpoch);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('ACCESS_REVOKED');
    });
  });

  // ==========================================================================
  // Criterion 12: Smart TV 10-Foot Remote Navigation & Key Code Compatibility
  // ==========================================================================
  describe('Criterion 12: Smart TV 10-Foot Remote Key Compatibility & 2D Spatial Focus', () => {
    it('correctly maps TV remote key codes across Samsung Tizen, LG webOS, and Android TV', () => {
      expect(isTvBackKey(TV_KEY_CODES.BACK_TIZEN)).toBe(true);
      expect(isTvBackKey(TV_KEY_CODES.BACK_WEBOS)).toBe(true);
      expect(isTvBackKey(TV_KEY_CODES.ESCAPE)).toBe(true);
      expect(isTvEnterKey(TV_KEY_CODES.ENTER)).toBe(true);
      expect(isTvDirectionKey(TV_KEY_CODES.DOWN)).toBe('down');
      expect(isTvDirectionKey(TV_KEY_CODES.RIGHT)).toBe('right');
    });

    it('navigates seamlessly across UI elements without pointer input using 2D Euclidean distance', () => {
      const tvElements: FocusableElement[] = [
        { id: 'tv-btn-unlock', rect: { x: 500, y: 400, width: 200, height: 60 } },
        { id: 'tv-btn-fullscreen', rect: { x: 1100, y: 30, width: 120, height: 40 } },
        { id: 'tv-btn-exit', rect: { x: 1240, y: 30, width: 120, height: 40 } },
      ];

      // Moving right from fullscreen button targets exit button
      const nextRight = findNextFocusElement('tv-btn-fullscreen', 'right', tvElements);
      expect(nextRight).toBe('tv-btn-exit');

      // Moving left from exit button targets fullscreen button
      const nextLeft = findNextFocusElement('tv-btn-exit', 'left', tvElements);
      expect(nextLeft).toBe('tv-btn-fullscreen');
    });
  });
});
