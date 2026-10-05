interface SecureStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}
interface Manifest { generation: string; count: number }

export function createSecureSessionStorage(storage: SecureStorage, generation: () => string) {
  let pending: Promise<unknown> = Promise.resolve();
  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const result = pending.then(task);
    pending = result.catch(() => undefined);
    return result;
  };
  const readManifest = async (key: string): Promise<Manifest | null> => {
    const value = await storage.get(key);
    if (!value) return null;
    try {
      const manifest = JSON.parse(value);
      return typeof manifest.generation === 'string' && /^[a-z0-9-]+$/.test(manifest.generation) &&
        Number.isInteger(manifest.count) && manifest.count > 0 && manifest.count <= 128 ? manifest : null;
    } catch { return null; }
  };
  const removeChunks = async (key: string, manifest: Manifest) => {
    await Promise.all(Array.from({ length: manifest.count }, (_, index) => storage.remove(`${key}.${manifest.generation}.${index}`)));
  };
  return {
    getItem: (key: string) => serialize(async (): Promise<string | null> => {
      const manifest = await readManifest(key);
      if (!manifest) return null;
      const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, index) => storage.get(`${key}.${manifest.generation}.${index}`)));
      return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
    }),
    setItem: (key: string, value: string) => serialize(async () => {
      if (!value || value.length > 65536) throw new Error('Invalid session size.');
      const previous = await readManifest(key);
      const id = generation();
      const chunks: string[] = [];
      let chunk = '';
      for (const character of value) {
        if (chunk.length + character.length > 512) { chunks.push(chunk); chunk = ''; }
        chunk += character;
      }
      if (chunk) chunks.push(chunk);
      if (chunks.length > 128) throw new Error('Session is too large.');
      await Promise.all(chunks.map((chunk, index) => storage.set(`${key}.${id}.${index}`, chunk)));
      await storage.set(key, JSON.stringify({ generation: id, count: chunks.length }));
      if (previous) { try { await removeChunks(key, previous); } catch {} }
    }),
    removeItem: (key: string) => serialize(async () => {
      const previous = await readManifest(key);
      await storage.remove(key);
      if (previous) await removeChunks(key, previous);
    }),
  };
}
