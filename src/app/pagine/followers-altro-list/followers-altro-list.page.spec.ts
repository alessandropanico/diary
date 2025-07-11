import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FollowersAltroListPage } from './followers-altro-list.page';

describe('FollowersAltroListPage', () => {
  let component: FollowersAltroListPage;
  let fixture: ComponentFixture<FollowersAltroListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FollowersAltroListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
