import * as MongoAdapter from './adapter';
import * as sinon from 'sinon';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { assert } from 'chai';
import * as faker from 'faker';
import {
    IdempotencyResource,
    IdempotencyRequest,
    IdempotencyResponse,
} from 'express-idempotency';
import { Db, MongoClient } from 'mongodb';

describe('IIdempotencyDataAdapter tests', () => {
    let mongod: MongoMemoryServer = null;
    let dataAdapter: MongoAdapter.MongoAdapter = null;

    before(function (done) {
        // Set a timeout which will give enough time to download the mongo memory server binairy
        // to be downloaded.
        this.timeout(60000);

        MongoMemoryServer.create().then((value) => {
            mongod = value;

            dataAdapter = MongoAdapter.newAdapter({
                config: {
                    uri: mongod.getUri(),
                },
            });

            // Be sure that the schema has been initialized
            setTimeout(done, 1000);
        });
    });

    // Clean Mongo memory server after use
    after(async () => {
        await dataAdapter.stop();
        await mongod.stop();
    });

    afterEach(() => {
        sinon.restore;
    });

    it('finds correct idempotency key from multiple resource insertion', async () => {
        // Generate resources
        const idempotencyResources = createArrayOfIndempotencyResource(99);
        for (const singleIdempotencyResource of idempotencyResources) {
            await dataAdapter.create(singleIdempotencyResource);
        }

        // Select a single resource and try to find it
        const index: number = faker.random.number({
            min: 0,
            max: idempotencyResources.length - 1,
        });
        const idempotencyResourceToFind: IdempotencyResource =
            idempotencyResources[index];

        // Find the resource
        const idempotencyFound = await dataAdapter.findByIdempotencyKey(
            idempotencyResourceToFind.idempotencyKey
        );
        assert.ok(idempotencyFound);
        assert.deepEqual(idempotencyFound, idempotencyResourceToFind);
    });

    it('prevents idempotency key duplication', async () => {
        const idempotencyResource = createFakeIdempotencyResource();
        await dataAdapter.create(idempotencyResource);

        const newIdempotencyResource = createFakeIdempotencyResource();
        newIdempotencyResource.idempotencyKey =
            idempotencyResource.idempotencyKey;

        try {
            await dataAdapter.create(idempotencyResource);
            assert.fail('Expected to throw duplication error.');
        } catch (err) {
            assert.ok(err);
        }
    });

    it('updates resource with response', async () => {
        // Generate resources
        const idempotencyResources = createArrayOfIndempotencyResource(10);
        for (const singleIdempotencyResource of idempotencyResources) {
            await dataAdapter.create(singleIdempotencyResource);
        }

        // Select a single resource and try to find it
        const index: number = faker.random.number({
            min: 0,
            max: idempotencyResources.length - 1,
        });
        const idempotencyResourceToFind: IdempotencyResource =
            idempotencyResources[index];

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
        const idempotencyResources = createArrayOfIndempotencyResource(10);
        for (const singleIdempotencyResource of idempotencyResources) {
            await dataAdapter.create(singleIdempotencyResource);
        }

        // Select a single resource and try to find it
        const index: number = faker.random.number({
            min: 0,
            max: idempotencyResources.length - 1,
        });
        const idempotencyResourceToFind: IdempotencyResource =
            idempotencyResources[index];

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

    it('returns error if not initialized before interacting', async () => {
        const newDataAdapter = new MongoAdapter.MongoAdapter({
            config: {
                uri: await mongod.getUri(),
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
        const mongoClient = await new MongoClient(
            await mongod.getUri()
        ).connect();
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
        method: faker.random.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
        body: faker.random.objectElement(),
        headers: {},
        query: {},
    };
}

function createFakeIdempotencyResponse(): IdempotencyResponse {
    const idempotencyResponse = new IdempotencyResponse();
    idempotencyResponse.statusCode = faker.random.arrayElement([200, 201, 204]);
    idempotencyResponse.body = faker.random.objectElement();
    return idempotencyResponse;
}

function createFakeIdempotencyResource(): IdempotencyResource {
    const res: IdempotencyResource = {
        idempotencyKey: faker.random.uuid(),
        request: createFakeIdempotencyRequest(),
    };
    return res;
}

function createArrayOfIndempotencyResource(
    maxResource: number = faker.random.number(999)
): IdempotencyResource[] {
    const idempotencyResources: IdempotencyResource[] = [];
    const resourceCount: number = faker.random.number({
        min: 1,
        max: maxResource,
    });
    for (let i = 0; i < resourceCount; i++) {
        idempotencyResources.push(createFakeIdempotencyResource());
    }
    return idempotencyResources;
}
