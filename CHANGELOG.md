# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- `createdAt` is now persisted from the value stamped by the middleware at create time, preserved across `update()`, and returned by `findByIdempotencyKey()`. This restores the `express-idempotency` v2.x processing-timeout lease / takeover mechanism, which the adapter previously defeated by regenerating the timestamp on every write — orphaned "in progress" documents stayed blocked with `409` until the long TTL expired ([#16](https://github.com/VilledeMontreal/express-idempotency-mongo-adapter/issues/16)).

### Changed
- `update()` no longer resets `createdAt` (switched from `replaceOne` to `updateOne`/`$set`). The TTL countdown now starts from the resource creation time (request start) instead of the response-persistence time. Behavioural change only — not breaking for the public API.
- Enabled `skipLibCheck` in `tsconfig.json` so the build tolerates unpinned `@types/*` (notably `@types/node`) resolving to versions newer than the project's TypeScript ([#17](https://github.com/VilledeMontreal/express-idempotency-mongo-adapter/issues/17)).
- Moved CI (build, lint, test) to GitHub Actions, using a MongoDB service container instead of downloading a `mongodb-memory-server` binary. The test suite connects to `MONGO_URI` when set (CI) and falls back to `mongodb-memory-server` locally ([#17](https://github.com/VilledeMontreal/express-idempotency-mongo-adapter/issues/17)).
- npm publishing also moved to GitHub Actions (`.github/workflows/release.yml`, on version tags) using **OIDC trusted publishing** — no long-lived `NPM_TOKEN`. **CircleCI has been removed.** Pre-release tags (`vX.Y.Z-<suffix>`) publish under the `rc` dist-tag; releases publish a SLSA provenance attestation and create a GitHub Release from the CHANGELOG.

## [1.0.5] - 2025-05-14

Copy of 1.0.4 

## [1.0.4] - 2025-04-07

### Upgraded
- Updated MongoDB driver from v4.x to v6.3.0
- Upgraded TypeScript from v3.x to v5.5.2
- Updated all testing libraries to latest versions
- Replaced deprecated `faker` with `@faker-js/faker` v8.4.1
- Modernized Husky configuration from legacy format to v9 directory-based structure

### Fixed
- Updated MongoDB connection handling for v6 compatibility
- Fixed ESLint configuration for compatibility with eslint-config-prettier v9
- Enhanced error handling throughout the adapter with improved error messages
- Added proper null checking for database connections
- Fixed Git hooks execution issues with updated Husky configuration

### Improved
- Added more robust testing with proper object creation in test helpers
- Updated Docker configurations to use Node.js 22 LTS and MongoDB 7.0
- Enhanced TypeScript types and interfaces

## [1.0.3]

-   Use express-idempotency 1.0.5 typescript definition
-   Update examples to use node 16

## [1.0.2]

-   Fix issue with autobind-decorator which must be a runtime dependency ([issue #7](https://github.com/VilledeMontreal/express-idempotency-mongo-adapter/issues/7))

## [1.0.1]

Bugs fixes

## [1.0.0]

This is the first version of the mongo adapter for the idempotency middleware for express.

-   Support MongoDB as data adapter for express idempotency middleware
-   Time-To-Live (TTL) to ensure removal of records after a specific time
