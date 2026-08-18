import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

export interface CategoryBar {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-category-bars',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './category-bars.component.html',
  styleUrls: ['./category-bars.component.scss'],
})
export class CategoryBarsComponent {
  @Input() title = '';
  @Input() bars: CategoryBar[] = [];
}
