# Changelog

All notable changes to this project will be documented in this file.

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
- Updated Docker configurations to use Node.js 20 LTS and MongoDB 7.0
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
