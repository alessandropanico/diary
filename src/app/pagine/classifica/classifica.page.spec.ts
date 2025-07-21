import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassificaPage } from './classifica.page';

describe('ClassificaPage', () => {
  let component: ClassificaPage;
  let fixture: ComponentFixture<ClassificaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ClassificaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
