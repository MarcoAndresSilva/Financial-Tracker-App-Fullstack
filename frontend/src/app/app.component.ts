// frontend/src/app/app.component.ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MATERIAL_MODULES } from './shared/material/material.module';
import { WalletContextService } from './core/services/wallet-context.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'frontend';
  private walletContext = inject(WalletContextService);

  constructor() {
    this.walletContext.activeWallet$.subscribe((wallet) => {
      console.log(
        '%c[APP COMPONENT] La cartera activa ha cambiado:',
        'color: #7c3aed; font-weight: bold;',
        wallet
      );
    });
  }
}
