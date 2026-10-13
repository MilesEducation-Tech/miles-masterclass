import { Component } from '@angular/core';
import { PriceOverview } from '@features/payment/components/price-overview/price-overview';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-overview-wrapper',
  imports: [RouterOutlet, PriceOverview],
  templateUrl: './overview-wrapper.html',
})
export class OverviewWrapper {}
