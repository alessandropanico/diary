import { Component, OnInit, OnDestroy } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Task } from 'src/app/interfaces/task';
import { Subscription } from 'rxjs';
import { FrasiService } from 'src/app/services/frasi.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {

  greetingMessage: string = '';
  todayTasks: Task[] = [];
  isLoadingTasks: boolean = true;
  private tasksSubscription!: Subscription;
  dailyQuote: string = '';
  dailyAuthor: string = '';

  constructor(
    private taskService: TaskService,
    private frasiService: FrasiService,
  ) { }

  ngOnInit() {
    this.greetingMessage = this.getGreetingMessage();

    this.tasksSubscription = this.taskService.tasks$.subscribe(tasks => {
      if (tasks === null) {
        this.isLoadingTasks = true;
        this.todayTasks = [];
      } else {
        this.todayTasks = tasks.filter(task => this.isToday(task.dueDate) && !task.completed);
        this.isLoadingTasks = false;
      }
    });
    this.caricaFraseDelGiorno();
  }

  ngOnDestroy() {
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
  }

caricaFraseDelGiorno() {
    this.frasiService.getFrasi().subscribe((frasi) => {
      if (!frasi || frasi.length === 0) {
        console.warn('Nessuna frase disponibile nel JSON.');
        this.dailyQuote = 'Non ci sono frasi disponibili oggi.';
        this.dailyAuthor = '';
        return;
      }

      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);

      const key = 'lastQuoteIndex';
      const lastDateKey = 'lastQuoteDate';

      let lastDateString = localStorage.getItem(lastDateKey);
      let lastIndexString = localStorage.getItem(key);

      let lastDate: Date | null = null;
      if (lastDateString) {
        lastDate = new Date(lastDateString);
        lastDate.setHours(0, 0, 0, 0);
      }

      if (!lastDate || lastDate.getTime() !== oggi.getTime()) {
        let newIndex: number;
        do {
          newIndex = Math.floor(Math.random() * frasi.length);
        } while (newIndex.toString() === lastIndexString && frasi.length > 1);

        localStorage.setItem(key, newIndex.toString());
        localStorage.setItem(lastDateKey, oggi.toISOString());

        this.dailyQuote = frasi[newIndex].frase;
        this.dailyAuthor = frasi[newIndex].autore;
      } else {
        const index = lastIndexString ? parseInt(lastIndexString, 10) : 0;
        if (index >= 0 && index < frasi.length) {
          this.dailyQuote = frasi[index].frase;
          this.dailyAuthor = frasi[index].autore;
        } else {
          const newIndex = Math.floor(Math.random() * frasi.length);
          localStorage.setItem(key, newIndex.toString());
          localStorage.setItem(lastDateKey, oggi.toISOString());
          this.dailyQuote = frasi[newIndex].frase;
          this.dailyAuthor = frasi[newIndex].autore;
        }
      }
    });
  }


  getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  getGreetingMessage(): string {
    const currentHour = new Date().getHours();
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = now.toLocaleDateString('it-IT', options);

    if (currentHour < 12) {
      return `Buongiorno!`;
    } else if (currentHour < 18) {
      return `Buon pomeriggio!`;
    } else {
      return `Buona sera!`;
    }
  }

  isToday(dateString: string): boolean {
    const today = new Date();
    const taskDate = new Date(dateString);
    today.setHours(0, 0, 0, 0);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate.getTime() === today.getTime();
  }
}
