import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./pagine/home/home.module').then( m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'sveglie',
    loadChildren: () => import('./pagine/sveglie/sveglie.module').then( m => m.SvegliePageModule)
  },  {
    path: 'list-task',
    loadChildren: () => import('./pagine/list-task/list-task.module').then( m => m.ListTaskPageModule)
  },


];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
