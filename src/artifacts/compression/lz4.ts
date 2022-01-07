import stream from 'stream';
import debug from 'debug';
import execa, { ExecaReturnValue } from 'execa';
import { hasBin } from '../../util/exec';
import { tar } from '../../util/tar';
import { Compression } from './compression';

const log = debug('monofo:artifact:compression:lz4');

let enabled: boolean | undefined;

export const lz4: Compression = {
  extension: 'tar.lz4',

  deflateCmd(): string[] {
    return ['lz4', '-2'];
  },

  async checkEnabled() {
    if (enabled === undefined) {
      enabled = await hasBin('lz4');
    }

    if (!enabled) {
      throw new Error('LZ4 compression is disabled due to no lz4 binary found on PATH');
    }
  },

  async inflate(input: stream.Readable, outputPath = '.'): Promise<ExecaReturnValue> {
    log(`Inflating .tar.lz4 archive: tar -C ${outputPath} -x --use-compress-program=lz4 -f -`);

    const result = await execa(await tar(), ['-C', outputPath, '-x', '--use-compress-program=lz4', '-f', '-'], {
      input,
      stderr: 'inherit',
    });

    log('Finished inflating .tar.lz4 archive');

    return result;
  },
};
