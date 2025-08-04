import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgettiPage } from './progetti.page';

describe('ProgettiPage', () => {
  let component: ProgettiPage;
  let fixture: ComponentFixture<ProgettiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgettiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
