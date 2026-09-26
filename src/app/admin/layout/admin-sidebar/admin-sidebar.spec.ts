import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { AdminSidebar } from './admin-sidebar';

describe('AdminSidebar account menu', () => {
  let fixture: ComponentFixture<AdminSidebar>;
  let el: HTMLElement;
  let signOut: ReturnType<typeof vi.fn>;

  const trigger = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Jane Doe'),
    )!;
  const menu = () => el.querySelector('[role="menu"]');
  const item = (text: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((i) =>
      i.textContent?.includes(text),
    )!;

  /** The menu opens on a timer (show delay, then positioning), not synchronously. */
  const openMenu = async () => {
    trigger().click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    signOut = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [AdminSidebar],
      providers: [
        provideRouter([]),
        {
          provide: AdminAuth,
          useValue: {
            adminUser: signal({ full_name: 'Jane Doe', email: 'jane@miles.com' }),
            roles: signal([{ name: 'SEO Manager' }]),
            permissions: signal([]),
            hasAny: () => true,
            hasPermission: () => true,
            signOut,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminSidebar);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('opens a role=menu inside the account card, not in <body>', async () => {
    expect(menu()).toBeNull();
    await openMenu();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(menu()).not.toBeNull();
    // Inside the component, so the `.admin-theme` variables still apply.
    expect(el.contains(menu())).toBe(true);
    expect(menu()!.textContent).toContain('SEO Manager');
  });

  it('logs out from the menu', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await openMenu();

    item('Log out').click();
    await fixture.whenStable();

    expect(signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/admin/login');
  });
});
