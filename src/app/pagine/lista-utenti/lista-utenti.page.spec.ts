import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaUtentiPage } from './lista-utenti.page';

describe('ListaUtentiPage', () => {
  let component: ListaUtentiPage;
  let fixture: ComponentFixture<ListaUtentiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ListaUtentiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
