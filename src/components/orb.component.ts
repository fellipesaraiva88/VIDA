import { Component, ElementRef, ViewChild, AfterViewInit, input, effect, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-orb',
  standalone: true,
  template: `
    <div class="relative flex items-center justify-center w-64 h-64">
      <!-- Glow effects -->
      <div [class]="'absolute inset-0 rounded-full blur-3xl transition-opacity duration-500 ' + glowColorClass()"></div>
      
      <!-- Canvas for Audio Viz -->
      <canvas #canvas width="256" height="256" class="absolute inset-0 z-10 rounded-full opacity-80"></canvas>
      
      <!-- Core Orb -->
      <div [class]="'z-20 w-32 h-32 rounded-full shadow-inner border-2 transition-all duration-300 flex items-center justify-center ' + coreColorClass()">
        @if (mode() === 'listening') {
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        } @else if (mode() === 'speaking') {
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-white animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.536 8.464a5 5 0 000 7.072m-2.828-9.9a9 9 0 000 12.728M12 12h.01" />
          </svg>
        } @else if (mode() === 'processing') {
             <svg class="animate-spin w-12 h-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        } @else {
           <div class="w-4 h-4 bg-white rounded-full opacity-50"></div>
        }
      </div>
    </div>
  `
})
export class OrbComponent implements AfterViewInit {
  mode = input<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  frequencyData = input<Uint8Array>(new Uint8Array(0));

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number = 0;

  constructor() {
    effect(() => {
      const data = this.frequencyData();
      if (this.mode() === 'listening' && data.length > 0) {
        this.drawViz(data);
      } else if (this.mode() === 'idle') {
        this.clearCanvas();
      }
    });
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
  }

  glowColorClass() {
    switch (this.mode()) {
      case 'listening': return 'bg-cyan-500/30 opacity-100';
      case 'processing': return 'bg-purple-500/30 opacity-100';
      case 'speaking': return 'bg-emerald-500/30 opacity-100';
      default: return 'bg-slate-500/10 opacity-0';
    }
  }

  coreColorClass() {
    switch (this.mode()) {
      case 'listening': return 'bg-cyan-600 border-cyan-400';
      case 'processing': return 'bg-purple-600 border-purple-400';
      case 'speaking': return 'bg-emerald-600 border-emerald-400';
      default: return 'bg-slate-800 border-slate-700';
    }
  }

  private drawViz(data: Uint8Array) {
    if (!this.ctx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 64; // Match core size roughly

    ctx.clearRect(0, 0, width, height);

    // Circular visualizer
    ctx.beginPath();
    
    // Draw lighter ring
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)'; // Cyan
    ctx.lineWidth = 2;

    const barCount = 40;
    const step = (Math.PI * 2) / barCount;

    for (let i = 0; i < barCount; i++) {
        // Map frequency data to bars
        // Use lower frequencies for more movement
        const value = data[i % data.length] || 0;
        const barHeight = (value / 255) * 50; 
        
        const angle = i * step;
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }

  private clearCanvas() {
      if(this.ctx && this.canvasRef) {
          this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
      }
  }
}