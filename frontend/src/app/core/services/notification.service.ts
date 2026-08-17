import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AlertDialogComponent } from '../../shared/components/alert-dialog/alert-dialog.component';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private dialog = inject(MatDialog);

  success(message: string, title = 'Listo'): MatDialogRef<AlertDialogComponent> {
    return this.dialog.open(AlertDialogComponent, {
      width: '350px',
      data: { type: 'success', title, message },
    });
  }

  error(message: string, title = 'Ups, algo salió mal'): MatDialogRef<AlertDialogComponent> {
    return this.dialog.open(AlertDialogComponent, {
      width: '350px',
      data: { type: 'error', title, message },
    });
  }
}
