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
    // Íconos SVG propios (public/icons/): 'brand' = marca FinTrack (línea de
    // tendencia), 'wallet' = selector de cartera activa.
    const registry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    for (const name of ['brand', 'wallet']) {
      registry.addSvgIcon(
        name,
        sanitizer.bypassSecurityTrustResourceUrl(`icons/${name}.svg`),
      );
    }
  }
}
