import * as MongoAdapter from './adapter';
import * as sinon from 'sinon';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { assert } from 'chai';
import { faker } from '@faker-js/faker';
import {
    IdempotencyResource,
    IdempotencyRequest,
    IdempotencyResponse,
} from 'express-idempotency';
import { Db, MongoClient } from 'mongodb';

// createdAt is part of the parent v2.x IdempotencyResource contract (lease /
// processing-timeout) but is not present in the installed type definitions. Mirror
// the adapter's local extension so the tests can set and assert on it.
type IdempotencyResourceWithCreatedAt = IdempotencyResource & {
    createdAt?: Date | number;
};

describe('IIdempotencyDataAdapter tests', () => {
    let mongod: MongoMemoryServer | null = null;
    let mongoUri: string = null;
    let dataAdapter: MongoAdapter.MongoAdapter = null;

    before(function (done) {
        // Allow enough time to download the in-memory mongod binary on a cold cache.
        this.timeout(60000);

        // In CI, MONGO_URI points to a real MongoDB (e.g. a GitHub Actions service
        // container), so no mongod binary has to be downloaded. Locally, fall back to
        // an in-memory server so contributors need no setup.
        const resolveUri: Promise<string> = process.env.MONGO_URI
            ? Promise.resolve(process.env.MONGO_URI)
            : MongoMemoryServer.create().then((value) => {
                  mongod = value;
                  return value.getUri();
              });

        resolveUri.then((uri) => {
            mongoUri = uri;
            dataAdapter = MongoAdapter.newAdapter({
                config: {
                    uri: mongoUri,
                },
            });

            // Be sure that the schema has been initialized
            setTimeout(done, 1000);
        });
    });

    // Clean up after use (stop the in-memory server only when we started one).
    after(async () => {
        await dataAdapter.stop();
        if (mongod) {
            await mongod.stop();
        }
    });

    afterEach(() => {
        sinon.restore();
    });

    it('finds correct idempotency key from multiple resource insertion', async () => {
        // Generate resources
        const idempotencyResources = createArrayOfIndempotencyResource(10);
        for (const singleIdempotencyResource of idempotencyResources) {
            await dataAdapter.create(singleIdempotencyResource);
        }

        // Select a single resource and try to find it
        const index = 0; // Just use the first one for simplicity
        const idempotencyResourceToFind = idempotencyResources[index];

        // Find the resource
        const idempotencyFound = (await dataAdapter.findByIdempotencyKey(
            idempotencyResourceToFind.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        assert.ok(idempotencyFound);
        assert.equal(
            idempotencyFound.idempotencyKey,
            idempotencyResourceToFind.idempotencyKey
        );
        assert.deepEqual(
            idempotencyFound.request,
            idempotencyResourceToFind.request
        );
        // createdAt is now exposed (stamped as a fallback at create time)
        assert.instanceOf(idempotencyFound.createdAt, Date);
    });

    it('prevents idempotency key duplication', async () => {
        const idempotencyResource = createFakeIdempotencyResource();
        await dataAdapter.create(idempotencyResource);

        const newIdempotencyResource = createFakeIdempotencyResource();
        newIdempotencyResource.idempotencyKey =
            idempotencyResource.idempotencyKey;

        try {
            await dataAdapter.create(newIdempotencyResource);
            assert.fail('Expected to throw duplication error.');
        } catch (err) {
            assert.ok(err);
        }
    });

    it('updates resource with response', async () => {
        // Generate resources
        const idempotencyResources = createArrayOfIndempotencyResource(5);
        for (const singleIdempotencyResource of idempotencyResources) {
            await dataAdapter.create(singleIdempotencyResource);
        }

        // Select a single resource and try to find it
        const index = 0; // Just use the first one for simplicity
        const idempotencyResourceToFind = idempotencyResources[index];

        // Find the resource
        const idempotencyFound = await dataAdapter.findByIdempotencyKey(
            idempotencyResourceToFind.idempotencyKey
        );
        assert.isUndefined(idempotencyFound.response);

        // Update it
        const idempotencyResponse = createFakeIdempotencyResponse();
        idempotencyFound.response = idempotencyResponse;
        await dataAdapter.update(idempotencyFound);

        // Found it again to see that the response is there
        const idempotencyFoundAgain = await dataAdapter.findByIdempotencyKey(
            idempotencyResourceToFind.idempotencyKey
        );
        assert.deepEqual(idempotencyFoundAgain.response, idempotencyResponse);
    });

    it('deletes resource', async () => {
        // Generate resources
        const idempotencyResources = createArrayOfIndempotencyResource(5);
        for (const singleIdempotencyResource of idempotencyResources) {
            await dataAdapter.create(singleIdempotencyResource);
        }

        // Select a single resource and try to find it
        const index = 0; // Just use the first one for simplicity
        const idempotencyResourceToFind = idempotencyResources[index];

        // Find the resource
        let idempotencyFound = await dataAdapter.findByIdempotencyKey(
            idempotencyResourceToFind.idempotencyKey
        );
        assert.ok(idempotencyFound);

        // Delete the resource
        await dataAdapter.delete(idempotencyResourceToFind.idempotencyKey);

        // Try to find the resource but should be missing
        idempotencyFound = await dataAdapter.findByIdempotencyKey(
            idempotencyResourceToFind.idempotencyKey
        );
        assert.isNull(idempotencyFound);
    });

    it('persists the createdAt provided at create time (not regenerated)', async () => {
        const providedDate = new Date('2020-01-01T00:00:00.000Z');
        const resource: IdempotencyResourceWithCreatedAt = {
            ...createFakeIdempotencyResource(),
            createdAt: providedDate,
        };
        await dataAdapter.create(resource);

        const found = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        assert.instanceOf(found.createdAt, Date);
        assert.equal(
            (found.createdAt as Date).getTime(),
            providedDate.getTime()
        );
    });

    it('accepts a numeric (epoch) createdAt and persists it as a Date', async () => {
        const epoch = new Date('2021-06-15T12:00:00.000Z').getTime();
        const resource: IdempotencyResourceWithCreatedAt = {
            ...createFakeIdempotencyResource(),
            createdAt: epoch,
        };
        await dataAdapter.create(resource);

        const found = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        assert.instanceOf(found.createdAt, Date);
        assert.equal((found.createdAt as Date).getTime(), epoch);
    });

    it('falls back to a generated createdAt when none is provided', async () => {
        const resource = createFakeIdempotencyResource(); // no createdAt
        const before = Date.now();
        await dataAdapter.create(resource);
        const after = Date.now();

        const found = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        assert.instanceOf(found.createdAt, Date);
        // Within the create window — no second-precision assumption.
        const ts = (found.createdAt as Date).getTime();
        assert.isAtLeast(ts, before);
        assert.isAtMost(ts, after);
    });

    it('falls back to a generated createdAt when the provided value is invalid', async () => {
        const resource: IdempotencyResourceWithCreatedAt = {
            ...createFakeIdempotencyResource(),
            createdAt: Number.NaN, // invalid — must not poison the TTL index
        };
        const before = Date.now();
        await dataAdapter.create(resource);
        const after = Date.now();

        const found = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        assert.instanceOf(found.createdAt, Date);
        const ts = (found.createdAt as Date).getTime();
        assert.isFalse(Number.isNaN(ts));
        assert.isAtLeast(ts, before);
        assert.isAtMost(ts, after);
    });

    it('preserves createdAt across update() (regression for issue #16)', async () => {
        const t0 = new Date('2019-03-03T03:03:03.000Z');
        const resource: IdempotencyResourceWithCreatedAt = {
            ...createFakeIdempotencyResource(),
            createdAt: t0,
        };
        await dataAdapter.create(resource);

        // Read it back and persist a response, as the middleware does.
        const found = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        const response = createFakeIdempotencyResponse();
        found.response = response;
        await dataAdapter.update(found);

        const foundAgain = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        // createdAt must NOT be regenerated by update() — this is the core of #16.
        assert.equal((foundAgain.createdAt as Date).getTime(), t0.getTime());
        // ...and the response must still be persisted.
        assert.deepEqual(foundAgain.response, response);
    });

    it('returns a stable createdAt across reads (zombie-write guard support)', async () => {
        const resource: IdempotencyResourceWithCreatedAt = {
            ...createFakeIdempotencyResource(),
            createdAt: new Date('2022-12-31T23:59:59.000Z'),
        };
        await dataAdapter.create(resource);

        const r1 = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        const r2 = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        assert.equal(
            (r1.createdAt as Date).getTime(),
            (r2.createdAt as Date).getTime()
        );
    });

    it('does not erase an existing response on a response-less update ($set semantics)', async () => {
        const t0 = new Date('2018-08-08T08:08:08.000Z');
        const resource: IdempotencyResourceWithCreatedAt = {
            ...createFakeIdempotencyResource(),
            createdAt: t0,
        };
        await dataAdapter.create(resource);

        // First update persists a response (the middleware's normal flow).
        const response = createFakeIdempotencyResponse();
        await dataAdapter.update({ ...resource, response });

        // A subsequent response-less update must not wipe the cached response —
        // this is where $set diverges from the former replaceOne.
        await dataAdapter.update(resource);

        const found = (await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        )) as IdempotencyResourceWithCreatedAt;
        assert.deepEqual(found.response, response);
        // createdAt is still preserved across both updates.
        assert.equal((found.createdAt as Date).getTime(), t0.getTime());
    });

    it('update() on an unknown key is a no-op (no upsert)', async () => {
        const resource = createFakeIdempotencyResource(); // never created
        await dataAdapter.update({
            ...resource,
            response: createFakeIdempotencyResponse(),
        });
        const found = await dataAdapter.findByIdempotencyKey(
            resource.idempotencyKey
        );
        assert.isNull(found);
    });

    it('returns error if not initialized before interacting', async () => {
        const newDataAdapter = new MongoAdapter.MongoAdapter({
            config: {
                uri: mongoUri,
            },
        });
        try {
            await newDataAdapter.findByIdempotencyKey('something');
            assert.fail('It should throws an error because not initialized');
        } catch (err) {
            assert.ok(err);
        }
    });

    it('allows database connection delegation', async () => {
        const mongoClient = await new MongoClient(mongoUri).connect();
        const newDataAdapter = new MongoAdapter.MongoAdapter({
            useDelegation: true,
            delegate: async (): Promise<Db> => {
                return mongoClient.db();
            },
        });
        await newDataAdapter.init();
        try {
            await newDataAdapter.create(createFakeIdempotencyResource());
            await mongoClient.close();
        } catch (err) {
            assert.fail(
                `Error while creating fake idempotency resource : ${err}`
            );
        }
    });
});

function createFakeIdempotencyRequest(): IdempotencyRequest {
    return {
        url: faker.internet.url(),
        method: faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
        body: { data: faker.string.alphanumeric(10) },
        headers: { 'content-type': 'application/json' },
        query: { q: faker.string.alphanumeric(5) },
    };
}

function createFakeIdempotencyResponse(): IdempotencyResponse {
    const idempotencyResponse = new IdempotencyResponse();
    idempotencyResponse.statusCode = faker.helpers.arrayElement([
        200, 201, 204,
    ]);
    idempotencyResponse.body = {
        id: faker.string.uuid(),
        message: faker.lorem.sentence(),
    };
    return idempotencyResponse;
}

function createFakeIdempotencyResource(): IdempotencyResource {
    const res: IdempotencyResource = {
        idempotencyKey: faker.string.uuid(),
        request: createFakeIdempotencyRequest(),
    };
    return res;
}

function createArrayOfIndempotencyResource(
    count: number = 5
): IdempotencyResource[] {
    const idempotencyResources: IdempotencyResource[] = [];
    for (let i = 0; i < count; i++) {
        idempotencyResources.push(createFakeIdempotencyResource());
    }
    return idempotencyResources;
}
