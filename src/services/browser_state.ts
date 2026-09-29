const NAMESPACE = 'document-qa';
const namespaces = new WeakMap<Storage, string>();

/** Reuse an existing namespace so a naming change keeps saved chats and settings. */
export function storageKey(suffix: string, storage: Storage = window.localStorage): string {
  let namespace = namespaces.get(storage);
  if (!namespace) {
    const candidates = new Set<string>();
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      const match = key?.match(/^(.+)-(?:chat-settings|conversations-list)$/);
      if (match) candidates.add(match[1]);
    }
    namespace = candidates.has(NAMESPACE) || candidates.size !== 1
      ? NAMESPACE : [...candidates][0];
    namespaces.set(storage, namespace);
  }
  return `${namespace}-${suffix}`;
}

/** Keep downloaded weights available without copying a multi-gigabyte cache. */
export async function modelCacheName(storage: CacheStorage = window.caches): Promise<string> {
  const current = `${NAMESPACE}-models`;
  const names = typeof storage.keys === 'function' ? await storage.keys() : [];
  if (names.includes(current)) return current;
  const previous = names.filter(name => name.endsWith('-models'));
  return previous.length === 1 ? previous[0] : current;
}

/** Preserve a previously selected local model directory after a naming change. */
export async function directoryDatabaseName(factory: IDBFactory = indexedDB): Promise<string> {
  const current = `${NAMESPACE}-local-dir`;
  const databases = typeof factory.databases === 'function' ? await factory.databases() : [];
  if (databases.some(database => database.name === current)) return current;
  const previous = databases.map(database => database.name)
    .filter((name): name is string => Boolean(name?.endsWith('-local-dir')));
  return previous.length === 1 ? previous[0] : current;
}
