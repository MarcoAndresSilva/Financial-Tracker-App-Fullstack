import { Component } from '@angular/core';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [...MATERIAL_MODULES],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {}
