// Copyright (c) Ville de Montreal. All rights reserved.
// Licensed under the MIT license.
// See LICENSE file in the project root for full license information.

const express = require('express');
const app = express();
const idempotency = require('express-idempotency');
const MongoAdapter = require('express-idempotency-mongo-adapter');

// New Mongo Adapter that will be used by the idempotency middleware
const adapter = MongoAdapter.newAdapter({
  config: {
    uri: 'mongodb://root:root@mongo:27017',
  },
  ttl: 30,
});

// Add the idempotency middleware by specifying the use of the mongo adapter.
const idempotencyMiddleware = idempotency.idempotency({
  dataAdapter: adapter,
});

// Could use app.use but showing another way to use middleware
app.get('/', idempotencyMiddleware, function (req, res) {
  const idempotencyService = idempotency.getSharedIdempotencyService();
  if (idempotencyService.isHit(req)) {
    console.log('Idempotency middleware did already process the request!');
    return;
  }

  // Return the current date and time
  res.send(new Date().toISOString());
});

app.listen(8080, function () {
  console.log('30s ttl example, listening on port 8080 with express-idempotency middleware.');
});
