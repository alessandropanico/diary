import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotiziaSingolaPage } from './notizia-singola.page';

describe('NotiziaSingolaPage', () => {
  let component: NotiziaSingolaPage;
  let fixture: ComponentFixture<NotiziaSingolaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(NotiziaSingolaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
