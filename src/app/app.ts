import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  storage = inject(StorageService);

  readonly currentTime = signal<string>('');
  private timerInterval: any = null;

  ngOnInit() {
    this.updateClock();
    this.timerInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  updateClock() {
    const now = new Date();
    const formatted = now.toLocaleDateString('el-GR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) + ' | ' + now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    this.currentTime.set(formatted);
  }

  minimizeWindow() {
    window.electronAPI?.minimizeWindow?.();
  }

  maximizeWindow() {
    window.electronAPI?.maximizeWindow?.();
  }

  closeWindow() {
    window.electronAPI?.closeWindow?.();
  }
}
