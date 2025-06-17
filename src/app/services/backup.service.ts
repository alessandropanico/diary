import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BackupService {

  private keysToBackup = [
    'notes',
    'playlists',
    'tasks',
    'photos',
    // aggiungi qui tutte le altre chiavi che usi in localStorage
  ];

  getBackupData(): any {
    const backupData: any = {};
    this.keysToBackup.forEach(key => {
      const data = localStorage.getItem(key);
      backupData[key] = data ? JSON.parse(data) : null;
    });
    return backupData;
  }

  saveBackupData(data: any) {
    this.keysToBackup.forEach(key => {
      if (data[key] !== undefined) {
        localStorage.setItem(key, JSON.stringify(data[key]));
      }
    });
  }
}
