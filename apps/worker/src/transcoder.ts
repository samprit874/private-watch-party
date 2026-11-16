import fs from 'fs/promises';
import path from 'path';

export interface TranscodeProfileOptions {
  inputPath: string;
  outputDir: string;
  hasAudio: boolean;
  durationSeconds: number;
  isPortrait: boolean;
}

export class Transcoder {
  /**
   * Pre-creates variant output subdirectories before FFmpeg runs.
   * Prevents runtime file open errors.
   */
  static async prepareOutputDirectories(outputDir: string): Promise<string[]> {
    const renditions = ['rendition_0', 'rendition_1', 'rendition_2'];
    for (const r of renditions) {
      await fs.mkdir(path.join(outputDir, r), { recursive: true });
    }
    return renditions;
  }

  /**
   * Builds production-ready FFmpeg command line arguments matching v2.2 specification.
   */
  static buildCommandArgs(options: TranscodeProfileOptions): string[] {
    const { inputPath, outputDir, hasAudio, durationSeconds, isPortrait } = options;

    const scale1080 = isPortrait
      ? 'scale=w=1080:h=1920:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v1080]'
      : 'scale=w=1920:h=1080:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v1080]';

    const scale720 = isPortrait
      ? 'scale=w=720:h=1280:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v720]'
      : 'scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v720]';

    const scale480 = isPortrait
      ? 'scale=w=480:h=854:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v480]'
      : 'scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v480]';

    const filterComplex = `[0:v]fps=30,split=3[v1080_in][v720_in][v480_in]; [v1080_in]${scale1080}; [v720_in]${scale720}; [v480_in]${scale480}`;

    const args: string[] = ['-y', '-i', inputPath];

    // Synthetic audio source if missing
    if (!hasAudio) {
      args.push(
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-t', durationSeconds.toFixed(2)
      );
    }

    args.push(
      '-filter_complex', filterComplex,
      '-map', '[v1080]', '-c:v:0', 'libx264', '-preset', 'veryfast', '-b:v:0', '4000k', '-maxrate:v:0', '4200k', '-bufsize:v:0', '8000k', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
      '-map', '[v720]',  '-c:v:1', 'libx264', '-preset', 'veryfast', '-b:v:1', '2000k', '-maxrate:v:1', '2200k', '-bufsize:v:1', '4000k', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
      '-map', '[v480]',  '-c:v:2', 'libx264', '-preset', 'veryfast', '-b:v:2', '800k',  '-maxrate:v:2', '900k',  '-bufsize:v:2', '1600k', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
      '-map', hasAudio ? '0:a:0' : '1:a:0', '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', 'v:0,a:0 v:1,a:0 v:2,a:0',
      '-hls_segment_filename', path.join(outputDir, 'rendition_%v', 'seg_%04d.ts'),
      path.join(outputDir, 'rendition_%v', 'playlist.m3u8')
    );

    return args;
  }

  /**
   * Verifies output playlist headers and file integrity before marking job completed.
   */
  static async validateHlsOutput(outputDir: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const masterPath = path.join(outputDir, 'master.m3u8');
      const masterContent = await fs.readFile(masterPath, 'utf-8');

      if (!masterContent.startsWith('#EXTM3U')) {
        return { isValid: false, error: 'MASTER_PLAYLIST_MISSING_EXTM3U_HEADER' };
      }

      // Check stream inf variants
      const streamInfCount = (masterContent.match(/#EXT-X-STREAM-INF/g) || []).length;
      if (streamInfCount !== 3) {
        return { isValid: false, error: `EXPECTED_3_RENDITIONS_GOT_${streamInfCount}` };
      }

      // Check each sub-playlist
      for (let i = 0; i < 3; i++) {
        const subPlPath = path.join(outputDir, `rendition_${i}`, 'playlist.m3u8');
        const subContent = await fs.readFile(subPlPath, 'utf-8');
        if (!subContent.includes('#EXT-X-ENDLIST')) {
          return { isValid: false, error: `RENDITION_${i}_MISSING_ENDLIST` };
        }
      }

      return { isValid: true };
    } catch (err: any) {
      return { isValid: false, error: err.message || 'VALIDATION_FAILED' };
    }
  }
}
