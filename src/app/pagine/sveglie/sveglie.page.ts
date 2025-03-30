import { Component } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Storage } from '@ionic/storage-angular';

@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  standalone: false,
})
export class SvegliePage {
  alarmTime: string = '';
  alarmNote: string = '';
  alarms: any[] = [];

  constructor(private storage: Storage) {
    this.storage.create();
    this.loadAlarms();
    this.requestNotificationPermission(); // Richiede permessi all'avvio
  }

  async loadAlarms() {
    const savedAlarms = await this.storage.get('alarms');
    this.alarms = savedAlarms || [];
    console.log("🔄 Allarmi caricati:", this.alarms);
  }

  async setAlarm() {
    if (!this.alarmTime) {
      alert('⚠️ Seleziona un orario per la sveglia');
      return;
    }

    const alarmTime = new Date();
    const [hours, minutes] = this.alarmTime.split(':').map(Number);
    alarmTime.setHours(hours, minutes, 0, 0);

    const alarmId = this.alarms.length + 1;

    console.log(`⏰ Impostando sveglia ID ${alarmId} per le ${this.alarmTime}`);

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: alarmId,
            title: "⏰ Sveglia",
            body: this.alarmNote || 'È ora di svegliarsi!',
            schedule: { at: alarmTime },
            sound: 'assets/sound/lofiAlarm.mp3',
          },
        ],
      });

      this.alarms.push({ id: alarmId, time: this.alarmTime, note: this.alarmNote, active: true });
      await this.storage.set('alarms', this.alarms);

      console.log("✅ Sveglia impostata con successo!");
    } catch (error) {
      console.error("❌ Errore nell'impostare la sveglia:", error);
    }

    this.alarmTime = '';
    this.alarmNote = '';
  }

  async removeAlarm(index: number) {
    const alarm = this.alarms[index];
    console.log(`🗑 Rimuovendo sveglia ID ${alarm.id}`);

    await LocalNotifications.cancel({ notifications: [{ id: alarm.id }] });

    this.alarms.splice(index, 1);
    await this.storage.set('alarms', this.alarms);
  }

  async toggleAlarm(alarm: any) {
    if (!alarm.active) {
      console.log(`⛔ Disattivando sveglia ID ${alarm.id}`);
      await LocalNotifications.cancel({ notifications: [{ id: alarm.id }] });
    } else {
      console.log(`✅ Riattivando sveglia ID ${alarm.id}`);
      const alarmTime = new Date();
      const [hours, minutes] = alarm.time.split(':').map(Number);
      alarmTime.setHours(hours, minutes, 0, 0);

      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: alarm.id,
              title: "⏰ Sveglia",
              body: alarm.note || 'È ora di svegliarsi!',
              schedule: { at: alarmTime },
              sound: 'assets/sound/lofiAlarm.mp3',
            },
          ],
        });
      } catch (error) {
        console.error("❌ Errore nell'attivare la sveglia:", error);
      }
    }
    await this.storage.set('alarms', this.alarms);
  }

  async testAlarm() {
    console.log("🔊 Avvio test sveglia...");

    try {
      // Emette un suono nel browser
      const audio = new Audio('assets/sound/lofiAlarm.mp3');
      audio.play();

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 9999, // ID speciale per il test
            title: "🔊 Test Sveglia",
            body: "Questa è una sveglia di prova!",
            schedule: { at: new Date(new Date().getTime() + 3000) }, // Suona in 3 secondi
            sound: 'assets/sound/lofiAlarm.mp3',
          },
        ],
      });
      console.log("✅ Notifica di test programmata con successo!");
    } catch (error) {
      console.error("❌ Errore durante il test della sveglia:", error);
    }
  }


  async setDefaultAlarm() {
    console.log("⏳ Impostando sveglia di default...");

    const defaultTime = new Date();
    defaultTime.setMinutes(defaultTime.getMinutes() + 1); // 1 minuto dopo l'avvio

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1,
            title: "⏰ Sveglia Automatica",
            body: "Questa è la sveglia di default",
            schedule: { at: defaultTime },
            sound: 'assets/sound/lofiAlarm.mp3',
          },
        ],
      });

      this.alarms.push({
        id: 1,
        time: `${defaultTime.getHours()}:${defaultTime.getMinutes()}`,
        note: "Sveglia di default",
        active: true,
      });

      await this.storage.set('alarms', this.alarms);
      console.log("✅ Sveglia di default impostata con successo!");
    } catch (error) {
      console.error("❌ Errore nell'impostare la sveglia di default:", error);
    }
  }

  async requestNotificationPermission() {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      alert("⚠️ Devi abilitare le notifiche per far funzionare la sveglia!");
    }
  }

  
  //--------------------------------------------------

  alarmInfo: boolean = false;



  closeInfo() {
    this.alarmInfo = false;
  }

  editingAlarmIndex: number | null = null;

  openInfo(alarmIndex: number | null = null) {
    if (alarmIndex !== null) {
      const alarm = this.alarms[alarmIndex];
      this.alarmTime = alarm.time;
      this.alarmNote = alarm.note;
      this.editingAlarmIndex = alarmIndex;
    } else {
      this.alarmTime = '';
      this.alarmNote = '';
      this.editingAlarmIndex = null;
    }
    this.alarmInfo = true;
  }

  async updateAlarm() {
    if (this.editingAlarmIndex === null || !this.alarmTime) {
      alert('⚠️ Seleziona un orario per aggiornare la sveglia');
      return;
    }

    const alarm = this.alarms[this.editingAlarmIndex];
    const [hours, minutes] = this.alarmTime.split(':').map(Number);
    const newAlarmTime = new Date();
    newAlarmTime.setHours(hours, minutes, 0, 0);

    console.log(`✏️ Modificando sveglia ID ${alarm.id} a ${this.alarmTime}`);

    try {
      // Cancella la vecchia notifica
      await LocalNotifications.cancel({ notifications: [{ id: alarm.id }] });

      // Programma la nuova notifica aggiornata
      await LocalNotifications.schedule({
        notifications: [
          {
            id: alarm.id,
            title: "⏰ Sveglia Aggiornata",
            body: this.alarmNote || 'È ora di svegliarsi!',
            schedule: { at: newAlarmTime },
            sound: 'assets/sound/lofiAlarm.mp3',
          },
        ],
      });

      // Aggiorna l'array delle sveglie
      this.alarms[this.editingAlarmIndex] = {
        id: alarm.id,
        time: this.alarmTime,
        note: this.alarmNote,
        active: true,
      };

      // Salva nel LocalStorage
      await this.storage.set('alarms', this.alarms);

      console.log("✅ Sveglia aggiornata con successo!");
    } catch (error) {
      console.error("❌ Errore nell'aggiornare la sveglia:", error);
    }

    this.closeInfo();
  }



}
