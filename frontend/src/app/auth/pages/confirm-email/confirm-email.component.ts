import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';

type ConfirmState = 'ready' | 'done' | 'invalid' | 'taken';

// Destino del link del email de confirmación (/auth/confirm-email?token=...).
// Pide un clic en vez de confirmar al cargar: algunos servicios de correo abren
// los links por su cuenta para revisarlos, y aplicarían el cambio solos.
@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [CommonModule, RouterModule, ...MATERIAL_MODULES],
  templateUrl: './confirm-email.component.html',
  styleUrls: ['../login/login.component.scss', '../auth-status.scss'],
})
export class ConfirmEmailComponent {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);
  private walletContext = inject(WalletContextService);

  private token = this.route.snapshot.queryParamMap.get('token');

  state: ConfirmState = this.token ? 'ready' : 'invalid';
  isConfirming = false;
  newEmail = '';

  // Si el link se abre en el mismo navegador donde hay sesión, se ofrece
  // volver a la cuenta; si no, ir al login con el email nuevo.
  get hasSession(): boolean {
    try {
      return !!localStorage.getItem('access_token');
    } catch {
      return false;
    }
  }

  confirm(): void {
    if (!this.token || this.isConfirming) return;

    this.isConfirming = true;
    this.authService
      .confirmEmailChange(this.token)
      .pipe(finalize(() => (this.isConfirming = false)))
      .subscribe({
        next: ({ email }) => {
          this.newEmail = email;
          this.state = 'done';
          this.walletContext.patchCurrentUser({ email });
        },
        error: (err) => {
          if (err?.status === 400) this.state = 'invalid';
          else if (err?.status === 409) this.state = 'taken';
          else
            this.notification.error(
              'No pudimos confirmar el cambio. Inténtalo de nuevo en un rato.'
            );
        },
      });
  }
}
