import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { filter, finalize } from 'rxjs';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { UserService } from '../../../user/services/user.service';
import { AuthService } from '../../../auth/services/auth.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChangePasswordDialogComponent } from '../../../shared/components/change-password-dialog/change-password-dialog.component';

// Todo lo de la cuenta del usuario en un solo lugar: nombre, email y
// contraseña. Pide sus propios datos a /users/me en vez de depender del
// usuario cargado en WalletContextService, para funcionar también al entrar
// directo a la URL o tras recargar.
@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    ...MATERIAL_MODULES,
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private walletContext = inject(WalletContextService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);

  isLoading = true;
  email = '';

  // --- Datos personales ---
  savedName = '';
  isSavingName = false;
  nameForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
  });

  // --- Email ---
  showEmailForm = false;
  isSendingEmail = false;
  emailError: string | null = null;
  // Con valor: se mandó el link a ese email y falta confirmarlo.
  pendingEmail: string | null = null;
  emailForm: FormGroup = this.fb.group({
    newEmail: ['', [Validators.required, Validators.email]],
    currentPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.userService
      .getMe()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (user) => {
          this.email = user.email;
          this.savedName = user.name ?? '';
          this.nameForm.reset({ name: this.savedName });
        },
        error: () =>
          this.notification.error('No pudimos cargar los datos de tu cuenta.'),
      });
  }

  get nameChanged(): boolean {
    return this.nameForm.value.name?.trim() !== this.savedName;
  }

  saveName(): void {
    const name: string = this.nameForm.value.name?.trim() ?? '';
    if (this.nameForm.invalid || !name || !this.nameChanged) return;

    this.isSavingName = true;
    this.userService
      .updateProfile(name)
      .pipe(finalize(() => (this.isSavingName = false)))
      .subscribe({
        next: (user) => {
          this.savedName = user.name ?? '';
          this.nameForm.reset({ name: this.savedName });
          // El saludo del toolbar lee el usuario del contexto.
          this.walletContext.patchCurrentUser({ name: user.name });
          this.notification.success('Tu nombre se actualizó.');
        },
        error: () => this.notification.error('No pudimos guardar el nombre.'),
      });
  }

  openEmailForm(): void {
    this.showEmailForm = true;
    this.pendingEmail = null;
    this.emailError = null;
    this.emailForm.reset({ newEmail: '', currentPassword: '' });
  }

  cancelEmailForm(): void {
    this.showEmailForm = false;
    this.emailError = null;
  }

  requestEmailChange(): void {
    if (this.emailForm.invalid || this.isSendingEmail) return;
    const { newEmail, currentPassword } = this.emailForm.value;

    this.isSendingEmail = true;
    this.emailError = null;
    this.authService
      .requestEmailChange(newEmail.trim(), currentPassword)
      .pipe(finalize(() => (this.isSendingEmail = false)))
      .subscribe({
        next: ({ pendingEmail }) => {
          this.pendingEmail = pendingEmail;
          this.showEmailForm = false;
        },
        error: (err) => (this.emailError = this.emailErrorMessage(err)),
      });
  }

  openChangePassword(): void {
    this.dialog
      .open(ChangePasswordDialogComponent, { width: '400px' })
      .afterClosed()
      .pipe(filter((changed) => changed === true))
      .subscribe(() =>
        this.notification.success(
          'Tu contraseña se actualizó. Las sesiones en otros dispositivos se cerraron.',
          'Contraseña cambiada'
        )
      );
  }

  // Los mensajes del backend vienen en inglés y por código: se traducen acá.
  private emailErrorMessage(err: {
    status?: number;
    error?: { message?: string };
  }): string {
    const message = err?.error?.message ?? '';
    if (err?.status === 409) return 'Ese email ya lo usa otra cuenta.';
    if (err?.status === 503)
      return 'No pudimos enviar el email de confirmación. Inténtalo de nuevo en un rato.';
    if (message.includes('Current password'))
      return 'La contraseña actual no es correcta.';
    if (message.includes('different'))
      return 'Ese ya es el email de tu cuenta.';
    return 'No pudimos procesar el cambio. Revisa los datos e inténtalo de nuevo.';
  }
}
