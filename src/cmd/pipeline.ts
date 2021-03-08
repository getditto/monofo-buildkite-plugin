import debug from 'debug';
import { dump as dumpYaml } from 'js-yaml';
import { CommandModule } from 'yargs';
import { getBuildkiteInfo } from '../buildkite/config';
import Config from '../config';
import { getBaseBuild, matchConfigs } from '../diff';
import { diff } from '../git';
import mergePipelines from '../merge';

const log = debug('monofo:cmd:pipeline');

const cmd: CommandModule = {
  command: 'pipeline',
  describe: 'Output a merged pipeline.yml',
  aliases: '$0',
  builder: {},

  handler(): Promise<string> {
    return Config.getAll(process.cwd())
      .then((c) =>
        c.length > 0 ? c : Promise.reject(new Error(`No pipeline files to process (cwd: ${process.cwd()})`))
      )
      .then((configs) => {
        return getBaseBuild(getBuildkiteInfo(process.env))
          .then((baseBuild) =>
            diff(baseBuild.commit).then((changedFiles) => matchConfigs(baseBuild.id, configs, changedFiles))
          )
          .catch((e) => {
            log('Failed to find base commit or diff changes, falling back to do a full build');
            return Promise.resolve(Config.configureFallback(e, configs));
          })
          .then(() => mergePipelines(configs));
      })
      .then(dumpYaml)
      .then((v) => {
        process.stdout.write(`${v}\n`);
        return v;
      });
  },
};

export = cmd;
