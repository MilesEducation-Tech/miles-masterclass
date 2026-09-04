import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification';

@Component({ selector: 'app-notification-host', template: '' })
class Host {}

describe('NotificationService', () => {
  afterEach(() => {
    document.querySelectorAll('app-toast').forEach((el) => el.remove());
  });

  it('renders a toast carrying the title and message', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    TestBed.inject(NotificationService).error('Save failed', 'Try again in a moment');
    await fixture.whenStable();
    fixture.detectChanges();

    const toast = document.querySelector('app-toast');
    expect(toast).toBeTruthy();
    expect(toast?.textContent).toContain('Save failed');
    expect(toast?.textContent).toContain('Try again in a moment');
  });
});
