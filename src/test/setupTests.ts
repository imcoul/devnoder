// Dexie (used throughout src/services) needs a real `indexedDB` global,
// which plain Node doesn't provide — fake-indexeddb supplies an in-memory
// implementation so the actual storage code under test runs unmodified.
import 'fake-indexeddb/auto';
