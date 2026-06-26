# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Vue d'ensemble

Librairie npm open source (`express-idempotency-mongo-adapter`, MIT, Ville de Montréal) : implémentation MongoDB de l'interface `IIdempotencyDataAdapter` du middleware [express-idempotency](https://github.com/VilledeMontreal/express-idempotency). Persiste les resources d'idempotence (clé → requête → réponse) dans une collection Mongo, et apporte exactement les deux garanties que la lib parente délègue à son data adapter :

- **Atomicité du create sous concurrence** — index **unique** sur `idempotencyKey` (`searchByKey`) → erreur Mongo E11000 sur clé dupliquée.
- **Expiration automatique** — index **TTL** sur `createdAt` (`ttlKey`, défaut 24 h).

Le `createdAt` porte aussi le mécanisme de **lease / processing-timeout de la lib parente v2.x** (reprise des resources « in progress » orphelines) : l'adapter persiste, **préserve** et ré-expose le timestamp estampillé par le middleware au début de la requête (`src/adapter.ts:22-48`).

**Attention** : ce repo n'est PAS un projet `generator-mtl-node-api`. Les conventions du CLAUDE.md parent `~/VDM/` (commandes `node run`, structure controllers/services, corelibs `@villedemontreal/*`) **ne s'appliquent pas**. Utiliser `npm run` directement.

## Commandes

| Commande | Usage |
|----------|-------|
| `npm test` | `tsc --build tsconfig.test.json` (typecheck) puis `nyc mocha` sur `src/**/*.test.ts` via ts-node. Démarre un vrai MongoDB en mémoire (`mongodb-memory-server`), sauf si `MONGO_URI` est défini (CI) → se connecte à ce Mongo réel. Produit `coverage/lcov.info`. |
| `npx mocha src/adapter.test.ts` | Un seul fichier de test (`.mocharc.yml` fournit `ts-node/register` + `source-map-support`) |
| `npx mocha --grep "pattern"` | Tests filtrés par nom de cas |
| `npm run compile` | Build de distribution → `dist/` (`tsconfig.dist.json`) ; seul `dist/` est publié (`package.json` `files`) |
| `npm run lint` / `npm run lint:fix` | ESLint 8 (config legacy `.eslintrc`, **pas** de flat config) |
| `npm run prettier` / `npm run prettier:fix` | Prettier en mode check / write |

Hooks Husky (v9, dossier `.husky/`) : `pre-push` exécute `npm run prettier && npm run lint && npm test` (**pas** de hook pre-commit) ; `commit-msg` impose Conventional Commits via commitlint.

> Pour reproduire le CI en local sans télécharger le binaire `mongodb-memory-server` : lancer un Mongo (`docker run -p 27017:27017 mongo:7`) puis `MONGO_URI=mongodb://localhost:27017/idempotency-test npm test`.

## Architecture

Trois fichiers dans `src/`, ré-exportés par `src/index.ts` (barrel : `export * from './adapter'` + `'./adapterOptions'`).

### `adapterOptions.ts` — `AdapterOptions`

Deux modes de connexion **mutuellement exclusifs** :

- `config: { uri, settings }` — client MongoDB **auto-géré** par l'adapter.
- `useDelegation: true` + `delegate: () => Promise<Db>` — **l'application fournit** la connexion (singleton, Mongoose…) ; l'adapter ne gère alors pas le cycle de vie du client.

Plus `collectionPrefix` (défaut `'idempotency'`) et `ttl` en secondes (défaut `86400`).

### `adapter.ts` — la classe `MongoAdapter`

Décorée `@boundClass` (`autobind-decorator`) **car ses méthodes sont passées détachées** au middleware parent. Implémente `IIdempotencyDataAdapter`.

- **Cycle de vie**
  - `init()` (`adapter.ts:128-167`) : connecte (config ou délégation via `connectToDatabase`, `adapter.ts:95-122`), crée la collection `{prefix}Store` avec les index `searchByKey` (unique sur `idempotencyKey`) et `ttlKey` (TTL `expireAfterSeconds` sur `createdAt`), puis crée la collection `{prefix}Schema` (créée mais **jamais lue/écrite** — placeholder de versioning). Bascule `_initialized = true`.
  - `stop()` (`adapter.ts:172-183`) : ferme le `MongoClient` **auto-géré uniquement** ; en mode délégation, la connexion appartient à l'application, rien n'est fermé.
- **CRUD** (chaque méthode appelle `checkForInitialization()` → throw `'Adapter has not been initialized.'` si `init()` n'a pas eu lieu) :
  - `findByIdempotencyKey` (`adapter.ts:264-297`) → `findOne`. Re-projette vers l'interface parente : **omet** `schemaVersion`, **ré-expose** `createdAt` (test `!= null`, pour ne pas masquer un epoch-0).
  - `create` (`adapter.ts:303-321`) → `insertOne` avec `createdAt: normalizeCreatedAt(createdAt)` (la valeur estampillée par le middleware, **pas** un nouveau timestamp) + `schemaVersion: '1.0.0'`.
  - `update` (`adapter.ts:327-355`) → `updateOne` / `$set` sur `request`, `schemaVersion`, et `response` **si définie**. Pas d'upsert.
  - `delete` (`adapter.ts:361-365`) → `deleteOne`.
- `normalizeCreatedAt(value)` (`adapter.ts:251-257`) : normalise `Date | number | null` → BSON `Date` ; **fallback `new Date()`** si absent ou invalide (`NaN`), pour ne jamais empoisonner l'index TTL.
- `newAdapter(options)` (`adapter.ts:372-383`) : factory qui instancie puis lance `init()` en **fire-and-forget** (voir piège ci-dessous) et retourne l'adapter immédiatement.

**Modèle de document** (`adapter.ts:30-48`) : `IdempotencyResource` (clé + requête originale complète + réponse optionnelle) **+** `schemaVersion: string` **+** `createdAt: Date`. Le type `createdAt` du contrat parent v2.x n'est pas dans les `.d.ts` de la version installée → déclaré localement (`IdempotencyResourceWithCreatedAt`, accepte `Date | number`) pour rester découplé de la version parente installée.

### `adapter.test.ts`

Tests **d'intégration** contre `mongodb-memory-server` (ou `MONGO_URI` en CI) : CRUD, duplication de clé (E11000), adapter non initialisé, mode délégation, et la batterie `createdAt` (persistance de la valeur fournie, epoch numérique, fallback, invalide, **préservation à travers `update()` — régression #16**, stabilité entre lectures, `$set` qui n'efface pas une réponse cachée, no-op sur clé inconnue).

### Lien avec la lib parente

`express-idempotency` est en **devDependency uniquement** (`package.json`, `^1.0.5`) — les interfaces ne servent qu'à la compilation, **aucune peerDependency** n'est déclarée (npm ne signalera jamais une incompatibilité de version). Dépendances runtime : `mongodb@^6.3` et `autobind-decorator@^2.4`. La lib parente est passée en **2.1.0** ; l'adapter est resté en `^1.0.5` côté types (l'API parente est restée rétrocompatible), d'où la déclaration locale de `createdAt`.

## Invariants et pièges connus

- **`newAdapter()` est fire-and-forget** (`adapter.ts:372-383`) : (a) fenêtre au démarrage où toute requête échoue (`'Adapter has not been initialized.'`) tant que `init()` n'a pas résolu ; (b) si la connexion échoue, le `throw err` placé **dans le `.catch()`** produit une unhandled promise rejection (fatale sur Node moderne). Pour un usage contrôlé au bootstrap : `const adapter = new MongoAdapter(opts); await adapter.init();`.
- **`update()` PRÉSERVE `createdAt`** (`adapter.ts:327-355`, fix [#16](https://github.com/VilledeMontreal/express-idempotency-mongo-adapter/issues/16)) : il utilise `updateOne`/`$set` et **ne réécrit jamais** `createdAt`. Le chrono TTL court donc depuis la **création** de la resource (début de requête), pas depuis la persistance de la réponse. C'est **voulu** et nécessaire au lease v2.x et au garde anti-zombie (`canStillPersist`) qui comparent le `createdAt` en mémoire à celui relu du store — ne pas « corriger ». (Avant le fix, `update()` faisait un `replaceOne` qui régénérait `createdAt` à chaque écriture et bloquait les resources « in progress » orphelines en `409` jusqu'à l'expiration du long TTL.)
- **`update()` est un no-op sur clé inconnue** (`$set` sans upsert) et **n'efface pas** une réponse déjà cachée lors d'un update sans `response` (divergence voulue vis-à-vis de l'ancien `replaceOne`).
- **Changer `ttl` sur une base existante casse `init()`** : `createIndexes` réutilise le nom `ttlKey` avec un `expireAfterSeconds` différent → conflit d'options d'index Mongo (l'index existant n'est pas modifié). Il faut un `collMod` ou un drop manuel de l'index avant. Combiné au point fire-and-forget, l'échec est silencieux-fatal.
- **`isInitlialized()`** (typo, `adapter.ts:87`) fait partie de l'**API publique** — la renommer est un **breaking change**.
- **Collection `{prefix}Schema`** créée mais jamais utilisée (`adapter.ts:157`) — placeholder de versioning ; seul `schemaVersion: '1.0.0'` est estampillé sur les documents du store.
- **Headers de requête persistés selon la version du middleware parent** : l'adapter stocke `request` tel quel (blob opaque). Avec une lib parente **≥ 2.1.0**, le middleware ne persiste qu'une whitelist de headers (`requestHeaderWhitelist`, défaut `content-type`) → plus de `Authorization`/cookies at rest (issue #36 du repo parent). Avec une parente **< 2.1.0**, tous les headers étaient capturés en bloc et se retrouvaient dans Mongo pour la durée du TTL.
- Tout changement de signature côté `IIdempotencyDataAdapter` doit rester aligné avec la lib parente `express-idempotency` (repo jumeau dans `../express-idempotency`).
- **L'expiration TTL Mongo passe par un background task (~60 s)** : ne pas écrire de test qui suppose une expiration exacte à la seconde. Aucun test ne couvre l'expiration TTL réelle — `examples/ttl/` (`ttl: 30`) sert de démo manuelle.

## Conventions du repo

- **README bilingue** (`README.md` : section `english-version` + `french-version`) : toute modification de doc doit être faite dans **les deux** sections.
- **CHANGELOG.md** au format Keep a Changelog — à mettre à jour pour tout changement notable, sous `[Unreleased]`.
- **Commits** : Conventional Commits (commitlint via le hook Husky `commit-msg`).
- `examples/simple-use/` et `examples/ttl/` : stacks Docker Compose exécutables (app Node + Mongo) ; `ttl/` démontre l'expiration avec `ttl: 30`.

## Release / CI

Tout passe par **GitHub Actions** (plus de CircleCI) :

- **CI** (`.github/workflows/ci.yml`) — build, lint, prettier, compile, test sur toutes les branches et les PR. Utilise un **service container MongoDB** (`mongo:7`) ciblé via `MONGO_URI` (au lieu de télécharger le binaire `mongodb-memory-server`). Pousse `coverage/lcov.info` vers **Codacy** sur les `push` vers le repo upstream uniquement (secret `CODACY_PROJECT_TOKEN`, étape `continue-on-error`).
- **Release** (`.github/workflows/release.yml`) — déclenché sur tag `vX.Y.Z`, rejoue les tests (service MongoDB) puis publie sur npm via **OIDC trusted publishing** (aucun `NPM_TOKEN` ; npm ≥ 11.5.1 fourni par Node 24 échange le jeton OIDC de GHA, avec `--provenance`) et crée une **GitHub Release** (notes du CHANGELOG). `vX.Y.Z` → dist-tag `latest`, `vX.Y.Z-<suffixe>` → dist-tag `rc`. Le job `version` aligne `package.json` sur le tag (`npm version --allow-same-version`) et échoue si aucune section `## [X.Y.Z]` n'existe dans `CHANGELOG.md`. Le job `publish` tourne dans l'environnement GitHub **`npm-production`** (required reviewer → approbation manuelle). Actions épinglées au SHA.
- **Prérequis publication** : le package doit être configuré en *trusted publisher* sur npmjs.com (repo `VilledeMontreal/express-idempotency-mongo-adapter` + workflow `release.yml`). Le `release.yml` doit exister sur le commit pointé par le tag.
- **Branches** : `master` (production) et `develop`.
- **Branch protection `master`** : un ruleset GitHub protège `master` — PR obligatoire (0 approbation requise), status check `build-test` (CI GitHub Actions) requis, pas de force-push ni de suppression de branche. Le rôle *Repository admin* peut contourner (bypass toujours actif, à réserver aux urgences). Les push directs sur `master` sont bloqués ; brancher depuis `master` et ouvrir une PR (CI verte requise).

## Documentation avancée

Analyse approfondie de la lib (architecture détaillée, risques opérationnels, lien avec la lib parente, références code `fichier:ligne`) : `.claude/analysis/library-overview-analysis.md`.
