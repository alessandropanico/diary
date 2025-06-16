import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RiconoscimentiPage } from './riconoscimenti.page';

describe('RiconoscimentiPage', () => {
  let component: RiconoscimentiPage;
  let fixture: ComponentFixture<RiconoscimentiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RiconoscimentiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
