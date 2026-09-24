import { InjectionToken, Service, Type, inject } from '@angular/core';
import { NgpToastManager, type NgpToastOptions } from 'ng-primitives/toast';
import {
  ToastContext,
  ToastOptions,
  ToastPosition,
  ToastType,
} from '../../models/notification.model';

/**
 * The component `NgpToastManager` instantiates for each toast.
 *
 * A token rather than a direct import because the toast lives in `shared/ui`
 * and this is a core singleton — core must not import shared (PROMPT.md §3).
 * `app.config.ts` binds it to `ToastComponent`; that file is the composition
 * root, which is the one place allowed to name both sides.
 */
export const TOAST_COMPONENT = new InjectionToken<Type<unknown>>('TOAST_COMPONENT');

/**
 * Thin facade over `NgpToastManager`.
 *
 * The `success` / `error` / `info` signatures are unchanged, so the ~145 call
 * sites across the app are untouched. What went away is everything underneath:
 * the toast list signal, the per-toast `setTimeout` bookkeeping and the
 * pause/resume-on-hover pair are all handled by the primitive now, as is the
 * positioned container that `NotificationComponent` used to render.
 */
@Service()
export class NotificationService {
  private readonly toastManager = inject(NgpToastManager);
  private readonly toastComponent = inject(TOAST_COMPONENT);

  /** This project's positions use left/right; the primitive uses start/end. */
  private static readonly PLACEMENTS: Record<
    ToastPosition,
    NonNullable<NgpToastOptions['placement']>
  > = {
    'top-left': 'top-start',
    'top-center': 'top-center',
    'top-right': 'top-end',
    'bottom-left': 'bottom-start',
    'bottom-center': 'bottom-center',
    'bottom-right': 'bottom-end',
  };

  show(title: string, message: string, type: ToastType, options?: ToastOptions): void {
    const closable = options?.closable ?? true;
    const duration = options?.duration ?? 3000;
    const context: ToastContext = { title, message, type, closable };

    this.toastManager.show(this.toastComponent, {
      placement: NotificationService.PLACEMENTS[options?.position ?? 'top-right'],
      duration,
      // A zero/negative duration used to mean "never auto-dismiss".
      persistent: duration <= 0,
      dismissible: closable,
      context,
    });
  }

  success(title: string, message: string, options?: ToastOptions): void {
    this.show(title, message, 'success', options);
  }

  error(title: string, message: string, options?: ToastOptions): void {
    this.show(title, message, 'error', options);
  }

  info(title: string, message: string, options?: ToastOptions): void {
    this.show(title, message, 'info', options);
  }
}
