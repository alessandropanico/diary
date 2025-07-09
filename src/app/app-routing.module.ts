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
    loadChildren: () => import('./pagine/profilo-altri-utenti/profilo-altri-utenti.module').then( m => m.ProfiloAltriUtentiPageModule)
  }




];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
