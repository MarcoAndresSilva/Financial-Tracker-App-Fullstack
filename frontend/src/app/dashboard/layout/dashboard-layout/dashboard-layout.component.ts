import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Wallet } from '../../../user/types/user.types';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, ...MATERIAL_MODULES],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent {
  private walletContext = inject(WalletContextService);
  private authService = inject(AuthService);
  private router = inject(Router);

  isSidenavOpened = true;
  activeWallet$ = this.walletContext.activeWallet$;
  userWallets$ = this.walletContext.userWallets$;

  onSelectWallet(wallet: Wallet): void {
    this.walletContext.setActiveWallet(wallet);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
