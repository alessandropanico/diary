// src/app/pagine/list-task/list-task.page.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';
import { ModalController, AlertController } from '@ionic/angular';
import { TaskModalComponent } from './components/task-modal/task-modal.component';
import { Subscription } from 'rxjs';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

@Component({
  selector: 'app-list-task',
  templateUrl: './list-task.page.html',
  styleUrls: ['./list-task.page.scss'],
  standalone: false,
})
export class ListTaskPage implements OnInit, OnDestroy {
  tasks: Task[] = [];
  isLoadingTasks = true;
  private tasksSubscription: Subscription | undefined;
  private authUnsubscribe: (() => void) | undefined; // Per disiscriversi dall'observable di autenticazione

  constructor(
    private taskService: TaskService,
    private modalCtrl: ModalController,
    private alertController: AlertController
  ) { }

async ngOnInit() {
    // Sottoscrivi alla stream di task dal servizio.
    // Questo aggiornerà `this.tasks` ogni volta che il BehaviorSubject nel servizio emette un nuovo valore.
    this.tasksSubscription = this.taskService.tasks$.subscribe(tasks => {
      // Se 'tasks' è null, significa che il caricamento iniziale da Firestore non è ancora completato
      // o che non c'è un utente autenticato e le task sono in uno stato iniziale non definito.
      if (tasks === null) {
        this.isLoadingTasks = true; // Mantieni il loading spinner attivo
        this.tasks = []; // Assicurati che l'array sia vuoto per non visualizzare dati obsoleti
        console.log('ListTaskPage: TaskService ha emesso NULL, mantenendo il loader...');
      } else {
        // Se 'tasks' non è null (è un Task[]), allora i dati sono stati caricati (anche se vuoti).
        this.tasks = tasks; // Aggiorna le task visualizzate
        this.isLoadingTasks = false; // Spegni il loading spinner
        console.log('ListTaskPage: Task aggiornate ricevute dal servizio.', this.tasks.length);
      }
    });

    // L'ascoltatore di onAuthStateChanged nel componente non è più strettamente necessario per
    // "caricare le task iniziali" perché il TaskService stesso si occupa di questo nel suo costruttore
    // quando rileva un utente autenticato.
    // Tuttavia, se hai una logica specifica da eseguire qui quando l'utente cambia stato, puoi mantenerla.
    // Per il caricamento delle task, il TaskService lo gestisce già internamente.
    // Se la rimuovi, assicurati che il TaskService gestisca anche il caso di utenti non autenticati
    // e l'emissione di [] o null al BehaviorSubject.
    // La logica attuale del TaskService è robusta, quindi questo blocco qui è ridondante per il solo caricamento.
    /*
    this.authUnsubscribe = onAuthStateChanged(getAuth(), async (user: User | null) => {
      if (user) {
        console.log('ListTaskPage: Utente autenticato, il TaskService dovrebbe già aver caricato le task.');
        // Non chiamare loadAndProcessTasks() direttamente qui, il servizio lo fa già.
        // Se lo chiami, rischi di fare doppie chiamate o di sovrascrivere lo stato.
      } else {
        console.log('ListTaskPage: Utente non autenticato, il TaskService ha svuotato le task.');
        // this.tasks = []; // Il BehaviorSubject del servizio dovrebbe già aver emesso [] o null
        // this.isLoadingTasks = false; // Gestito dalla sottoscrizione principale
      }
    });
    */
  }

  // Hook del ciclo di vita di Ionic: chiamato ogni volta che la pagina sta per diventare attiva.
  // Utile per ricaricare i dati se l'utente naviga avanti e indietro o se ci sono stati
  // cambiamenti esterni che il BehaviorSubject potrebbe non aver catturato (meno probabile con il tuo servizio).
  ionViewWillEnter() {
    // Se le task non sono ancora state caricate o se l'utente è loggato e non stiamo già caricando,
    // assicurati che loadAndProcessTasks venga chiamato.
    // Questo è un fallback, il `tasks$` subscription dovrebbe gestire la maggior parte degli aggiornamenti.
    if ((!this.tasks.length && !this.isLoadingTasks) && getAuth().currentUser) {
      console.log('ListTaskPage: ionViewWillEnter triggerato, ricarico/processo le task.');
      this.loadAndProcessTasks();
    }
  }

  ngOnDestroy() {
    // È cruciale disiscriversi per prevenire memory leaks.
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
      console.log('ListTaskPage: tasksSubscription unsubscription');
    }
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      console.log('ListTaskPage: authUnsubscribe unsubscription');
    }
  }

  /**
   * Carica le task dal servizio e aggiorna lo stato di completamento per quelle scadute.
   */
  private async loadAndProcessTasks() {
    this.isLoadingTasks = true; // Imposta lo stato di caricamento

    try {
      await this.taskService.loadTasks(); // Questo triggererà il `tasks$` subscription

      // La logica per marcare le task scadute viene applicata dopo il caricamento
      // delle task iniziali o di un ricaricamento completo.
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Esegui la logica solo sul set di task attuale
      const tasksToUpdate: Task[] = [];
      this.tasks.forEach(task => {
        if (task.id && !task.completed) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            tasksToUpdate.push(task);
          }
        }
      });

      // Aggiorna le task scadute. Ogni `toggleCompletion` aggiornerà il BehaviorSubject
      // e quindi la `this.tasks` verrà aggiornata automaticamente dalla sottoscrizione.
      for (const task of tasksToUpdate) {
        try {
          await this.taskService.toggleCompletion(task.id!, true);
        } catch (error) {
          console.error(`Errore durante il marcare la task "${task.name}" scaduta:`, error);
        }
      }

    } catch (error) {
      console.error('Errore nel caricamento o processamento delle task:', error);
      this.tasks = []; // Svuota le task in caso di errore grave
    } finally {
      // this.isLoadingTasks viene impostato a false dalla sottoscrizione a `tasks$`
      // una volta che i dati sono stati emessi.
    }
  }

  formatDateIT(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  async toggleCompletion(task: Task) {
    if (!task.id) {
      console.error('Impossibile aggiornare la task: ID non trovato.', task);
      return;
    }
    try {
      // Il servizio aggiornerà Firestore e poi emetterà il nuovo array di task,
      // che sarà catturato dalla sottoscrizione in ngOnInit.
      await this.taskService.toggleCompletion(task.id, !task.completed);
    } catch (error) {
      console.error('Errore durante il cambio stato della task:', error);
      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile aggiornare lo stato della task. Riprova.',
        buttons: ['OK'],
      });
      await errorAlert.present();
    }
  }

  async deleteTask(task: Task) {
    if (!task.id) {
      console.error('Impossibile eliminare la task: ID non trovato.', task);
      return;
    }

    const alert = await this.alertController.create({
      header: 'Conferma eliminazione',
      message: `Sei sicuro di voler eliminare la task "${task.name}"?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          handler: async () => {
            try {
              // Il servizio aggiornerà Firestore e poi emetterà il nuovo array di task.
              await this.taskService.deleteTask(task.id!);
            } catch (error) {
              console.error('Errore durante l\'eliminazione della task:', error);
              const errorAlert = await this.alertController.create({
                header: 'Errore',
                message: 'Impossibile eliminare la task. Riprova.',
                buttons: ['OK'],
              });
              await errorAlert.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async openTaskModal() {
    const modal = await this.modalCtrl.create({
      component: TaskModalComponent,
      cssClass: 'ff7-modal-glow'
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    // Se la modale ha indicato che una task è stata aggiunta/modificata,
    // il servizio `TaskService` avrà già aggiornato il suo `BehaviorSubject`.
    // Non è necessario chiamare `this.taskService.loadTasks()` qui,
    // perché la sottoscrizione in `ngOnInit` (di ListTaskPage e HomePage)
    // riceverà automaticamente l'aggiornamento.
    if (data && data.refreshTasks) {
      console.log('ListTaskPage: Modale chiusa con refreshTasks. Tasks aggiornate tramite BehaviorSubject.');
      // Non richiamare loadTasks() qui per evitare ridondanza/inefficienza.
      // La sottoscrizione in ngOnInit gestirà l'aggiornamento.
    }
  }
}
