import { Injectable } from '@angular/core';

interface Photo {
  id: number;
  blob: Blob;
}

@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  private DB_NAME = 'PhotoDB';
  private STORE_NAME = 'photos';
  private db!: IDBDatabase;
  private dbReady: Promise<void>;

  constructor() {
    this.dbReady = this.initDB();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => {
        console.error('IndexedDB error:', event.target.errorCode);
        reject(event.target.errorCode);
      };
    });
  }

  async addPhoto(blob: Blob): Promise<void> {
    await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.add({ blob });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPhotos(): Promise<{ id: number; src: string }[]> {
    await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result.map((entry: any) => ({
          id: entry.id,
          src: URL.createObjectURL(entry.blob),
        }));
        resolve(result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deletePhoto(photoId: number): Promise<void> {
    await this.dbReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.delete(photoId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
