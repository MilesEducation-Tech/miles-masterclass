import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { matShoppingCartRound } from '@ng-icons/material-icons/round';

@Component({
  selector: 'app-utils-icon-cluster',
  imports: [NgIcon],
  providers: [provideIcons({ lucideSearch, matShoppingCartRound })],
  templateUrl: './utils-icon-cluster.html',
  host: {
    class: 'block pointer-events-auto',
  },
})
export class UtilsIconCluster {
  readonly cartCount = input<number>(0);
  readonly showCart = input<boolean>(true);

  readonly cartClick = output<void>();
  readonly searchClick = output<void>();

  protected onCart(): void {
    this.cartClick.emit();
  }

  protected onSearch(): void {
    this.searchClick.emit();
  }
}
