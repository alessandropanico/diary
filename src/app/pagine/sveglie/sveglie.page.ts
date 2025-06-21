import { Component } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Storage } from '@ionic/storage-angular';
import { AlarmPlugin } from 'src/app/plugin/alarm-plugin';

@Component({
  selector: 'app-sveglie',
  templateUrl: './sveglie.page.html',
  styleUrls: ['./sveglie.page.scss'],
  standalone: false
})
export class SvegliePage {
  alarmTime = '';
  alarmNote = '';
  alarms: any[] = [];
  weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  selectedDays: boolean[] = Array(7).fill(true);
  alarmInfo = false;
  editingAlarmIndex: number | null = null;

  ringingAudio: HTMLAudioElement | null = null; // AUDIO ATTIVO

  constructor(private storage: Storage) {
    this.init();
  }

  onOverlayClick(event: MouseEvent) {
    this.closeInfo();
  }


  async init() {
    await this.storage.create();
    await this.loadAlarms();
  }

  async loadAlarms() {
    const savedAlarms = await this.storage.get('alarms');
    this.alarms = savedAlarms || [];
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
          console.log('Sveglia nativa Android impostata');
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
    });

    await this.saveAlarms();
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
    };

    await this.saveAlarms();
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
  }

  private async scheduleNotification(id: number, date: Date, message: string, dayLabel: string) {
    // Se la data è già passata, sposta all settimana successiva
    if (date.getTime() <= Date.now()) {
      date.setDate(date.getDate() + 7);
    }

    if (this.isMobile()) {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id,
            title: "⏰ Sveglia",
            body: message || "È ora di svegliarsi!",
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
        this.startRinging(dayLabel, message);
      } else {
        setTimeout(() => this.startRinging(dayLabel, message), diff);
      }
    }
  }


  async startRinging(dayLabel: string, message: string) {
    this.playRingingAudio();

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

    const modal = document.createElement('div');
    modal.style.background = '#222';
    modal.style.color = '#0ff';
    modal.style.padding = '20px';
    modal.style.borderRadius = '10px';
    modal.style.textAlign = 'start';
    modal.style.fontFamily = "'Courier New', Courier, monospace";
    modal.style.width = '300px';

    modal.innerHTML = `
    <h2>⏰ Sveglia!</h2>
    <h3>${dayLabel}</h3>
    <p>${message || 'È ora di svegliarsi!'}</p>
    <button>Ferma</button>
  `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const btn = modal.querySelector('button');
    if (btn) {
      // Stili inline al bottone
      btn.style.background = '#3cf';
      btn.style.color = '#000';
      btn.style.fontWeight = 'bold';
      btn.style.border = 'none';
      btn.style.padding = '0.8rem 1.5rem';
      btn.style.borderRadius = '8px';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'background 0.2s';
      btn.style.fontFamily = "'Orbitron', sans-serif";

      // Effetto hover manuale via JS
      btn.addEventListener('mouseenter', () => btn.style.background = '#60e0ff');
      btn.addEventListener('mouseleave', () => btn.style.background = '#3cf');

      btn.addEventListener('click', () => {
        this.stopRingingAudio();
        overlay.remove();
      });
    }

    console.log('Modal mostrato');
  }






  stopRingingAudio() {
    if (this.ringingAudio) {
      this.ringingAudio.pause();
      this.ringingAudio.currentTime = 0;
      this.ringingAudio = null;
    }
  }


  openInfo(index: number | null = null) {
    if (index !== null) {
      const alarm = this.alarms[index];
      this.alarmTime = alarm.time;
      this.alarmNote = alarm.note;
      this.selectedDays = this.weekDays.map(d => alarm.days.includes(d));
      this.editingAlarmIndex = index;
    } else {
      this.resetForm();
    }
    this.alarmInfo = true;
  }

  closeInfo() {
    this.alarmInfo = false;
    this.resetForm();
  }

  private async saveAlarms() {
    await this.storage.set('alarms', this.alarms);
  }

  private resetForm() {
    this.alarmTime = '';
    this.alarmNote = '';
    this.selectedDays = Array(7).fill(true);
    this.editingAlarmIndex = null;
  }



  playRingingAudio() {
    this.stopRingingAudio();

    this.ringingAudio = new Audio('assets/sound/lofiAlarm.mp3');
    this.ringingAudio.loop = true;
    this.ringingAudio.play().catch(err => {
      console.warn("Audio bloccato o errore:", err);
    });
  }



}
