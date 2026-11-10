import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User, Wallet } from '../../user/types/user.types';
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
  private userWalletsSubject = new BehaviorSubject<Wallet[]>([]);
  public userWallets$: Observable<Wallet[]> =
    this.userWalletsSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> =
    this.currentUserSubject.asObservable();

  // Este método se llamará una sola vez, después del login.
  loadUserWallets() {
    return this.userService.getMe().pipe(
      tap((user) => {
        this.currentUserSubject.next(user);

        // Guardamos todas las carteras del usuario
        this.userWallets = user.memberships.map(
          (membership) => membership.wallet
        );
        this.userWalletsSubject.next(this.userWallets);

        // Wallet activa: la última elegida (guardada en localStorage) si
        // sigue en la lista; si no (se borró, o es otro usuario en este
        // navegador), la primera. Se toma de la lista recién traída para que
        // lleve los datos actualizados (ej. un nombre recién editado).
        if (this.userWallets.length > 0) {
          const storedId = this.readStoredWalletId();
          const activeWallet =
            this.userWallets.find((w) => w.id === storedId) ??
            this.userWallets[0];
          this.activeWalletSubject.next(activeWallet);
        }
      })
    );
  }

  // Actualiza datos del usuario ya cargado (ej. el nombre desde "Mi cuenta")
  // sin volver a pedir /users/me ni recargar las wallets.
  patchCurrentUser(changes: Partial<Pick<User, 'name' | 'email'>>): void {
    const user = this.currentUserSubject.getValue();
    if (user) this.currentUserSubject.next({ ...user, ...changes });
  }

  // Si ya se cargó el usuario en esta sesión de la app (login o recarga).
  isLoaded(): boolean {
    return this.currentUserSubject.getValue() !== null;
  }

  // Método para obtener la cartera activa en un momento dado.
  getActiveWallet(): Wallet | null {
    return this.activeWalletSubject.getValue();
  }

  // Permite cambiar manualmente la cartera activa (selector de wallet).
  // Se recuerda la elección para que una recarga (F5) no vuelva a la primera.
  setActiveWallet(wallet: Wallet): void {
    this.activeWalletSubject.next(wallet);
    try {
      localStorage.setItem(this.STORAGE_KEY, wallet.id);
    } catch {
      // Sin persistencia (modo privado, storage bloqueado) — no es crítico.
    }
  }

  private readonly STORAGE_KEY = 'active_wallet_id';

  private readStoredWalletId(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
