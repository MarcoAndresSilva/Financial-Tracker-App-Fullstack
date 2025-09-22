import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Wallet } from '../../user/types/user.types';
import { UserService } from '../../user/services/user.service';

@Injectable({
  providedIn: 'root',
})
export class WalletContextService {
  private userService = inject(UserService);

  // El pizarrón mágico. Empieza vacío (null).
  private activeWalletSubject = new BehaviorSubject<Wallet | null>(null);
  // Cualquiera puede "mirar" el pizarrón a través de este Observable.
  public activeWallet$: Observable<Wallet | null> =
    this.activeWalletSubject.asObservable();

  private userWallets: Wallet[] = [];

  // Este método se llamará una sola vez, después del login.
  loadUserWallets() {
    return this.userService.getMe().pipe(
      tap((user) => {
        // Guardamos todas las carteras del usuario
        this.userWallets = user.memberships.map(
          (membership) => membership.wallet
        );

        // Si tiene carteras, ponemos la primera en el pizarrón como activa.
        if (this.userWallets.length > 0) {
          const defaultActiveWallet = this.userWallets[0];
          this.activeWalletSubject.next(defaultActiveWallet);
        }
      })
    );
  }

  // Método para obtener la cartera activa en un momento dado.
  getActiveWallet(): Wallet | null {
    return this.activeWalletSubject.getValue();
  }
}
