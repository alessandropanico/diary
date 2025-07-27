import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatGruppoPage } from './chat-gruppo.page';

describe('ChatGruppoPage', () => {
  let component: ChatGruppoPage;
  let fixture: ComponentFixture<ChatGruppoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatGruppoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
