import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MailMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

// Envío de emails transaccionales vía la API HTTP de Brevo. Se usa HTTP y no SMTP
// porque los planes gratuitos de hosting (Render) bloquean los puertos SMTP de
// salida; con `fetch` nativo de Node no hace falta ninguna dependencia nueva.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private config: ConfigService) {}

  async send(message: MailMessage): Promise<void> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const fromEmail = this.config.get<string>('MAIL_FROM');

    // Sin credenciales (desarrollo local) el email no se envía: se escribe en el
    // log para poder seguir el flujo completo sin tener una cuenta de Brevo.
    if (!apiKey || !fromEmail) {
      this.logger.warn(
        `BREVO_API_KEY/MAIL_FROM no configurados — email NO enviado.\n` +
          `Para: ${message.to}\nAsunto: ${message.subject}\n${message.text}`,
      );
      return;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: fromEmail,
          name: this.config.get<string>('MAIL_FROM_NAME') ?? 'FinTrack',
        },
        to: [{ email: message.to, name: message.toName ?? message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Brevo respondió ${response.status}: ${detail}`);
    }
  }
}
