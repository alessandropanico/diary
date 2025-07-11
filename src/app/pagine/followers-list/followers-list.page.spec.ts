import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FollowersListPage } from './followers-list.page';

describe('FollowersListPage', () => {
  let component: FollowersListPage;
  let fixture: ComponentFixture<FollowersListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FollowersListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
