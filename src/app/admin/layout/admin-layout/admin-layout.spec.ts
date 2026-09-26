import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Viewport } from '@core/services/viewport/viewport';
import { AuditLog } from '@admin/core/services/audit-log';
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { AdminTopbar } from '../admin-topbar/admin-topbar';
import { AdminLayout } from './admin-layout';

@Component({ selector: 'app-admin-sidebar', template: '<a href="#">Leads</a>' })
class SidebarStub {
  readonly collapsed = input(false);
}

@Component({ selector: 'app-admin-topbar', template: '' })
class TopbarStub {
  readonly toggleSidebar = output<void>();
}

describe('AdminLayout mobile drawer', () => {
  let fixture: ComponentFixture<AdminLayout>;
  let el: HTMLElement;
  let opener: HTMLButtonElement;

  const drawer = () => el.querySelector<HTMLElement>('[role="dialog"]');
  const render = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
  };

  beforeEach(async () => {
    TestBed.overrideComponent(AdminLayout, {
      remove: { imports: [AdminSidebar, AdminTopbar] },
      add: { imports: [SidebarStub, TopbarStub] },
    });
    await TestBed.configureTestingModule({
      imports: [AdminLayout],
      providers: [
        provideRouter([]),
        { provide: Viewport, useValue: { isMobile: signal(true) } },
        { provide: AuditLog, useValue: { record: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminLayout);
    el = fixture.nativeElement;
    document.body.appendChild(el);
    opener = document.createElement('button');
    document.body.appendChild(opener);
    await render();
  });

  afterEach(() => {
    el.remove();
    opener.remove();
  });

  const open = async () => {
    opener.focus();
    fixture.componentInstance.toggleSidebar();
    await render();
  };

  it('opens a focus-trapped modal drawer and moves focus into it', async () => {
    await open();

    expect(drawer()?.getAttribute('aria-modal')).toBe('true');
    expect(drawer()?.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and hands focus back to the opener', async () => {
    await open();
    drawer()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await render();

    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('the toggle closes it too, also restoring focus', async () => {
    await open();
    fixture.componentInstance.toggleSidebar();
    await render();

    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
