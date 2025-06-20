import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfiloPage } from './profilo.page';

describe('ProfiloPage', () => {
  let component: ProfiloPage;
  let fixture: ComponentFixture<ProfiloPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProfiloPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
