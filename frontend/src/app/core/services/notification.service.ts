import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertDialogComponent } from '../../shared/components/alert-dialog/alert-dialog.component';

/**
 * Avisos al usuario. Dos formas, según si el aviso merece bloquear la pantalla:
 *
 * - `success` / `error`: toast (MatSnackBar) arriba, bajo el toolbar, que se
 *   cierra solo. Arriba porque es donde está la vista al cambiar de pantalla
 *   (abajo pasaba desapercibido, sobre todo en mobile). Es lo
 *   que corresponde cuando el usuario acaba de hacer algo y la pantalla ya
 *   muestra el resultado: el aviso informa, no pide nada.
 * - `alert`: modal con "Aceptar". Solo para lo que pasó sin que el usuario lo
 *   provocara y se perdería si desapareciera solo (ej. sesión cerrada por
 *   inactividad mientras no estaba mirando).
 *
 * Las confirmaciones con decisión ("¿Eliminar…?") no pasan por acá: usan
 * ConfirmDialogComponent directamente.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, undefined, {
      duration: 4000,
      verticalPosition: 'top',
      panelClass: ['app-snack', 'app-snack-success'],
    });
  }

  // Más tiempo y botón para cerrar: un error se lee con más calma que un éxito.
  error(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 6000,
      verticalPosition: 'top',
      panelClass: ['app-snack', 'app-snack-error'],
    });
  }

  alert(
    message: string,
    title: string,
    type: 'success' | 'error' = 'error'
  ): MatDialogRef<AlertDialogComponent> {
    return this.dialog.open(AlertDialogComponent, {
      width: '350px',
      data: { type, title, message },
    });
  }
}
