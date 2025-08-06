import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotiziePage } from './notizie.page';

describe('NotiziePage', () => {
  let component: NotiziePage;
  let fixture: ComponentFixture<NotiziePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(NotiziePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
