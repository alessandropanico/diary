import { Component, OnInit } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Storage } from '@ionic/storage-angular';
import { AlarmPlugin } from 'src/app/plugin/alarm-plugin';
import { Alarm } from 'src/app/interfaces/alarm';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ViewChild, ElementRef } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { UserAlarmDataService } from 'src/app/services/user-alarm-data-service.service';

import { OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { UserDataService } from 'src/app/services/user-data.service';

@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  standalone: false
})
export class SvegliePage implements OnInit, OnDestroy  {
  alarmTime = '';
  alarmNote = '';
  alarms: any[] = [];
  weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  selectedDays: boolean[] = Array(7).fill(true);
  alarmInfo = false;
  editingAlarmIndex: number | null = null;

  ringingAudio: HTMLAudioElement | null = null;

  alarmSoundFile: File | null = null;
  selectedSoundFileName: string = '';
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  selectedSoundUrl: string | null = null;
  private currentUserId: string | null = null;

  private userStatusSubscription: Subscription | null = null;


  constructor(
    private storage: Storage,
    private alertController: AlertController,
    private userAlarmDataService: UserAlarmDataService,
    private userDataService: UserDataService // Inietta il servizio
  ) {
    // this.init();
  }


    ngOnDestroy() {
    if (this.userStatusSubscription) {
      this.userStatusSubscription.unsubscribe();
    }
  }


  //   async ngOnInit() {
  //   await this.storage.create();
  //   this.currentUserId = await this.storage.get('loggedInUserId');
  //   if (!this.currentUserId) {
  //     console.warn('ID utente non trovato nella SvegliePage. Le metriche delle sveglie non saranno inviate a Firebase.');
  //   }
  //   await this.loadAlarms();
  // }

    async ngOnInit() {
    await this.storage.create();

    // Sottoscrivi all'Observable per ricevere l'ID utente in tempo reale
    this.userStatusSubscription = this.userDataService.userStatus$.subscribe(userId => {
      this.currentUserId = userId;
      this.loadAlarms(); // Ricarica le sveglie per il nuovo utente
    });
  }

  onOverlayClick(event: MouseEvent) {
    this.closeInfo();
  }


  // async init() {
  //   await this.storage.create();
  //   await this.loadAlarms();
  // }

   async loadAlarms() {
    if (this.currentUserId) {
      const storageKey = `alarms_${this.currentUserId}`;
      const savedAlarms = await this.storage.get(storageKey);
      this.alarms = savedAlarms || [];
    } else {
      this.alarms = [];
      console.warn("Nessun utente loggato, le sveglie non sono state caricate.");
    }
  }


  isMobile(): boolean {
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  private async requestNotificationPermission(): Promise<boolean> {
    const status = await LocalNotifications.requestPermissions();
    if (status.display === 'granted') return true;

    if ('Notification' in window) {
      const browserPerm = await Notification.requestPermission();
      if (browserPerm === 'granted') return true;
    }

    alert("⚠️ Per favore abilita le notifiche per usare la sveglia.");
    return false;
  }


  async setAlarm() {
    if (!this.alarmTime) {
      alert('⚠️ Inserisci un orario.');
      return;
    }
    if (!this.selectedDays.some(v => v)) {
      alert('⚠️ Seleziona almeno un giorno.');
      return;
    }

    if (!(await this.requestNotificationPermission())) return;

    // Se hai selezionato un file audio, salvalo in IndexedDB
    if (this.alarmSoundFile) {
      try {
        await this.saveSound(this.alarmSoundFile);
      } catch (error) {
        console.warn('Errore salvataggio file audio:', error);
      }
    }


    const [hours, minutes] = this.alarmTime.split(':').map(Number);
    const now = new Date();
    const baseId = Date.now();
    const generatedIds: number[] = [];

    for (let i = 0; i < 7; i++) {
      if (!this.selectedDays[i]) continue;

      const id = baseId + i;
      generatedIds.push(id);

      const dayOffset = ((i + 1) - (now.getDay() || 7) + 7) % 7;
      const alarmDate = new Date(now);
      alarmDate.setDate(now.getDate() + dayOffset);
      alarmDate.setHours(hours, minutes, 0, 0);

      if (this.isMobile() && /android/i.test(navigator.userAgent)) {
        try {
          await AlarmPlugin.setAlarm({
            time: this.alarmTime,
            note: this.alarmNote || 'Sveglia!',
          });
        } catch (error) {
          console.warn('Errore sveglia nativa, uso notifiche locali', error);
          await this.scheduleNotification(id, alarmDate, this.alarmNote || 'Sveglia!', this.weekDays[i]);
        }
      } else {
        await this.scheduleNotification(id, alarmDate, this.alarmNote || 'Sveglia!', this.weekDays[i]);
      }
    }

    this.alarms.push({
      ids: generatedIds,
      time: this.alarmTime,
      note: this.alarmNote,
      days: this.weekDays.filter((_, i) => this.selectedDays[i]),
      active: true,
      soundFile: this.alarmSoundFile?.name || '',
    });

    await this.saveAlarms();
    await this.triggerAlarmDataUpdate();
    this.resetForm();
    this.alarmInfo = false;
  }


  async updateAlarm() {
    if (this.editingAlarmIndex === null || !this.alarmTime) {
      alert('⚠️ Seleziona un orario valido.');
      return;
    }

    if (!(await this.requestNotificationPermission())) return;

    const alarm = this.alarms[this.editingAlarmIndex];

    // Se hai cambiato o scelto un file audio, salvalo in IndexedDB
    if (this.alarmSoundFile) {
      try {
        await this.saveSound(this.alarmSoundFile);
      } catch (error) {
        console.warn('Errore salvataggio file audio:', error);
      }
    }


    if (alarm?.ids?.length) {
      await LocalNotifications.cancel({ notifications: alarm.ids.map((id: number) => ({ id })) });
    }

    const [hours, minutes] = this.alarmTime.split(':').map(Number);
    const now = new Date();
    const newIds: number[] = [];

    for (let i = 0; i < 7; i++) {
      if (!this.selectedDays[i]) continue;

      const newId = Date.now() + i;
      newIds.push(newId);

      const dayOffset = ((i + 1) - (now.getDay() || 7) + 7) % 7;
      const alarmDate = new Date(now);
      alarmDate.setDate(now.getDate() + dayOffset);
      alarmDate.setHours(hours, minutes, 0, 0);

      await this.scheduleNotification(newId, alarmDate, this.alarmNote || 'Sveglia!', this.weekDays[i]);
    }

    this.alarms[this.editingAlarmIndex] = {
      ids: newIds,
      time: this.alarmTime,
      note: this.alarmNote,
      days: this.weekDays.filter((_, i) => this.selectedDays[i]),
      active: true,
      soundFile: this.alarmSoundFile
        ? this.alarmSoundFile.name
        : this.selectedSoundFileName || '',
    };

    await this.saveAlarms();
    await this.triggerAlarmDataUpdate(); // **AGGIUNTO**
    this.closeInfo();
  }



  async toggleAlarm(alarm: any) {
    const shouldActivate = !alarm.active;

    if (!shouldActivate) {
      if (alarm.ids?.length) {
        await LocalNotifications.cancel({
          notifications: alarm.ids.map((id: number) => ({ id })),
        });
      } else {
        console.warn("⛔ Nessun ID da cancellare per questa sveglia");
      }
    } else {
      const granted = await this.requestNotificationPermission();
      if (!granted) return;

      const [hours, minutes] = alarm.time.split(':').map(Number);
      const now = new Date();
      const newIds: number[] = [];

      for (const day of alarm.days) {
        const dayIndex = this.weekDays.indexOf(day);
        if (dayIndex === -1) continue;

        const alarmDate = new Date(now);
        const dayOffset = ((dayIndex + 1) - (now.getDay() || 7) + 7) % 7;
        alarmDate.setDate(now.getDate() + dayOffset);
        alarmDate.setHours(hours, minutes, 0, 0);

        const newId = Date.now() + dayIndex;
        newIds.push(newId);

        await this.scheduleNotification(newId, alarmDate, alarm.note, day);
      }

      alarm.ids = newIds;
    }

    alarm.active = shouldActivate;
    await this.saveAlarms();
    await this.triggerAlarmDataUpdate(); // **AGGIUNTO**
  }


  async removeAlarm(index: number) {
    const alarm = this.alarms[index];
    if (alarm?.ids) {
      await LocalNotifications.cancel({
        notifications: alarm.ids.map((id: number) => ({ id })),
      });
    }
    this.alarms.splice(index, 1);
    await this.saveAlarms();
    await this.triggerAlarmDataUpdate(); // **AGGIUNTO**
  }

  private async scheduleNotification(id: number, date: Date, message: string, dayLabel: string) {
    // Se la data è già passata, sposta all settimana successiva
    if (date.getTime() <= Date.now()) {
      date.setDate(date.getDate() + 7);
    }

     const relevantAlarm = this.alarms.find(a => a.ids && a.ids.includes(id));
     const alarmNoteToDisplay = relevantAlarm ? relevantAlarm.note : (message || 'È ora di svegliarsi!');

    if (this.isMobile()) {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id,
            title: "⏰ Sveglia",
            body: alarmNoteToDisplay,
            schedule: { at: date },
            sound: 'assets/sound/lofiAlarm.mp3',
          }]
        });
      } catch (error) {
        console.error("Errore durante la programmazione notifica:", error);
      }
    } else {
      // Per desktop/browser fallback con setTimeout e audio
      const diff = date.getTime() - Date.now();
      if (diff <= 0) {
        this.startRinging(dayLabel, alarmNoteToDisplay);
      } else {
        setTimeout(() => this.startRinging(dayLabel, alarmNoteToDisplay), diff);
      }
    }
  }


  async startRinging(dayLabel: string, message: string) {
  const alarm = this.alarms.find(a => a.days.includes(dayLabel) && a.active);

  if (!alarm) {
    console.warn('⏹ Sveglia non attiva, non suono nulla.');
    return;
  }

  const fileName = alarm?.soundFile || 'lofiAlarm.mp3';

  this.playRingingAudio(fileName);

  // Crea l'overlay e il modale con gli stili inline originali
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  overlay.classList.add('ff7-alarm-overlay'); // Nuova classe per l'overlay, per override

  const modal = document.createElement('div');
  modal.style.background = '#222';
  modal.style.color = '#0ff';
  modal.style.padding = '20px';
  modal.style.borderRadius = '10px';
  modal.style.textAlign = 'start';
  modal.style.fontFamily = "'Courier New', Courier, monospace";
  modal.style.width = '300px';
  modal.classList.add('ff7-alarm-modal'); // Nuova classe per il modale, per override

  modal.innerHTML = `
    <h2 class="ff7-alarm-title">Sveglia!</h2>
    <h3 class="ff7-alarm-subtitle">${dayLabel}</h3>
    <p class="ff7-alarm-message">${message || 'È ora di svegliarsi!'}</p>
    <button class="ff7-alarm-button">Ferma</button>
  `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const btn = modal.querySelector('button');
    if (btn) {
      btn.style.background = '#3cf';
      btn.style.color = '#000';
      btn.style.fontWeight = 'bold';
      btn.style.border = 'none';
      btn.style.padding = '0.8rem 1.5rem';
      btn.style.borderRadius = '8px';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'background 0.2s';
      btn.style.fontFamily = "'Orbitron', sans-serif";

      btn.addEventListener('mouseenter', () => btn.style.background = '#60e0ff');
      btn.addEventListener('mouseleave', () => btn.style.background = '#3cf');

      btn.addEventListener('click', () => {
        this.stopRingingAudio();
        overlay.remove();
      });
    }
  }

  stopRingingAudio() {
    if (this.ringingAudio) {
      this.ringingAudio.pause();
      this.ringingAudio.currentTime = 0;
      this.ringingAudio = null;
    }
  }

  async loadSoundUrl(fileName: string): Promise<void> {
  if (!fileName) {
    this.selectedSoundUrl = null;
    return;
  }

  if (this.isMobile()) {
    const base64 = await this.getSoundFromFilesystem(fileName);
    this.selectedSoundUrl = base64;
  } else {
    const blob = await this.getSoundFromIndexedDB(fileName);
    if (blob) {
      this.selectedSoundUrl = URL.createObjectURL(blob);
    } else {
      this.selectedSoundUrl = null;
    }
  }
}


async openInfo(index: number | null = null) {
  if (index !== null) {
    const alarm = this.alarms[index];
    this.alarmTime = alarm.time;
    this.alarmNote = alarm.note;
    this.selectedDays = this.weekDays.map(d => alarm.days.includes(d));
    this.editingAlarmIndex = index;
    this.selectedSoundFileName = alarm.soundFile || '';
    this.alarmSoundFile = null; // reset

    if (this.selectedSoundFileName) {
      await this.loadSoundUrl(this.selectedSoundFileName);
    } else {
      this.selectedSoundUrl = null;
    }
  } else {
    this.resetForm();
    this.selectedSoundUrl = null;
  }
  this.alarmInfo = true;
}


  closeInfo() {
    this.alarmInfo = false;
    this.resetForm();
  }

   private async saveAlarms() {
    if (this.currentUserId) {
      const storageKey = `alarms_${this.currentUserId}`;
      await this.storage.set(storageKey, this.alarms);
    } else {
      console.warn("Tentativo di salvare le sveglie senza un utente loggato.");
    }
  }

  private resetForm() {
    this.alarmTime = '';
    this.alarmNote = '';
    this.selectedDays = Array(7).fill(true);
    this.editingAlarmIndex = null;
  }



  async playRingingAudio(fileName: string = 'lofiAlarm.mp3') {
    this.stopRingingAudio();

    if (fileName === 'lofiAlarm.mp3' || !fileName) {
      const filePath = `assets/sound/${fileName}`;
      this.ringingAudio = new Audio(filePath);
    } else {
      try {
        if (this.isMobile()) {
          const audioBase64 = await this.getSoundFromFilesystem(fileName);
          if (audioBase64) {
            this.ringingAudio = new Audio(audioBase64);
          } else {
            throw new Error('File non trovato, uso default');
          }
        } else {
          const blob = await this.getSoundFromIndexedDB(fileName);
          if (blob) {
            const url = URL.createObjectURL(blob);
            this.ringingAudio = new Audio(url);
          } else {
            throw new Error('File non trovato in IndexedDB');
          }
        }
      } catch (e) {
        console.warn("Errore caricamento suono, uso default:", e);
        this.ringingAudio = new Audio('assets/sound/lofiAlarm.mp3');
      }
    }

    if (this.ringingAudio) {
      this.ringingAudio.loop = true;
      this.ringingAudio.play().catch(err => console.warn("Audio bloccato o errore:", err));
    }
  }



onSoundFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    this.alarmSoundFile = input.files[0];
    this.selectedSoundFileName = this.alarmSoundFile.name;
    this.selectedSoundUrl = URL.createObjectURL(this.alarmSoundFile); // Crea l'URL per l'anteprima
  }
}


  private saveSoundToIndexedDB(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AlarmDB', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sounds')) {
          db.createObjectStore('sounds');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('sounds', 'readwrite');
        const store = tx.objectStore('sounds');
        store.put(file, file.name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private getSoundFromIndexedDB(name: string): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AlarmDB', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('sounds', 'readonly');
        const store = tx.objectStore('sounds');
        const getRequest = store.get(name);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => reject(getRequest.error);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async saveSound(file: File): Promise<void> {
    if (this.isMobile()) {
      await this.saveSoundToFilesystem(file);
    } else {
      await this.saveSoundToIndexedDB(file);
    }
  }

  private async saveSoundToFilesystem(file: File): Promise<void> {
    const base64 = await this.fileToBase64(file);
    await Filesystem.writeFile({
      path: `sounds/${file.name}`,
      data: base64,
      directory: Directory.Data,
    });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private async getSoundFromFilesystem(fileName: string): Promise<string | null> {
    try {
      const result = await Filesystem.readFile({
        path: `sounds/${fileName}`,
        directory: Directory.Data,
      });
      return `data:audio/mp3;base64,${result.data}`;
    } catch (e) {
      console.warn("File non trovato nel filesystem:", fileName);
      return null;
    }
  }


  clearSelectedSound() {
    this.selectedSoundFileName = '';
    this.alarmSoundFile = null;
    this.selectedSoundUrl = null; // <--- aggiunto

    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = ''; // svuota l'input file visivamente
    }
  }

  async confirmRemoveAlarm(index: number) {
  const alarm = this.alarms[index];
  const time = alarm?.time || '';

  const alert = await this.alertController.create({
    header: 'Conferma eliminazione',
    message: `Sei sicuro di voler eliminare la sveglia impostata per le ${time}?`,
    buttons: [
      {
        text: 'Annulla',
        role: 'cancel'
      },
      {
        text: 'Elimina',
        handler: async () => {
          try {
            if (alarm?.ids) {
              await LocalNotifications.cancel({
                notifications: alarm.ids.map((id: number) => ({ id })),
              });
            }
            this.alarms.splice(index, 1);
            await this.saveAlarms();
            await this.triggerAlarmDataUpdate(); // **AGGIUNTO**
          } catch (error) {
            console.error("Errore durante l'eliminazione della sveglia:", error);
            const errorAlert = await this.alertController.create({
              header: 'Errore',
              message: 'Impossibile eliminare la sveglia. Riprova.',
              buttons: ['OK'],
            });
            await errorAlert.present();
          }
        }
      }
    ]
  });

  await alert.present();
}

   private async triggerAlarmDataUpdate() {
    if (this.currentUserId) {
      const activeCount = this.alarms.filter(alarm => alarm.active).length;
      const totalCreated = this.alarms.length;

      await this.userAlarmDataService.updateAlarmData(
        this.currentUserId,
        activeCount,
        totalCreated
      );
    } else {
      console.warn("Nessun utente loggato, impossibile aggiornare i dati delle sveglie su Firebase.");
    }
  }
}
