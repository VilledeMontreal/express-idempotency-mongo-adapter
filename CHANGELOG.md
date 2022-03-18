# Changelog

All notable changes to this library will be documented in this file.

## 1.0.4

-   Delegation function is called when a connection to MongoDB is required instead of retaining the database reference ([issue #11](https://github.com/VilledeMontreal/express-idempotency-mongo-adapter/issues/11))

## 1.0.3

-   Use express-idempotency 1.0.5 typescript definition
-   Update examples to use node 16

## 1.0.2

-   Fix issue with autobind-decorator which must be a runtime dependency ([issue #7](https://github.com/VilledeMontreal/express-idempotency-mongo-adapter/issues/7))

## 1.0.1

Bugs fixes

## 1.0.0

This is the first version of the mongo adapter for the idempotency middleware for express.

-   Support MongoDB as data adapter for express idempotency middleware
-   Time-To-Live (TTL) to ensure removal of records after a specific time
