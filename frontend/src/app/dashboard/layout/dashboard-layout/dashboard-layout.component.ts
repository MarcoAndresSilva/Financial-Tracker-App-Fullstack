import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenav } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  Subject,
  filter,
  fromEvent,
  map,
  merge,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  timer,
} from 'rxjs';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../auth/services/auth.service';
import { MyWallet, WalletService } from '../../../wallet/services/wallet.service';
import { Wallet } from '../../../user/types/user.types';
import { CreateSharedWalletDialogComponent } from '../../../shared/components/create-shared-wallet-dialog/create-shared-wallet-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

// Si no hay actividad del usuario en la app por este tiempo, se cierra la
// sesión sola — más corto que el vencimiento del JWT (60 min, Paso 3), para
// que un celular/compu compartido no quede con la sesión abierta al pedo.
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

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

  // Wallets con rol + cantidad de transacciones, solo para decidir en el
  // menú quién puede ver el botón de eliminar y con qué advertencia — el
  // resto de la app sigue usando `userWallets$` (más liviano).
  myWallets: MyWallet[] = [];

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
    this.watchInactivity();
    this.loadMyWallets();
  }

  private loadMyWallets(): void {
    this.walletService.getMyWallets().subscribe((wallets) => {
      this.myWallets = wallets;
    });
  }

  // Cualquiera de estos eventos reinicia el temporizador (switchMap cancela
  // el timer anterior); si pasan 5 minutos sin ninguno, se dispara el timer
  // y cerramos sesión sola.
  private watchInactivity(): void {
    const activity$ = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'click'),
      fromEvent(document, 'scroll'),
      fromEvent(document, 'touchstart')
    );

    activity$
      .pipe(
        startWith(0),
        switchMap(() => timer(INACTIVITY_TIMEOUT_MS)),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.notification.error(
          'Cerramos tu sesión porque estuvo inactiva por un buen rato.',
          'Sesión cerrada por inactividad'
        );
        this.logout();
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
            this.loadMyWallets();
          },
          error: (err) => {
            const message =
              err?.error?.message ?? 'No se pudo crear la wallet compartida.';
            this.notification.error(message);
          },
        });
      });
  }

  deleteWallet(wallet: MyWallet, event: Event): void {
    event.stopPropagation();

    const message =
      wallet.transactionCount > 0
        ? `"${wallet.name}" tiene ${wallet.transactionCount} transacción(es) registrada(s). Si la eliminas, se pierden junto con sus categorías. ¿Estás seguro?`
        : `¿Eliminar "${wallet.name}"? Esta acción no se puede deshacer.`;

    this.dialog
      .open(ConfirmDialogComponent, {
        width: '380px',
        data: { title: 'Eliminar wallet', message },
      })
      .afterClosed()
      .pipe(filter((result) => result === true))
      .subscribe(() => {
        this.walletService.deleteWallet(wallet.id).subscribe({
          next: () => {
            this.notification.success(`"${wallet.name}" fue eliminada.`);
            this.loadMyWallets();
            // loadUserWallets() ya reasigna la wallet activa a la primera de
            // la lista actualizada, así que no hace falta manejarlo a mano acá.
            this.walletContext.loadUserWallets().subscribe();
          },
          error: (err) => {
            const message =
              err?.error?.message ?? 'No se pudo eliminar la wallet.';
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
