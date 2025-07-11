import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FollowingAltroListPage } from './following-altro-list.page';

describe('FollowingAltroListPage', () => {
  let component: FollowingAltroListPage;
  let fixture: ComponentFixture<FollowingAltroListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FollowingAltroListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
