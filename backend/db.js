import { MongoClient, ServerApiVersion } from "mongodb";

const databaseName = process.env.MONGODB_DB || "work_hours_dashboard";

let client;
let database;
let connectionPromise;

export async function connectDatabase() {
  if (database) return database;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("缺少 MONGODB_URI 环境变量");
  }

  if (!connectionPromise) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    connectionPromise = client.connect()
      .then(async () => {
        await client.db("admin").command({ ping: 1 });
        database = client.db(databaseName);
        return database;
      })
      .catch((error) => {
        connectionPromise = undefined;
        client = undefined;
        throw error;
      });
  }

  return connectionPromise;
}

export function getDatabase() {
  if (!database) throw new Error("MongoDB 尚未连接");
  return database;
}

export async function closeDatabase() {
  if (client) await client.close();
  client = undefined;
  database = undefined;
  connectionPromise = undefined;
}
