// Copyright (c) Ville de Montreal. All rights reserved.
// Licensed under the MIT license.
// See LICENSE file in the project root for full license information.

import {
    IdempotencyResource,
    IIdempotencyDataAdapter,
} from 'express-idempotency';
import { boundClass } from 'autobind-decorator';
import { AdapterOptions } from './adapterOptions';
import { Collection, Db } from 'mongodb';
import { DefaultDelegateBehavior } from './defaultDelegateBehavior';

// Default values
const COLLECTION_PREFIX = 'idempotency';

// Constantes
const COLLECTION_SCHEMA_SUFFIX = 'Schema';
const COLLECTION_STORE_SUFFIX = 'Store';
const TTL = 86400;
const SCHEMA_VERSION = '1.0.0';

/**
 * Specific idempotency resource for the mongo adapter.
 * Used to keep more information on the resource.
 */
interface MongoIdempotencyResource extends IdempotencyResource {
    // Indicate the schema version used to describe the idempotency resource.
    // Required to provide backward compatibility later.
    schemaVersion: number;

    // The date and time the resource as been created. Used by the TTL mongo index
    // to clear the collection.
    createdAt: Date;
}

/**
 * This is the Express Idempotency Mongo Adapter implementation.
 * It implements the IIdempotencyDataAdapter from the @villemontreal/express-idempotency library.
 */
@boundClass
export class MongoAdapter implements IIdempotencyDataAdapter {
    // Options used to configure the mongo adapter
    private _options: AdapterOptions;

    // Indicate that the adapter as been initialize.
    // This is to prevent the schema creation phase to repeat itself.
    private _initialized = false;

    // Reference to the default delegate behavior is this option is used.
    private _defaultDelegateBehavior: DefaultDelegateBehavior = null;

    /**
     * Constructor, basically keep a copy of options passed as arguments.
     * For optional properties that are not provided, use the default value.
     * @param options Provided options
     */
    public constructor(options: AdapterOptions) {
        // Initialize default delegate behavior if required
        if (!options?.useDelegation) {
            this._defaultDelegateBehavior = new DefaultDelegateBehavior(
                options.config
            );
        }

        this._options = {
            config: options.config,
            useDelegation: options.useDelegation,
            delegate: options.useDelegation
                ? options.delegate
                : this._defaultDelegateBehavior.delegate,
            collectionPrefix: options.collectionPrefix
                ? options.collectionPrefix
                : COLLECTION_PREFIX,
            ttl: options.ttl ? options.ttl : TTL,
        };
    }

    /**
     * Indicate if the adapter is ready for use.
     */
    public isInitialized(): boolean {
        return this._initialized;
    }

    /**
     * Mongo initialization of the adapter.
     * It creates the collection and the appropriate indexes.
     */
    public async init(): Promise<void> {
        // Initialize default delegate is required
        if (this._defaultDelegateBehavior) {
            await this._defaultDelegateBehavior.init();
        }

        // Setup store collection
        const storeCollection = await this.getOrCreateCollection(
            this.getStoreCollectionName()
        );

        // Create the idempotency key index if it doesn't exist
        await storeCollection.createIndexes([
            {
                key: { idempotencyKey: 1 },
                name: 'searchByKey',
                unique: true,
            },
            {
                key: { createdAt: 1 },
                name: 'ttlKey',
                expireAfterSeconds: this._options.ttl,
            },
        ]);

        // Setup schema collection
        await this.getOrCreateCollection(this.getSchemaCollectionName());

        // Indicate that the adapter has been initialized
        this._initialized = true;
    }

    /**
     * Used to stop the adapter by closing database connection.
     */
    public async stop(): Promise<boolean> {
        if (this._defaultDelegateBehavior) {
            if (!(await this._defaultDelegateBehavior.stop())) {
                throw 'Failed to stop the adapter.';
            }
        }

        // Indicate that the adapter has been initialized
        this._initialized = false;

        return true;
    }

    /**
     * Get a collection, or create it if it doesn't exists.
     * @param collectionName The collection name to create
     */
    private async getOrCreateCollection(
        collectionName: string
    ): Promise<Collection<any>> {
        const db: Db = await this._options.delegate();

        let collection = null;
        try {
            collection = db.collection(collectionName);
        } catch (err) {
            collection = await db.createCollection(collectionName);
        }

        return collection;
    }

    /**
     * If not initialized, it will establish the connection to the database
     * and do the setup.
     */
    private async checkForInitialization(): Promise<void> {
        if (!this.isInitialized()) {
            throw new Error('Adapter has not been initialized.');
        }
    }

    /**
     * Get the store collection name.
     */
    public getStoreCollectionName(): string {
        return `${this._options.collectionPrefix}${COLLECTION_STORE_SUFFIX}`;
    }

    /**
     * Get the schema collection name.
     */
    public getSchemaCollectionName(): string {
        return `${this._options.collectionPrefix}${COLLECTION_SCHEMA_SUFFIX}`;
    }

    /**
     * Find the resource for a specific idempotency key.
     * @param idempotencyKey Idempotency key
     * @returns Idempotency resource
     */
    public async findByIdempotencyKey(
        idempotencyKey: string
    ): Promise<IdempotencyResource | null> {
        await this.checkForInitialization();
        const db: Db = await this._options.delegate();

        // Check if we can find the idempotency key in the store.
        const collection = db.collection<MongoIdempotencyResource>(
            this.getStoreCollectionName()
        );

        const result: MongoIdempotencyResource = await collection.findOne({
            idempotencyKey,
        });

        if (result) {
            const idempotencyResource: IdempotencyResource = {
                idempotencyKey: result.idempotencyKey,
                request: result.request,
            };
            if (result.response) {
                idempotencyResource.response = result.response;
            }
            return idempotencyResource;
        }
        return null;
    }

    /**
     * Create a idempotency resource.
     * @param idempotencyResource Idempotency resource
     */
    public async create(
        idempotencyResource: IdempotencyResource
    ): Promise<void> {
        await this.checkForInitialization();
        const db: Db = await this._options.delegate();

        const collection = db.collection(this.getStoreCollectionName());
        await collection.insertOne({
            ...idempotencyResource,
            createdAt: new Date(),
            schemaVersion: SCHEMA_VERSION,
        });
    }

    /**
     * Update a idempotency resource.
     * @param idempotencyResource Idempotency resource
     */
    public async update(
        idempotencyResource: IdempotencyResource
    ): Promise<void> {
        await this.checkForInitialization();
        const db: Db = await this._options.delegate();

        const newResource = {
            ...idempotencyResource,
            createdAt: new Date(),
            schemaVersion: SCHEMA_VERSION,
        };
        const collection = db.collection(this.getStoreCollectionName());
        await collection.replaceOne(
            { idempotencyKey: idempotencyResource.idempotencyKey },
            newResource
        );
    }

    /**
     * Delete a idempotency ressource.
     * @param idempotencyKey Idempotency key associated to idempotency resource to remove
     */
    public async delete(idempotencyKey: string): Promise<void> {
        await this.checkForInitialization();
        const db: Db = await this._options.delegate();
        const collection = db.collection(this.getStoreCollectionName());
        await collection.deleteOne({ idempotencyKey });
    }
}

/**
 * Function which instanciate a new mongo adapter.
 * @param options Provided options
 */
export function newAdapter(options: AdapterOptions): MongoAdapter {
    const adapter = new MongoAdapter(options);
    adapter
        .init()
        .then(() => {
            // Do nothing
        })
        .catch((err) => {
            throw err;
        }); // Launch initialiation
    return adapter;
}
