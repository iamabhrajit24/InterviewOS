import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewos';
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  console.warn('Please add your MONGODB_URI to .env.local');
}

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
  
  // Attach a silent catch handler to prevent unhandled promise rejection warnings in Node.js
  clientPromise.catch(() => {});
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
  clientPromise.catch(() => {});
}

// Export a module-scoped MongoClient promise.
export default clientPromise;

let fallbackDb: any = null;

function createFallbackDb() {
  if (fallbackDb) return fallbackDb;

  const fs = require('fs');
  const path = require('path');
  const fallbackFilePath = path.join(process.cwd(), '.mongodb_fallback.json');

  let data: Record<string, any[]> = {};
  try {
    if (fs.existsSync(fallbackFilePath)) {
      data = JSON.parse(fs.readFileSync(fallbackFilePath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read fallback database file:', err);
  }

  const saveData = () => {
    try {
      fs.writeFileSync(fallbackFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write fallback database file:', err);
    }
  };

  const getCollection = (colName: string) => {
    if (!data[colName]) {
      data[colName] = [];
    }

    return {
      findOne: async (query: any, findOptions?: any) => {
        let items = data[colName] || [];
        
        // Handle sorting if present
        if (findOptions?.sort) {
          const sortKey = Object.keys(findOptions.sort)[0];
          const sortOrder = findOptions.sort[sortKey];
          items = [...items].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];
            if (valA < valB) return sortOrder === -1 ? 1 : -1;
            if (valA > valB) return sortOrder === -1 ? -1 : 1;
            return 0;
          });
        }
        
        // Simple query matching
        const match = items.find((item: any) => {
          return Object.entries(query).every(([key, value]) => {
            // Case-insensitive email comparison for user login/signup
            if (key === 'email' && typeof value === 'string' && typeof item[key] === 'string') {
              return item[key].toLowerCase() === value.toLowerCase();
            }
            return item[key] === value;
          });
        });
        
        return match || null;
      },

      insertOne: async (doc: any) => {
        const _id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const newDoc = { _id, ...doc };
        data[colName].push(newDoc);
        saveData();
        return { insertedId: _id, acknowledged: true };
      },

      updateOne: async (query: any, update: any, updateOptions?: any) => {
        const items = data[colName] || [];
        const matchIdx = items.findIndex((item: any) => {
          return Object.entries(query).every(([key, value]) => item[key] === value);
        });

        if (matchIdx !== -1) {
          const doc = items[matchIdx];
          if (update.$set) {
            Object.assign(doc, update.$set);
          }
          if (update.$push) {
            for (const [key, value] of Object.entries(update.$push)) {
              if (!Array.isArray(doc[key])) doc[key] = [];
              doc[key].push(value);
            }
          }
          items[matchIdx] = doc;
          saveData();
          return { modifiedCount: 1, matchedCount: 1, acknowledged: true };
        }
        
        if (updateOptions?.upsert) {
          const _id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          const newDoc = { _id, ...query };
          if (update.$set) {
            Object.assign(newDoc, update.$set);
          }
          data[colName].push(newDoc);
          saveData();
          return { upsertedId: _id, upsertedCount: 1, matchedCount: 0, acknowledged: true };
        }

        return { modifiedCount: 0, matchedCount: 0, acknowledged: true };
      },

      find: (query: any) => {
        let items = data[colName] || [];
        
        // Basic match logic
        let matches = items.filter((item: any) => {
          return Object.entries(query).every(([key, value]) => item[key] === value);
        });

        const findObj = {
          toArray: async () => matches,
          sort: function(sortObj: any) {
            const sortKey = Object.keys(sortObj)[0];
            const sortOrder = sortObj[sortKey];
            matches = [...matches].sort((a, b) => {
              const valA = a[sortKey];
              const valB = b[sortKey];
              if (valA < valB) return sortOrder === -1 ? 1 : -1;
              if (valA > valB) return sortOrder === -1 ? -1 : 1;
              return 0;
            });
            return this;
          }
        };
        return findObj;
      }
    };
  };

  fallbackDb = {
    collection: getCollection
  };

  return fallbackDb;
}

let isFallbackActive = false;

export async function getDb() {
  if (isFallbackActive) {
    return createFallbackDb();
  }
  
  try {
    const conn = await clientPromise;
    return conn.db();
  } catch (error: any) {
    console.warn('\n⚠️  DATABASE CONNECTION WARNING:');
    console.warn(`Could not connect to MongoDB Atlas cluster at ${uri.substring(0, 35)}...`);
    console.warn(`Reason: ${error.message || error}`);
    console.warn('👉 Switching to a resilient local JSON-based database fallback for offline development.');
    console.warn('👉 Your local data will be persisted at: .mongodb_fallback.json\n');
    isFallbackActive = true;
    return createFallbackDb();
  }
}

