import {
  ApplicationConfig,
  provideZoneChangeDetection,
  LOCALE_ID, isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEsCL from '@angular/common/locales/es-CL';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeEsCL);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-CL' },
    provideNativeDateAdapter(),
    { 
      provide: MAT_DATE_LOCALE, 
      useValue: 'es-CL' }, 
      provideServiceWorker('ngsw-worker.js', 
        {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
        }),
  ],
};
