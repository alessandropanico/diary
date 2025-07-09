import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfiloAltriUtentiPage } from './profilo-altri-utenti.page';

describe('ProfiloAltriUtentiPage', () => {
  let component: ProfiloAltriUtentiPage;
  let fixture: ComponentFixture<ProfiloAltriUtentiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProfiloAltriUtentiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
