import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FotocameraPage } from './fotocamera.page';

describe('FotocameraPage', () => {
  let component: FotocameraPage;
  let fixture: ComponentFixture<FotocameraPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FotocameraPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
