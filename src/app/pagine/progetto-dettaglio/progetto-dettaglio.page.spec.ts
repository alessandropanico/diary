import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgettoDettaglioPage } from './progetto-dettaglio.page';

describe('ProgettoDettaglioPage', () => {
  let component: ProgettoDettaglioPage;
  let fixture: ComponentFixture<ProgettoDettaglioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgettoDettaglioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
