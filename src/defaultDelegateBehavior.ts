import { boundClass } from 'autobind-decorator';
import { Db, MongoClient } from 'mongodb';
import { MongoConnectionOptions } from './adapterOptions';


/**
 * This class is used to provide a default delegation behavior to the
 * mongo data adapter. It is used if a delegate function is not provided
 * during the mongo data adapter configuration.
 * 
 */
@boundClass
export class DefaultDelegateBehavior {

    // Database connection
    private _mongoClient: MongoClient;
    private _db: Db;

    /**
     * Constructor, basically keep a copy of the connection options passed as arguments.
     * @param options Provided Mongo connection options
     */
    public constructor(private connectionOptions: MongoConnectionOptions) {}

    /**
     * Connect to the database and keep reference of the
     * database object. This is where the connection pool
     * is maintained.
     */
    private async connectToDatabase(): Promise<void> {
        this._mongoClient = new MongoClient(
            this.connectionOptions.uri,
            this.connectionOptions.settings
        );
        await this._mongoClient.connect();
        // Keep reference to the db, as recommanded
        // @see https://mongodb.github.io/node-mongodb-native/driver-articles/mongoclient.html#mongoclient-connection-pooling
        this._db = this._mongoClient.db();
    }

    /**
     * Initialize the default delegate.
     * Basically, it connects to the database.
     * @returns 
     */
    public async init(): Promise<void> {
        await this.connectToDatabase();
    }

    /**
     * The delegation for the data adapter to get access
     * to the database.
     * @returns 
     */
    public delegate(): Promise<Db> {
        return new Promise(resolve => resolve(this._db));
    }

    /**
     * Used to stop the adapter by closing database connection.
     */
     public async stop(): Promise<boolean> {
        if (this._mongoClient) {
            try {
                await this._mongoClient.close();
                return true;
            } catch (err) {
                return false;
            }
        }
    }

}
