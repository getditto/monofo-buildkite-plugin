import path from 'path';
import { createTables, startDb, stopDb } from 'jest-dynalite';
import { safeLoad } from 'js-yaml';
import { mocked } from 'ts-jest/utils';
import { Arguments } from 'yargs';
import { CacheMetadataRepository } from '../../src/cache-metadata';
import * as pipeline from '../../src/cmd/pipeline';
import { service } from '../../src/dynamodb';
import { mergeBase, diff, revList } from '../../src/git';
import { BUILD_ID, BUILD_ID_2, BUILD_ID_3, COMMIT, fakeProcess } from '../fixtures';
import execSync from './exec';

jest.mock('../../src/git');
jest.mock('../../src/buildkite/client');

const mockMergeBase = mergeBase as jest.Mock<Promise<string>>;
mockMergeBase.mockImplementation(() => Promise.resolve('foo'));

const mockDiff = diff as jest.Mock<Promise<string[]>>;
mockDiff.mockImplementation(() => Promise.resolve(['foo/README.md', 'baz/abc.ts', '.buildkite/pipeline.changed.yml']));

const mockRevList = mocked(revList, true);
mockRevList.mockImplementation(() => Promise.resolve([COMMIT]));

describe('monofo pipeline', () => {
  beforeAll(startDb);
  beforeAll(createTables);
  afterAll(stopDb);

  it('returns help output', async () => {
    const output = await execSync(pipeline, 'pipeline --help');
    expect(output).toContain('Output a merged pipeline.yml');
  });

  it('can be executed with no configuration', async () => {
    process.env = fakeProcess();
    process.chdir(__dirname);

    const args: Arguments<unknown> = { $0: '', _: [] };
    const out: Promise<string> = (pipeline.handler(args) as unknown) as Promise<string>;

    return expect(out).rejects.toThrowError('No pipeline files');
  });

  it('can be executed with configuration on the default branch', async () => {
    process.env = fakeProcess();
    process.chdir(path.resolve(__dirname, '../projects/kitchen-sink'));

    const args: Arguments<unknown> = { $0: '', _: [] };
    await ((pipeline.handler(args) as unknown) as Promise<string>)
      .then((o) => (safeLoad(o) as unknown) as Pipeline)
      .then((p) => {
        expect(p).toBeDefined();
        expect(p.steps.map((s) => s.command)).toStrictEqual([
          "echo 'inject for: excluded, bar, qux, some-long-name'",
          'echo "changed" > changed',
          'echo "dependedon" > dependedon',
          'echo "foo1" > foo1',
          "echo 'bar was replaced'",
          'echo "included" > included',
          'echo "baz1"',
          'echo "unreferenced" > unref',
        ]);
        const { plugins } = p.steps[0];
        expect(plugins ? plugins[0]['artifacts#v1.3.0'] : null).toStrictEqual({
          build: BUILD_ID,
          download: ['bar1', 'bar2', 'qux1'],
          upload: ['bar1', 'bar2', 'qux1'],
        });
        expect(Object.entries(p.env)).toHaveLength(4);
        expect(p.env.BAR_WAS_EXCLUDED).toBe('true');
      });
  });

  it('can be executed with simple configuration and skipped parts on the default branch', async () => {
    process.env = fakeProcess();
    process.chdir(path.resolve(__dirname, '../projects/skipped'));

    const args: Arguments<unknown> = { $0: '', _: [] };
    await ((pipeline.handler(args) as unknown) as Promise<string>)
      .then((o) => (safeLoad(o) as unknown) as Pipeline)
      .then((p) => {
        expect(p).toBeDefined();
        expect(p.steps.map((s) => s.command)).toStrictEqual([
          "echo 'inject for: foo, bar'",
          "echo 'bar was replaced'",
          "echo 'All build parts were skipped'",
        ]);
        const { plugins } = p.steps[0];
        expect(plugins ? plugins[0]['artifacts#v1.3.0'] : null).toStrictEqual({
          build: BUILD_ID,
          download: ['foo1', 'bar1', 'bar2'],
          upload: ['foo1', 'bar1', 'bar2'],
        });
      });
  });

  it('can be executed with a PIPELINE_RUN_ONLY environment variable', async () => {
    process.env = fakeProcess({
      PIPELINE_RUN_ONLY: 'bar',
      PIPELINE_RUN_SOME_LONG_NAME: '1',
      PIPELINE_NO_RUN_INCLUDED: '1',
    });
    process.chdir(path.resolve(__dirname, '../projects/kitchen-sink'));

    const args: Arguments<unknown> = { $0: '', _: [] };
    await ((pipeline.handler(args) as unknown) as Promise<string>)
      .then((o) => (safeLoad(o) as unknown) as Pipeline)
      .then((p) => {
        expect(p).toBeDefined();
        expect(p.steps.map((s) => s.command)).toStrictEqual([
          "echo 'inject for: changed, dependedon, excluded, foo, included, qux, baz, unreferenced'",
          'echo "bar1" | tee bar1',
          'echo "bar2" | tee bar2',
          'echo "some-long-name" > some-long-name',
        ]);
        const { plugins } = p.steps[0];
        expect(plugins ? plugins[0]['artifacts#v1.3.0'] : null).toStrictEqual({
          build: BUILD_ID,
          download: ['foo1', 'qux1', 'baz1'],
          upload: ['foo1', 'qux1', 'baz1'],
        });
      });
  });

  it('can be executed with crossdeps alone', async () => {
    process.env = fakeProcess();
    process.chdir(path.resolve(__dirname, '../projects/crossdeps'));

    const args: Arguments<unknown> = { $0: '', _: [] };
    await ((pipeline.handler(args) as unknown) as Promise<string>)
      .then((o) => (safeLoad(o) as unknown) as Pipeline)
      .then((p) => {
        expect(p).toBeDefined();
        expect(p.steps).toHaveLength(1); // No artifacts step, because only phony artifacts involved

        // This had a cross-dependency, but the thing it depended on was skipped
        // In addition, nothing that was skipped was producing required artifacts
        // So the artifact step was skipped. This step can now run immediately.
        expect(p.steps[0].depends_on).toHaveLength(0);
      });
  });

  it('can be executed with flexible structure', async () => {
    process.env = fakeProcess();
    process.chdir(path.resolve(__dirname, '../projects/flexible-structure'));

    const args: Arguments<unknown> = { $0: '', _: [] };
    await ((pipeline.handler(args) as unknown) as Promise<string>)
      .then((o) => (safeLoad(o) as unknown) as Pipeline)
      .then((p) => {
        expect(p).toBeDefined();
        expect(p.steps).toHaveLength(3);
        expect(p.steps.map((s) => s.key)).toStrictEqual(['foo1Key', 'foo2Key', 'foo3Key']);
      });
  });

  it('can be executed with pure components', async () => {
    process.env = fakeProcess();
    process.chdir(path.resolve(__dirname, '../projects/pure'));

    const args: Arguments<unknown> = { $0: '', _: [] };
    await ((pipeline.handler(args) as unknown) as Promise<string>)
      .then((o) => (safeLoad(o) as unknown) as Pipeline)
      .then((p) => {
        expect(p).toBeDefined();
        expect(p.steps).toHaveLength(4);
        expect(p.steps.map((s) => s.key)).toStrictEqual([
          'anon-step-cb64da0ef06c',
          'anon-step-bf2e8e001a41',
          'record-success-foo',
          'record-success-baz',
        ]);
      });
  });

  it('can be executed with pure components with cache hits', async () => {
    process.env = fakeProcess({ BUILDKITE_PIPELINE_SLUG: 'pure-hit' });
    process.chdir(path.resolve(__dirname, '../projects/pure'));

    const repo = new CacheMetadataRepository(service);

    await Promise.all([
      repo.put({
        buildId: BUILD_ID_2,
        component: `pure-hit/foo`,
        contentHash: '1904e993b2d8495eb313ec12533b80a6aac69cb6d2d0848ee97abcf52a37fa48',
      }),
      repo.put({
        buildId: BUILD_ID_3,
        component: `pure-hit/baz`,
        contentHash: '612ee26061ea6efacde5dedad2f7da2554e859f3780a7426f5728ac47c11a8c3',
      }),
    ]);

    const args: Arguments<unknown> = { $0: '', _: [] };
    await ((pipeline.handler(args) as unknown) as Promise<string>)
      .then((o) => (safeLoad(o) as unknown) as Pipeline)
      .then((p) => {
        expect(p).toBeDefined();
        expect(p.steps).toHaveLength(2);
        expect(p.steps.map((s) => s.key)).toStrictEqual(['monorepo-inject-artifacts', 'nothing-to-do']);
        expect(p.steps[0].plugins).toHaveLength(2);

        const { plugins } = p.steps[0];

        if (!plugins) {
          throw new Error('Expected plugins to be defined');
        }

        expect(plugins).toHaveLength(2);
        expect((plugins[0] as ArtifactPluginConfig)['artifacts#v1.3.0'].build).toBe(BUILD_ID_2);
        expect((plugins[0] as ArtifactPluginConfig)['artifacts#v1.3.0'].download).toContain('foo');
        expect((plugins[1] as ArtifactPluginConfig)['artifacts#v1.3.0'].build).toBe(BUILD_ID_3);
      });
  });
});
