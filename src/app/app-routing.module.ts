import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guard/auth.guard';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./pagine/home/home.module').then(m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'sveglie',
    loadChildren: () => import('./pagine/sveglie/sveglie.module').then(m => m.SvegliePageModule)
  },
  {
    path: 'list-task',
    loadChildren: () => import('./pagine/list-task/list-task.module').then(m => m.ListTaskPageModule)
  },
  {
    path: 'galleria',
    loadChildren: () => import('./pagine/galleria/galleria.module').then(m => m.GalleriaPageModule)
  },
  {
    path: 'note',
    loadChildren: () => import('./pagine/note/note.module').then(m => m.NotePageModule)
  },
  {
    path: 'riconoscimenti',
    loadChildren: () => import('./pagine/riconoscimenti/riconoscimenti.module').then(m => m.RiconoscimentiPageModule)
  },
  {
    path: 'backup',
    loadChildren: () => import('./pagine/backup/backup.module').then(m => m.BackupPageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./pagine/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'profilo',
    loadChildren: () => import('./pagine/profilo/profilo.module').then(m => m.ProfiloPageModule),
    canActivate: [AuthGuard]
  },
  {
    // *** MODIFICA QUI: Aggiungi /:id per il parametro ***
    path: 'profilo-altri-utenti/:id',
    loadChildren: () => import('./pagine/profilo-altri-utenti/profilo-altri-utenti.module').then(m => m.ProfiloAltriUtentiPageModule)
  },
  {
    // Questo percorso accetta l'ID della conversazione come parametro
    path: 'chat/:conversationId',
    loadChildren: () => import('./pagine/chat/chat.module').then(m => m.ChatPageModule),
    canActivate: [AuthGuard] // È fondamentale proteggere le chat
  },
  {
    path: 'chat-list',
    loadChildren: () => import('./pagine/chat-list/chat-list.module').then(m => m.ChatListPageModule),
    canActivate: [AuthGuard] // Proteggiamo la lista delle chat
  },
  {
    path: 'followers-list/:id', // Aggiungi questa rotta per la lista follower
    loadChildren: () => import('./pagine/followers-list/followers-list.module').then(m => m.FollowersListPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'following-list/:id', // Aggiungi questa rotta per la lista following
    loadChildren: () => import('./pagine/following-list/following-list.module').then(m => m.FollowingListPageModule),
    canActivate: [AuthGuard]
  },
 {
    path: 'followers-altro-list/:id', // :id è l'UID dell'utente target
    loadChildren: () => import('./pagine/followers-altro-list/followers-altro-list.module').then( m => m.FollowersAltroListPageModule)
  },
  {
    path: 'following-altro-list/:id', // :id è l'UID dell'utente target
    loadChildren: () => import('./pagine/following-altro-list/following-altro-list.module').then( m => m.FollowingAltroListPageModule)
  },
  {
    path: 'lista-utenti',
    loadChildren: () => import('./pagine/lista-utenti/lista-utenti.module').then( m => m.ListaUtentiPageModule)
  },
  {
    path: 'diario',
    loadChildren: () => import('./pagine/diario/diario.module').then( m => m.DiarioPageModule)
  },
  {
    path: 'classifica',
    loadChildren: () => import('./pagine/classifica/classifica.module').then( m => m.ClassificaPageModule)
  },
  {
    path: 'chat-gruppo',
    loadChildren: () => import('./pagine/chat-gruppo/chat-gruppo.module').then( m => m.ChatGruppoPageModule)
  },
  {
    path: 'progetti',
    loadChildren: () => import('./pagine/progetti/progetti.module').then( m => m.ProgettiPageModule)
  },
   {
    // ⭐ Rotta per il dettaglio del progetto, ora con il percorso corretto ⭐
    path: 'progetti/:id',
    loadChildren: () => import('./pagine/progetto-dettaglio/progetto-dettaglio.module').then(m => m.ProgettoDettaglioPageModule)
  },
  {
    path: 'notizie',
    loadChildren: () => import('./pagine/notizie/notizie.module').then( m => m.NotiziePageModule)
  },
  {
    path: 'notizia-singola',
    loadChildren: () => import('./pagine/notizia-singola/notizia-singola.module').then( m => m.NotiziaSingolaPageModule)
  }









];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
