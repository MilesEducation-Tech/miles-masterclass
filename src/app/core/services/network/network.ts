import { Service, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NotificationService } from '../notification/notification';
/**
 * Interface for the Network Information API.
 * This is experimental and not yet in standard TS lib.dom.d.ts
 */
interface NetworkInformation extends EventTarget {
  readonly effectualType: 'slow-2g' | '2g' | '3g' | '4g';
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  readonly downlink: number;
  readonly rtt: number;
  readonly saveData: boolean;
  onchange: EventListener | null;
  addEventListener(
    type: string,
    listener: EventListener | EventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListener | EventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

declare global {
  interface Navigator {
    readonly connection?: NetworkInformation;
    readonly mozConnection?: NetworkInformation;
    readonly webkitConnection?: NetworkInformation;
  }
}

export type ConnectionQuality = 'good' | 'poor' | 'offline';

@Service()
export class Network {
  private readonly notificationService = inject(NotificationService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly connectionQuality = signal<ConnectionQuality>('good');
  private lastQuality: ConnectionQuality = 'good';
  private hasShownRecovery = false;

  constructor() {
    this.initNetworkMonitoring();
  }

  private initNetworkMonitoring(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (connection) {
      // Use modern Network Information API
      this.handleConnectionChange(connection);
      connection.addEventListener('change', () => this.handleConnectionChange(connection));
    }

    // Also listen for offline/online events as a baseline
    window.addEventListener('offline', () => this.updateQuality('offline'));
    window.addEventListener('online', () => {
      // Re-check quality when back online
      if (connection) {
        this.handleConnectionChange(connection);
      }
    });
  }

  private handleConnectionChange(connection: NetworkInformation): void {
    // Prevent false 'good' detection when switching to offline (Chrome defaults effectiveType to 4g when offline)
    if (!navigator.onLine) {
      this.updateQuality('offline');
      return;
    }

    const type = connection.effectiveType;
    // 'slow-2g' | '2g' is considered poor (3g is now acceptable per user request)
    if (type === 'slow-2g' || type === '2g') {
      this.updateQuality('poor');
    } else {
      this.updateQuality('good');
    }
  }

  private updateQuality(newQuality: ConnectionQuality): void {
    // Debounce/Check logic to avoid spam
    if (this.lastQuality === newQuality) return;

    this.connectionQuality.set(newQuality);

    if (newQuality === 'poor') {
      this.notificationService.show(
        'Slow Network Detected',
        'You are on a slow connection (3G). Some features may load slowly.',
        'info',
        { duration: 5000 },
      );
      this.hasShownRecovery = false;
    } else if (
      newQuality === 'good' &&
      (this.lastQuality === 'poor' || this.lastQuality === 'offline')
    ) {
      if (!this.hasShownRecovery) {
        this.notificationService.success(
          'Network Restored',
          'Your connection speed has improved.',
          { duration: 3000 },
        );
        this.hasShownRecovery = true;
      }
    } else if (newQuality === 'offline') {
      this.notificationService.error(
        'No Internet Connection',
        'You are offline. Please check your internet connection.',
        { duration: 5000, closable: true }, // sticky
      );
      this.hasShownRecovery = false;
    }

    // When coming back from offline to poor, we might want to say connected but slow?
    // For now, simplify: Offline -> Poor = Show Slow Network.
    // Logic above handles it as lastQuality changes from offline -> poor.

    this.lastQuality = newQuality;
  }
}
