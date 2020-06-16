import { assert } from 'chai';

import * as MongoAdapter from './index';

describe('Imports from index', () => {
    it('should provide access to some functions', () => {
        assert.exists(MongoAdapter.newAdapter);
    });
});
