/**
 * Guest connection storage (SPEC §10.5).
 *
 * A small IndexedDB wrapper, no dependency, versioned so a future schema can
 * migrate in place. Rows are re-validated on read: storage is same-origin but
 * still not trusted, and a corrupted row must never crash the picker.
 */

import { guestConnectionSchema, type GuestConnection } from "#lib/schema/guest";

const DB_NAME = "jevil-guest";
const DB_VERSION = 1;
const STORE = "connections";

export const isGuestStoreAvailable = (): boolean => typeof indexedDB !== "undefined";

let database: Promise<IDBDatabase> | undefined;

/** Shown when the browser blocks IndexedDB (private mode, disabled storage). */
export const GUEST_STORAGE_UNAVAILABLE =
    "Guest connections need browser storage, which is not available here";

const openDatabase = (): Promise<IDBDatabase> => {
    if (!isGuestStoreAvailable()) return Promise.reject(new Error(GUEST_STORAGE_UNAVAILABLE));
    if (database) return database;

    const opened = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open storage"));
    }).catch((error: unknown) => {
        database = undefined;
        throw error;
    });

    database = opened;
    return opened;
};

const done = (transaction: IDBTransaction): Promise<void> =>
    new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Storage write failed"));
        transaction.onabort = () => reject(transaction.error ?? new Error("Storage write aborted"));
    });

const result = <T>(request: IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Storage read failed"));
    });

/** Newest first; drops rows that no longer match the schema. */
export const validGuestConnections = (rows: unknown[]): GuestConnection[] => {
    const connections: GuestConnection[] = [];
    for (const row of rows) {
        const parsed = guestConnectionSchema.safeParse(row);
        if (parsed.success) connections.push(parsed.data);
    }

    return connections.sort((left, right) => right.createdAt - left.createdAt);
};

export const listGuestConnections = async (): Promise<GuestConnection[]> => {
    if (!isGuestStoreAvailable()) return [];

    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readonly");
    const rows = await result(transaction.objectStore(STORE).getAll());

    return validGuestConnections(rows);
};

export const saveGuestConnection = async (connection: GuestConnection): Promise<void> => {
    const parsed = guestConnectionSchema.safeParse(connection);
    if (!parsed.success) throw new Error("That guest connection is not valid");

    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(parsed.data);
    await done(transaction);
};

export const deleteGuestConnection = async (id: string): Promise<void> => {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    await done(transaction);
};

export const clearGuestConnections = async (): Promise<void> => {
    if (!isGuestStoreAvailable()) return;

    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    await done(transaction);
};
