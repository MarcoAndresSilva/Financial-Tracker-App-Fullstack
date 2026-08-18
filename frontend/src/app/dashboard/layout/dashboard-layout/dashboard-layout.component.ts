import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../auth/services/auth.service';
import { WalletService } from '../../../wallet/services/wallet.service';
import { Wallet } from '../../../user/types/user.types';
import { CreateSharedWalletDialogComponent } from '../../../shared/components/create-shared-wallet-dialog/create-shared-wallet-dialog.component';

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
  private walletService = inject(WalletService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  isSidenavOpened = true;
  activeWallet$ = this.walletContext.activeWallet$;
  userWallets$ = this.walletContext.userWallets$;
  currentUser$ = this.walletContext.currentUser$;

  onSelectWallet(wallet: Wallet): void {
    this.walletContext.setActiveWallet(wallet);
  }

  createSharedWallet(): void {
    this.dialog
      .open(CreateSharedWalletDialogComponent, { width: '400px' })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.walletService.createSharedWallet(result).subscribe({
          next: () => {
            this.notification.success(
              `"${result.name}" fue creada y ${result.inviteEmail} ya es miembro.`,
              'Wallet compartida creada'
            );
            this.walletContext.loadUserWallets().subscribe();
          },
          error: (err) => {
            const message =
              err?.error?.message ?? 'No se pudo crear la wallet compartida.';
            this.notification.error(message);
          },
        });
      });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
