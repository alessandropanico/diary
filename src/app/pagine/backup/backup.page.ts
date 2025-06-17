import { Component } from '@angular/core';
import { BackupService } from 'src/app/services/backup.service';

@Component({
  selector: 'app-backup',
  templateUrl: './backup.page.html',
  styleUrls: ['./backup.page.scss'],
  standalone: false,
})
export class BackupPage {

  constructor(private backupService: BackupService) {}

  exportBackup() {
    const backupData = this.backupService.getBackupData();
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      this.backupService.saveBackupData(data);

      alert('Backup importato con successo!');
      // Puoi aggiungere qui eventuali notifiche o refresh app/global state
    } catch (err) {
      alert('Errore durante l\'importazione: ' + err);
    }
  }
}
