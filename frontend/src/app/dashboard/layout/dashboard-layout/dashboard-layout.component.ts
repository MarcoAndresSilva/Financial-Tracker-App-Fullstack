import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenav } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject, map, shareReplay, takeUntil } from 'rxjs';
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
export class DashboardLayoutComponent implements OnDestroy {
  private walletContext = inject(WalletContextService);
  private authService = inject(AuthService);
  private walletService = inject(WalletService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);
  private destroy$ = new Subject<void>();

  activeWallet$ = this.walletContext.activeWallet$;
  userWallets$ = this.walletContext.userWallets$;
  currentUser$ = this.walletContext.currentUser$;

  // En mobile el sidenav es un overlay (mode="over"); en desktop es fijo
  // y siempre visible (mode="side"). Se usa con el pipe async para el modo,
  // que no tiene conflicto con el toggle manual del usuario.
  isMobile$ = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay(1)
  );

  // `isSidenavOpened` sí necesita ser una propiedad (no un observable ligado
  // directo al template) para no pisar el toggle manual del usuario en cada
  // ciclo de detección de cambios — solo se recalcula cuando cambia el breakpoint.
  isSidenavOpened = true;

  constructor() {
    this.isMobile$.pipe(takeUntil(this.destroy$)).subscribe((isMobile) => {
      this.isSidenavOpened = !isMobile;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSelectWallet(wallet: Wallet): void {
    this.walletContext.setActiveWallet(wallet);
  }

  // Al navegar desde el menú, lo cerramos si es un overlay de mobile
  // (en desktop, "side", no tiene sentido cerrarlo).
  onNavLinkClick(sidenav: MatSidenav): void {
    if (sidenav.mode === 'over') {
      sidenav.close();
    }
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
