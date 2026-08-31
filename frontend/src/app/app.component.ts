// frontend/src/app/app.component.ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'frontend';

  constructor() {
    // Ícono SVG propio de billetera para el selector de wallet (public/icons/).
    const registry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    registry.addSvgIcon(
      'wallet',
      sanitizer.bypassSecurityTrustResourceUrl('icons/wallet.svg'),
    );
  }
}
