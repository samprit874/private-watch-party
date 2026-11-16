import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Transcoder } from '../src/transcoder.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FFmpeg Transcoder Pipeline Builder', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hls-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('pre-creates variant subdirectories rendition_0, rendition_1, rendition_2', async () => {
    const renditions = await Transcoder.prepareOutputDirectories(tmpDir);
    expect(renditions).toHaveLength(3);

    for (const r of renditions) {
      const stats = await fs.stat(path.join(tmpDir, r));
      expect(stats.isDirectory()).toBe(true);
    }
  });

  it('builds command arguments for video WITH audio', () => {
    const args = Transcoder.buildCommandArgs({
      inputPath: 'sample.mp4',
      outputDir: tmpDir,
      hasAudio: true,
      durationSeconds: 120,
      isPortrait: false,
    });

    // Audio mapping should map 0:a:0 directly
    expect(args).toContain('-map');
    expect(args).toContain('0:a:0');
    expect(args).not.toContain('anullsrc');
    expect(args).toContain('-var_stream_map');
    expect(args).toContain('v:0,a:0 v:1,a:0 v:2,a:0');
  });

  it('builds command arguments for video WITHOUT audio (synthetic audio injection with explicit duration)', () => {
    const args = Transcoder.buildCommandArgs({
      inputPath: 'silent.mp4',
      outputDir: tmpDir,
      hasAudio: false,
      durationSeconds: 75.5,
      isPortrait: false,
    });

    expect(args).toContain('anullsrc=channel_layout=stereo:sample_rate=44100');
    expect(args).toContain('-t');
    expect(args).toContain('75.50');
    expect(args).toContain('1:a:0'); // Mapped from synthetic source
  });

  it('validates generated master and variant playlists', async () => {
    await Transcoder.prepareOutputDirectories(tmpDir);

    // Mock master.m3u8
    const masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080
rendition_0/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
rendition_1/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480
rendition_2/playlist.m3u8
`;
    await fs.writeFile(path.join(tmpDir, 'master.m3u8'), masterContent);

    // Mock variant playlists
    for (let i = 0; i < 3; i++) {
      const variantContent = `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXTINF:4.000,
seg_0000.ts
#EXT-X-ENDLIST
`;
      await fs.writeFile(path.join(tmpDir, `rendition_${i}`, 'playlist.m3u8'), variantContent);
    }

    const validation = await Transcoder.validateHlsOutput(tmpDir);
    expect(validation.isValid).toBe(true);
  });

  it('detects invalid or missing sub-playlists', async () => {
    await Transcoder.prepareOutputDirectories(tmpDir);
    // Write corrupted master without #EXTM3U
    await fs.writeFile(path.join(tmpDir, 'master.m3u8'), 'invalid header');

    const validation = await Transcoder.validateHlsOutput(tmpDir);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toBe('MASTER_PLAYLIST_MISSING_EXTM3U_HEADER');
  });
});
