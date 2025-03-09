import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SvegliePage } from './sveglie.page';

describe('SvegliePage', () => {
  let component: SvegliePage;
  let fixture: ComponentFixture<SvegliePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SvegliePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
