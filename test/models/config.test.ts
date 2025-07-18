import ConfigFile from '../../src/config-file';
import Config from '../../src/models/config';

describe('Config', () => {
  describe('updateMatchingChanges', () => {
    let config: Config;

    beforeEach(() => {
      const mockFile = new ConfigFile('test', 'pipeline.test.yml');
      config = new (Config as any)(
        mockFile,
        {
          name: 'test',
          expects: [],
          produces: [],
          matches: ['/README.md', 'src/**/*.ts', '/package.json', '**/*.yml'],
          depends_on: [],
          excluded_steps: [],
          excluded_env: {},
          pure: false,
          branches: '',
        },
        [],
        {}
      );
    });

    it('should match root-relative paths with leading slash correctly', () => {
      const changedFiles = [
        'README.md',
        'foo/README.md',
        'package.json',
        'src/package.json',
        'src/config.ts',
        'test/config.test.ts',
        'pipeline.test.yml',
      ];

      config.updateMatchingChanges(changedFiles);

      expect(config.changes).toContain('README.md');
      expect(config.changes).not.toContain('foo/README.md');
      expect(config.changes).toContain('package.json');
      expect(config.changes).not.toContain('src/package.json');
      expect(config.changes).toContain('src/config.ts');
      expect(config.changes).not.toContain('test/config.test.ts'); // This should not match since the pattern is 'src/**/*.ts'
      expect(config.changes).toContain('pipeline.test.yml'); // auto-added file
    });

    it('should handle relative patterns normally', () => {
      config = new (Config as any)(
        new ConfigFile('test', 'pipeline.test.yml'),
        {
          name: 'test',
          expects: [],
          produces: [],
          matches: ['README.md', 'foo/**/*.md'],
          depends_on: [],
          excluded_steps: [],
          excluded_env: {},
          pure: false,
          branches: '',
        },
        [],
        {}
      );

      const changedFiles = ['README.md', 'foo/README.md', 'bar/README.md', 'foo/docs/guide.md'];

      config.updateMatchingChanges(changedFiles);

      // Relative patterns should work with matchBase
      expect(config.changes).toContain('README.md');
      expect(config.changes).toContain('foo/README.md');
      expect(config.changes).toContain('bar/README.md');
      expect(config.changes).toContain('foo/docs/guide.md');
    });

    it('should handle mixed root-relative and relative patterns', () => {
      config = new (Config as any)(
        new ConfigFile('test', 'pipeline.test.yml'),
        {
          name: 'test',
          expects: [],
          produces: [],
          matches: ['/package.json', 'src/**/*.ts', '/LICENSE', '*.yml'],
          depends_on: [],
          excluded_steps: [],
          excluded_env: {},
          pure: false,
          branches: '',
        },
        [],
        {}
      );

      const changedFiles = [
        'package.json',
        'foo/package.json',
        'LICENSE',
        'foo/LICENSE',
        'src/config.ts',
        'test/config.ts',
        'pipeline.test.yml',
      ];

      config.updateMatchingChanges(changedFiles);

      // Root-relative should match only at root
      expect(config.changes).toContain('package.json');
      expect(config.changes).not.toContain('foo/package.json');
      expect(config.changes).toContain('LICENSE');
      expect(config.changes).not.toContain('foo/LICENSE');

      // Relative patterns should match in their specified directory
      expect(config.changes).toContain('src/config.ts');
      expect(config.changes).not.toContain('test/config.ts');

      // Auto-added pipeline file should match if in changed files
      expect(config.changes).toContain('pipeline.test.yml');
    });

    it('should handle empty changed files array', () => {
      config.updateMatchingChanges([]);

      expect(config.changes).toEqual([]);
      expect(config.allChanges).toEqual([]);
    });

    it('should handle null/undefined changed files', () => {
      config.updateMatchingChanges(null as any);

      expect(config.changes).toEqual([]);
      expect(config.allChanges).toEqual([]);
    });
  });
});
