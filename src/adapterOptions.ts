// Copyright (c) Ville de Montreal. All rights reserved.
// Licensed under the MIT license.
// See LICENSE file in the project root for full license information.

import * as mongodb from 'mongodb';

/**
 * Interface which describe the Mongo driver connection options.
 * Basically, used to get a mongo client.
 * For more information, @see https://mongodb.github.io/node-mongodb-native/3.3/reference/connecting/
 */
export interface MongoConnectionOptions {
  // The mongo connection string URI.
  uri: string;

  // Reference on the driver-specific connection settings.
  settings?: any;
}

/**
 * Interface which describe available options for
 * the mongo adapter instanciation.
 */
export interface AdapterOptions {
  // mongo connection configuration
  config?: MongoConnectionOptions;
  // Can use delegation to get the database connection.
  // Useful with Mongoose.
  useDelegation?: boolean;
  delegate?: () => Promise<mongodb.Db>;

  // The prefix used to create collections in the mongo database
  // Default value is 'idempotency'
  collectionPrefix?: string;

  // Time to live, in seconds. It will remove
  // a resource after a certain period of time.
  // Default is 86400 (1 day).
  ttl?: number;
}
