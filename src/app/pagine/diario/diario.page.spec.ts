import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiarioPage } from './diario.page';

describe('DiarioPage', () => {
  let component: DiarioPage;
  let fixture: ComponentFixture<DiarioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DiarioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
