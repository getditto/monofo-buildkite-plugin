# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monofo is a Buildkite dynamic pipeline generator for monorepos written in TypeScript. It allows splitting `.buildkite/pipeline.yml` files into multiple components that only run when needed based on file changes, enabling efficient CI/CD for large monorepos. The project consists of both a Node.js CLI tool and a Buildkite plugin.

## Core Architecture

### TypeScript CLI Application
- **Framework**: Built using oclif (Salesforce's CLI framework)
- **Main entry**: `src/index.ts` exports oclif's `run` function
- **Base command**: `src/command.ts` provides `BaseCommand` class with common flags and initialization
- **Commands**: Individual CLI commands in `src/commands/` directory (pipeline, upload, download, etc.)

### Buildkite Plugin Integration
- **Plugin definition**: `plugin.yml` defines the Buildkite plugin schema
- **Bash hooks**: `hooks/` directory contains pre-command and post-command hooks
- **Hook delegation**: Hooks parse plugin configuration and delegate to appropriate lib scripts

### Key Components

#### Pipeline Generation (`src/commands/pipeline.ts`)
- Core functionality for generating dynamic pipelines based on file changes
- Compares against base commits to determine which components need to run
- Supports artifact dependency management via `expects`/`produces` configuration

#### Artifact Management
- **Compression**: Support for gzip, lz4, tar, and desync (content-addressed storage)
- **Upload/Download**: Handles artifact upload to Buildkite and download for skipped components
- **Deflate/Inflate**: `src/commands/deflate.ts` and artifact decompression in downloads

#### Models (`src/models/`)
- **Pipeline**: Represents pipeline configuration and structure
- **Build**: Buildkite build information and metadata
- **Step**: Individual pipeline steps and group steps
- **Config**: Merged configuration from multiple sources

#### External Integrations
- **Buildkite API**: `src/buildkite/client.ts` for API communication
- **DynamoDB**: `src/dynamodb.ts` for pure build caching
- **Git**: `src/git.ts` for repository operations and diff analysis

## Development Commands

### Essential Commands
```bash
# Install dependencies
yarn install

# Build TypeScript to JavaScript
yarn build

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Lint code
yarn lint

# Fix linting issues automatically
yarn lint:fix

# Clean build artifacts
yarn clean
```

### Development Workflow
```bash
# Build and watch for changes during development
yarn build:watch

# Test specific components
yarn test -- --testNamePattern="pattern"

# Run with verbose output
yarn test -- --verbose

# Generate commit with conventional format
yarn commit
```

### CLI Testing
```bash
# Run monofo CLI locally
yarn monofo <command>

# Run with AWS credentials (for testing with real infrastructure)
yarn monofo:with-aws <command>
```

## Testing

### Test Framework
- **Jest** with TypeScript support via ts-jest
- **Coverage**: Collected from `src/**/*.ts`, reports in `output/coverage/`
- **Test files**: `*.test.ts` files in `test/` directory
- **Setup**: `test/setup.ts` runs before each test

### Test Categories
- **Unit tests**: Individual component testing in `test/`
- **Integration tests**: Commands, buildkite client, artifacts
- **Bash tests**: `.bats` files for testing shell scripts in `hooks/lib/`

### Mock Infrastructure
- **jest-dynalite**: Local DynamoDB for testing
- **nock**: HTTP mocking for Buildkite API calls
- **Fixtures**: Test data in `test/fixtures/` and `test/projects/`

## Plugin Configuration

### Plugin Schema (`plugin.yml`)
The plugin accepts three main configuration types:
- `generate: pipeline` - Generate dynamic pipeline
- `upload: { artifact-name: [files] }` - Upload artifacts with compression
- `download: artifact-name` - Download and inflate artifacts

### Hook Architecture
- **pre-command**: Handles pipeline generation and artifact downloads
- **post-command**: Handles artifact uploads
- **lib/*.bash**: Shared functionality between hooks

## Monorepo Configuration

### Component Pipeline Structure
Each component pipeline (`pipeline.<name>.yml`) can define:
```yaml
monorepo:
  expects: input-artifact.tar.gz    # Required artifacts
  produces: output-artifact.tar.gz  # Generated artifacts  
  matches:                          # File patterns to trigger builds
    - "src/**/*.ts"
    - "package.json"
  pure: true                        # Content-based caching
  branches: "main"                  # Branch filtering
```

### Environment Variables
- `BUILDKITE_API_ACCESS_TOKEN` - Required for API access (read_builds scope)
- `PIPELINE_RUN_ALL=1` - Force all components to run
- `PIPELINE_RUN_ONLY=component` - Run only specific component
- `PIPELINE_RUN_<COMPONENT>=1` - Force specific component to run
- `PIPELINE_NO_RUN_<COMPONENT>=1` - Skip specific component

## Build System Details

### TypeScript Configuration
- **Target**: Node.js 20+ (specified in package.json engines)
- **Extends**: `@tsconfig/node14` base configuration
- **Output**: `dist/` directory with source maps and declarations
- **Strict**: Enables strict type checking and unused parameter detection

### Package Management
- **Yarn**: Used for dependency management (yarn.lock present)
- **Scripts**: Defined in package.json, uses npm-run-all for parallel execution

### Semantic Release
- **Automated versioning**: Uses conventional commits and semantic-release
- **Branch strategy**: Supports main, next, beta, alpha branches
- **Auto-updates**: README and docs are automatically updated with version numbers

## External Dependencies

### Core Dependencies
- **oclif**: CLI framework and plugin system
- **AWS SDK**: DynamoDB integration for pure build caching
- **buildkite API**: Build querying and artifact management
- **compression**: bluebird, glob, lodash for utility functions

### Development Dependencies
- **ESLint**: Airbnb TypeScript configuration with Prettier
- **Jest**: Testing framework with TypeScript support
- **Commitizen**: Conventional commit formatting
- **Husky**: Git hooks for commit message validation