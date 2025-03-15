import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GalleriaPage } from './galleria.page';

describe('GalleriaPage', () => {
  let component: GalleriaPage;
  let fixture: ComponentFixture<GalleriaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GalleriaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
