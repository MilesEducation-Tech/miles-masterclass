// custom-dialog.service.ts
import {
  Service,
  ComponentRef,
  EnvironmentInjector,
  createComponent,
  ApplicationRef,
  inject,
  Type,
  PLATFORM_ID,
  Injector,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';

export interface DialogConfig {
  width?: string;
  height?: string;
  maxWidth?: string;
  minWidth?: string;
  panelClass?: string | string[];
  backdropClass?: string;
  hasBackdrop?: boolean;
  disableClose?: boolean;
  data?: unknown;
  enterAnimationDuration?: string;
  exitAnimationDuration?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  injector?: Injector;
  /**
   * Override the `EnvironmentInjector` used to construct the dialog
   * component. Required when the dialog needs to `inject()` a service that's
   * provided in a route or lazy module (e.g. `WebinarFacade`). Falls back to
   * the dialog service's root injector when omitted, which means
   * route-scoped providers are NOT visible — the inject call returns null.
   */
  environmentInjector?: EnvironmentInjector;
  /** When set to 'right', dialog slides in from the right as a drawer */
  position?: 'center' | 'right';
}

export class DialogRef<T = unknown, R = unknown> {
  private readonly afterClosedSubject = new Subject<R | undefined>();
  readonly afterClosed$ = this.afterClosedSubject.asObservable();
  private isClosing = false;

  constructor(
    private readonly overlayElement: HTMLElement,
    private readonly backdropElement: HTMLElement | null,
    private readonly componentRef: ComponentRef<T>,
    private readonly appRef: ApplicationRef,
    private readonly config: DialogConfig,
    private readonly escapeHandler: ((event: KeyboardEvent) => void) | null,
    private readonly dialogId: string,
  ) {}

  close(result?: R): void {
    if (this.isClosing) return;
    this.isClosing = true;

    const exitDuration = parseInt(this.config.exitAnimationDuration || '0ms');

    // Add exit animation classes
    this.overlayElement.classList.add('dialog-exit');
    this.backdropElement?.classList.add('backdrop-exit');

    // Remove escape key listener for this specific dialog
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }

    setTimeout(() => {
      this.appRef.detachView(this.componentRef.hostView);
      this.componentRef.destroy();

      // Safely remove elements
      if (this.overlayElement.parentNode) {
        document.body.removeChild(this.overlayElement);
      }
      if (this.backdropElement?.parentNode) {
        document.body.removeChild(this.backdropElement);
      }

      this.afterClosedSubject.next(result);
      this.afterClosedSubject.complete();
    }, exitDuration);
  }

  getDialogId(): string {
    return this.dialogId;
  }
}

@Service()
export class Dialog {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly platformId = inject(PLATFORM_ID);
  private dialogCounter = 0;
  private openDialogs = new Map<string, DialogRef<any, any>>();

  /** Subject that emits when a dialog is opened */
  private readonly afterOpenedSubject = new Subject<string>();

  /** Observable that emits the dialog ID when any dialog is opened */
  readonly afterOpened$ = this.afterOpenedSubject.asObservable();

  open<T, R = unknown>(component: Type<T>, config: DialogConfig = {}): DialogRef<T, R> {
    // SSR guard - dialogs should only open in browser
    if (!isPlatformBrowser(this.platformId)) {
      return this.createNoOpDialogRef<T, R>();
    }

    // Generate unique dialog ID
    const dialogId = `dialog-${++this.dialogCounter}`;
    const baseZIndex = 1000;
    const dialogZIndex = baseZIndex + this.dialogCounter * 2;
    const backdropZIndex = dialogZIndex - 1;

    // Default config
    const defaultConfig: DialogConfig = {
      width: 'auto',
      hasBackdrop: true,
      disableClose: false,
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      ariaLabel: 'Dialog',
      ...config,
    };

    let backdrop: HTMLElement | null = null;

    // Create backdrop
    if (defaultConfig.hasBackdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'custom-dialog-backdrop fixed inset-0 bg-black/60';
      backdrop.style.zIndex = backdropZIndex.toString();
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.setAttribute('data-dialog-id', dialogId);

      if (defaultConfig.backdropClass) {
        backdrop.className += ` ${defaultConfig.backdropClass}`;
      }

      backdrop.style.setProperty('--enter-duration', defaultConfig.enterAnimationDuration!);
      backdrop.style.setProperty('--exit-duration', defaultConfig.exitAnimationDuration!);

      document.body.appendChild(backdrop);
    }

    // Create dialog container
    const isDrawer = defaultConfig.position === 'right';
    const dialogContainer = document.createElement('div');
    dialogContainer.className = isDrawer
      ? 'custom-dialog-container fixed top-0 right-0 h-full bg-dialog text-dialog-foreground shadow-2xl overflow-auto dialog-drawer dialog-drawer-enter'
      : 'custom-dialog-container fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dialog text-dialog-foreground rounded-lg shadow-2xl max-h-[90vh] overflow-auto';
    dialogContainer.style.zIndex = dialogZIndex.toString();
    dialogContainer.setAttribute('role', 'dialog');
    dialogContainer.setAttribute('aria-modal', 'true');
    dialogContainer.setAttribute('data-dialog-id', dialogId);

    if (defaultConfig.ariaLabel) {
      dialogContainer.setAttribute('aria-label', defaultConfig.ariaLabel);
    }

    if (defaultConfig.ariaDescribedBy) {
      dialogContainer.setAttribute('aria-describedby', defaultConfig.ariaDescribedBy);
    }

    if (defaultConfig.panelClass) {
      const classes = Array.isArray(defaultConfig.panelClass)
        ? defaultConfig.panelClass
        : [defaultConfig.panelClass];
      dialogContainer.className += ` ${classes.join(' ')}`;
    }

    // Apply styles
    if (defaultConfig.width) dialogContainer.style.width = defaultConfig.width;
    if (defaultConfig.height) dialogContainer.style.height = defaultConfig.height;
    if (defaultConfig.maxWidth) dialogContainer.style.maxWidth = defaultConfig.maxWidth;
    if (defaultConfig.minWidth) dialogContainer.style.minWidth = defaultConfig.minWidth;

    dialogContainer.style.setProperty('--enter-duration', defaultConfig.enterAnimationDuration!);
    dialogContainer.style.setProperty('--exit-duration', defaultConfig.exitAnimationDuration!);

    document.body.appendChild(dialogContainer);

    // Create component. Prefer the caller-supplied `EnvironmentInjector` so
    // dialogs that need route-scoped providers (e.g. `WebinarFacade`) can
    // resolve them; otherwise fall back to the dialog service's root injector.
    const componentRef = createComponent(component, {
      environmentInjector: defaultConfig.environmentInjector ?? this.injector,
      elementInjector: defaultConfig.injector,
    });

    // Create escape handler specific to this dialog
    let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

    if (!defaultConfig.disableClose) {
      escapeHandler = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
          // Only close the topmost dialog
          const topDialog = this.getTopMostDialog();
          if (topDialog?.getDialogId() === dialogId) {
            topDialog.close();
          }
        }
      };
    }

    // Create DialogRef
    const dialogRef = new DialogRef<T, R>(
      dialogContainer,
      backdrop,
      componentRef,
      this.appRef,
      defaultConfig,
      escapeHandler,
      dialogId,
    );

    // Track this dialog
    this.openDialogs.set(dialogId, dialogRef);

    // Emit dialog opened event
    this.afterOpenedSubject.next(dialogId);

    // Clean up on close. `afterClosed$` completes after a single emission,
    // so `take(1)` makes the unsubscribe explicit and guards against any
    // future change to the subject's lifecycle.
    dialogRef.afterClosed$.pipe(take(1)).subscribe(() => {
      this.openDialogs.delete(dialogId);
    });

    // Inject DialogRef and data into component instance
    (componentRef.instance as any).dialogRef = dialogRef;
    if (defaultConfig.data !== undefined) {
      (componentRef.instance as any).data = defaultConfig.data;
    }

    // Attach component to dialog
    this.appRef.attachView(componentRef.hostView);
    dialogContainer.appendChild(componentRef.location.nativeElement);

    // Focus management - focus first focusable element
    setTimeout(() => {
      const focusableElements = dialogContainer.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }, 100);

    // Handle backdrop click - only for this specific backdrop
    if (!defaultConfig.disableClose && backdrop) {
      backdrop.addEventListener('click', () => {
        // Only close if clicking on the topmost dialog's backdrop
        const topDialog = this.getTopMostDialog();
        if (topDialog?.getDialogId() === dialogId) {
          dialogRef.close();
        }
      });
    }

    // Add escape key listener
    if (escapeHandler) {
      document.addEventListener('keydown', escapeHandler);
    }

    return dialogRef;
  }

  /**
   * Get the topmost (most recently opened) dialog
   */
  private getTopMostDialog(): DialogRef | undefined {
    if (this.openDialogs.size === 0) return undefined;
    const dialogs = Array.from(this.openDialogs.values());
    return dialogs[dialogs.length - 1];
  }

  /**
   * Close all open dialogs
   */
  closeAll(): void {
    this.openDialogs.forEach((dialog) => dialog.close());
  }

  /**
   * Get all currently open dialogs
   */
  getOpenDialogs(): DialogRef[] {
    return Array.from(this.openDialogs.values());
  }

  /**
   * Get the number of open dialogs
   */
  getOpenDialogCount(): number {
    return this.openDialogs.size;
  }

  /**
   * Create a no-op DialogRef for SSR compatibility.
   * Returns a dummy DialogRef that completes immediately.
   */
  private createNoOpDialogRef<T, R>(): DialogRef<T, R> {
    const noOpSubject = new Subject<R | undefined>();
    noOpSubject.complete();

    return {
      afterClosed$: noOpSubject.asObservable(),
      close: () => {
        // No-op: dialogs cannot be opened on the server, so close has nothing
        // to dispose. Kept as an explicit body to satisfy `no-empty-function`.
      },
      getDialogId: () => 'ssr-no-op',
    } as DialogRef<T, R>;
  }
}
