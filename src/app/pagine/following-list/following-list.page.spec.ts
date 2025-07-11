import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FollowingListPage } from './following-list.page';

describe('FollowingListPage', () => {
  let component: FollowingListPage;
  let fixture: ComponentFixture<FollowingListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FollowingListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
