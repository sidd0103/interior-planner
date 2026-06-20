/**
 * Binary asset storage for large files (videos, splats, GLB meshes, screenshots).
 *
 * Primary backend is OPFS (Origin Private File System) which keeps big binaries
 * out of IndexedDB and off the main metadata path. When OPFS is unavailable we
 * transparently fall back to an IndexedDB object store of Blobs.
 *
 * Assets are addressed by an opaque `assetId`. The metadata records in db.ts
 * store only these ids, never the bytes.
 */

import { newId } from "./id";

const OPFS_DIR = "assets";

function hasOPFS(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === "function"
  );
}

async function opfsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

// --- IndexedDB fallback (a tiny standalone store, independent of Dexie) ---

const FALLBACK_DB = "interior-planner-blobs";
const FALLBACK_STORE = "blobs";

function openFallback(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FALLBACK_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(FALLBACK_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fallbackPut(key: string, blob: Blob): Promise<void> {
  const db = await openFallback();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FALLBACK_STORE, "readwrite");
    tx.objectStore(FALLBACK_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function fallbackGet(key: string): Promise<Blob | undefined> {
  const db = await openFallback();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(FALLBACK_STORE, "readonly");
    const req = tx.objectStore(FALLBACK_STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

async function fallbackDelete(key: string): Promise<void> {
  const db = await openFallback();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FALLBACK_STORE, "readwrite");
    tx.objectStore(FALLBACK_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// --- Public API ---

/** Store a blob and return its generated assetId. */
export async function putAsset(blob: Blob): Promise<string> {
  const id = newId();
  if (hasOPFS()) {
    const dir = await opfsDir();
    const handle = await dir.getFileHandle(id, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    await fallbackPut(id, blob);
  }
  return id;
}

/** Retrieve a blob by assetId, or undefined if missing. */
export async function getAsset(id: string): Promise<Blob | undefined> {
  if (hasOPFS()) {
    try {
      const dir = await opfsDir();
      const handle = await dir.getFileHandle(id);
      return await handle.getFile();
    } catch {
      return undefined;
    }
  }
  return fallbackGet(id);
}

/**
 * Resolve an assetId to an object URL usable by <img>, <video>, or a GLB/splat
 * loader. Callers own the returned URL and must `revokeAssetUrl` it when done.
 */
export async function getAssetUrl(id: string): Promise<string | undefined> {
  const blob = await getAsset(id);
  return blob ? URL.createObjectURL(blob) : undefined;
}

export function revokeAssetUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export async function deleteAsset(id: string): Promise<void> {
  if (hasOPFS()) {
    try {
      const dir = await opfsDir();
      await dir.removeEntry(id);
    } catch {
      /* already gone */
    }
    return;
  }
  await fallbackDelete(id);
}
