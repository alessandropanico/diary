import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NotePageRoutingModule } from './note-routing.module';

import { NotePage } from './note.page';
import { NoteEditorComponent } from './components/note-editor/note-editor.component';
import { DragScrollDirective } from 'src/app/drag-scroll.directive';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NotePageRoutingModule
  ],
  declarations: [NotePage, NoteEditorComponent, DragScrollDirective ]
})
export class NotePageModule {}
