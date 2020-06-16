Use MongoDB to store data related to the express idempotency middleware.

#### Production (master)

[![CircleCI](https://circleci.com/gh/VilledeMontreal/express-idempotency-mongo-adapter/tree/master.svg?style=shield)](https://circleci.com/gh/VilledeMontreal/express-idempotency-mongo-adapter/tree/master) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/97f63f7f950646029d31522da824a757?branch=master)](https://www.codacy.com/gh/VilledeMontreal/express-idempotency-mongo-adapter?utm_source=github.com&utm_medium=referral&utm_content=VilledeMontreal/express-idempotency-mongo-adapter&utm_campaign=Badge_Grade&branch=master)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/97f63f7f950646029d31522da824a757?branch=master)](https://www.codacy.com/gh/VilledeMontreal/express-idempotency-mongo-adapter?utm_source=github.com&utm_medium=referral&utm_content=VilledeMontreal/express-idempotency-mongo-adapter&utm_campaign=Badge_Coverage&branch=master)

#### Development branch (develop)

[![CircleCI](https://circleci.com/gh/VilledeMontreal/express-idempotency-mongo-adapter/tree/develop.svg?style=shield)](https://circleci.com/gh/VilledeMontreal/express-idempotency-mongo-adapter/tree/develop) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/97f63f7f950646029d31522da824a757?branch=develop)](https://www.codacy.com/gh/VilledeMontreal/express-idempotency-mongo-adapter?utm_source=github.com&utm_medium=referral&utm_content=VilledeMontreal/express-idempotency-mongo-adapter&utm_campaign=Badge_Grade&branch=develop)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/97f63f7f950646029d31522da824a757?branch=develop)](https://www.codacy.com/gh/VilledeMontreal/express-idempotency-mongo-adapter?utm_source=github.com&utm_medium=referral&utm_content=VilledeMontreal/express-idempotency-mongo-adapter&utm_campaign=Badge_Coverage&branch=develop)

([Français](#french-version))

<a id='english-version' class='anchor' aria-hidden='true'/>

# MongoDB adapter for express-idempotency

Allow the [express-idempotency](https://github.com/VilledeMontreal/express-idempotency) to store data in a MongoDB database.

This is a [Node.js](https://nodejs.org/) module designed to work with Express, available through the [NPM registry](https://www.npmjs.com/).

## Features

-   Provides adapter to support MongoDB
-   Allows the use of time-to-live (TTL) indexes to manage data

## Examples

For examples, check the `examples` folder.

## Getting started

Install the dependency.

```
$ npm install express-idempotency-mongo-adapter
```

Integrate the data adapter during the middleware initialization.

```javascript
const idempotency = require('express-idempotency');
const MongoAdapter = require('express-idempotency-mongo-adapter');

// New Mongo Adapter that will be used by the idempotency middleware
const adapter = MongoAdapter.newAdapter({
    config: {
        uri: 'mongodb://root:root@mongo:27017',
    },
});

// Add the idempotency middleware by specifying the use of the mongo adapter.
app.use(
    idempotency.idempotency({
        dataAdapter: adapter,
    })
);
```

The data adapter will take care of creating the corresponding collection required to store data from the express idempotency middleware.

### Options

You can configure the data adapter by providing options during initialization.

```javascript
MongoAdapter.newAdapter({
    // Provide the MongoDB configuration. Cannot be used with database connection delegation.
    config?: {
        // The uri of mongo instance
        uri: 'mongodb://root:root@mongo:27017',
        // Provide mongo connection settings
        // @see https://mongodb.github.io/node-mongodb-native/2.1/reference/connecting/connection-settings/
        settings: {}
    },
    // Use delegation or not. Default is false.
    // If true, instead of using the provided configuration, it will call the delegate function to
    // retrieve a database connection.
    useDelegation?: boolean;
    // The function to call by the data adapter to get the connection to the database.
    delegate?: () => Promise<mongodb.Db>;

    // The prefix used to create collections in the mongo database
    // Default value is 'idempotency'
    collectionPrefix?: string;

    // Time to live, in seconds. It will remove
    // a resource after a certain period of time.
    // Default is 86400 (1 day).
    ttl?: number;
});
```

#### Mongo configuration and delegation

THe data adapter can manage connection itself by providing a MongoDB configuration. It will use the MongoDB node driver.

Sometimes, applications can manage connection externally by having a singleton client or using Mongoose for example. In these case, you can provide a delegate function to provide a MongoDB connection from your client when requested by the data adapter.

#### Collection prefix

To avoid name conflict while using collection, it is possible to provide a collection prefix.

#### Time-to-live (TTL)

The data adapter will create TTL indexes to purge data from collection after a certain period of time. By default, the ttl is `1 day` but is configurable.

## License

The source code of this project is distributed under the [MIT License](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md#english-version).

## Code of Conduct

Participation in this poject is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

([English](#english-version))

<a id='french-version' class='anchor' aria-hidden='true'/>

# Adapteur de données MongoDB pour le middleware express-idempotency

Permet au middleware [express-idempotency](https://github.com/VilledeMontreal/express-idempotency) de stocker ses données dans une base de données MongoDB.

Ce module [Node.js](https://nodejs.org/) est conçu pour fonctionner avec Express, et disponible sur le [registre NPM](https://www.npmjs.com/).

## Fonctionnalités

-   Support d'une base de données MongoDB pour le stockage des données
-   Permet de gérer les données avec l'utilisation d'index time-to-live (TTL)

## Exemples

Pour des exemples, voir le répertoire `examples`.

## Démarrage rapide

Installation de la dépendance.

```
$ npm install express-idempotency-mongo-adapter
```

Intégrer l'adapteur de données durant l'initialisation du middleware.

```javascript
const idempotency = require('express-idempotency');
const MongoAdapter = require('express-idempotency-mongo-adapter');

// Nouvel adapteur mongo à utiliser par le middleware express-idempotency
const adapter = MongoAdapter.newAdapter({
    config: {
        uri: 'mongodb://root:root@mongo:27017',
    },
});

// Ajout du middleware en précisant l'utilisation de l'adapteur mongo
app.use(
    idempotency.idempotency({
        dataAdapter: adapter,
    })
);
```

L'adapteur de données va créer les collections requises à son utilisation pour stocker les données provenant du middleware express-idempotency.

### Options

VOus pouvez configurer l'adapteur de données en y fournissant des options durant l'initialisation.

```javascript
MongoAdapter.newAdapter({
    // Fournir une configuration MongoDB. On ne peut pas combiner son utilisation avec la délégation.
    config?: {
        // Le URI vers MongoDB
        uri: 'mongodb://root:root@mongo:27017',
        // Fournir des réglagles additionnels spécifique à MongoDB
        // @see https://mongodb.github.io/node-mongodb-native/2.1/reference/connecting/connection-settings/
        settings: {}
    },
    // Utilisation de la délégation ou non. Par défaut, cette fonction est désactivée.
    // Si utilisé, plutôt qu'utiliser la configuration fournie, l'adapteur va faire un appel à la fonction delegate
    // afin d'obtenir un lien vers la base de données.
    useDelegation?: boolean;
    // La fonction appelée par l'adapteur de données lorsqu'en mode délégation.
    delegate?: () => Promise<mongodb.Db>;

    // Préfixe à utiliser lors de la création de la collection dans la base de données.
    // Par défaut, la valeur est 'idempotency'.
    collectionPrefix?: string;

    // Time to live, en seconde. Ceci permet de retirer des données
    // après une certaine période de temps.
    // La valeur par défaut est 86400 (1 jour).
    ttl?: number;
});
```

#### Configuration et délégation

L'adapteur de données permet de gérer une connexion elle-même si une configuration a été fournie. Cette connexion est établie en utilisant le pilote MongoDB pour Node.

Dans certain cas, la connexion peut être géré par l'application, soit par une instance unique (singleton) ou via Mongoose, par exemple. Dans ces cas, l'utilisation de la délégation est intéressante pour permettre de fournir à la demande une connexion à l'adapteur de données.

#### Préfixe de collection

Afin d'éviter des collisions au niveau des noms de collection, il est possible de fournir un préfix.

#### Time-to-live (TTL)

L'adapteur de données créé des index de type TTL afin de purger les données après un certain temps. Par défaut, la valeur du ttl est `1 jour` mais elle est configurable.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md#french-version)

## Licence et propriété intellectuelle

Le code source de ce projet est libéré sous la licence [MIT License](LICENSE).

## Code de Conduite

La participation à ce projet est réglementée part le [Code de Conduite](CODE_OF_CONDUCT.md#french-version)
