import stream from 'stream';
import debug from 'debug';
import execa from 'execa';
import { exec } from '../../util/exec';
import { Artifact } from '../model';
import { Compression } from './compression';
import { desync } from './desync';
import { gzip } from './gzip';
import { lz4 } from './lz4';
import { tar } from './tar';

const log = debug('monofo:artifact:compression');

export * from './compression';

export const compressors: Record<string, Compression> = {
  caidx: desync,
  'tar.gz': gzip,
  'tar.lz4': lz4,
  tar,
};

export function deflator(output: Artifact): Promise<string[]> {
  const compressor = compressors?.[output.ext];

  if (!compressor) {
    throw new Error(`Unsupported output artifact format: ${output.ext}`);
  }

  return compressor.deflate(output);
}

export async function inflator(input: stream.Readable, artifact: Artifact, outputPath = '.'): Promise<void> {
  if (artifact.skip) {
    log(`Skipping download and inflate for ${artifact.name} because skip is enabled`);
  } else {
    const compressor = compressors?.[artifact.ext];

    if (!compressor) {
      log(`Using no compression: inflating ${artifact.name} "as-is"`);
      await exec('cat', ['>', artifact.filename], { input });
      return;
    }

    await compressor.inflate({ input, artifact, outputPath });
  }
}
