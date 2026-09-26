import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { environment } from '@env/environment';
import { NgOptimizedImage } from '@angular/common';

interface WaveConfig {
  timeModifier?: number;
  lineWidth?: number;
  amplitude?: number;
  wavelength?: number;
  segmentLength?: number;
  strokeStyle?: CanvasGradient | string;
}

@Component({
  selector: 'app-wave-canvas',
  imports: [NgOptimizedImage],
  templateUrl: './wave-canvas.html',
})
export class WaveCanvas {
  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('wavesCanvas');
  readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;

  private readonly destroyRef = inject(DestroyRef);

  private ctx!: CanvasRenderingContext2D;
  private animationId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private time = 0;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private waveWidth = 0;
  private waveLeft = 0;

  // Configuration
  private readonly speed = 8;
  private readonly amplitude = 50;
  private readonly wavelength = 50;
  private readonly segmentLength = 10;
  private readonly lineWidth = 2;
  private readonly strokeStyle = 'rgba(255, 255, 255, 0.2)';

  private readonly waves: WaveConfig[] = [
    {
      timeModifier: 1,
      lineWidth: 3,
      amplitude: 150,
      wavelength: 200,
      segmentLength: 20,
    },
    {
      timeModifier: 1,
      lineWidth: 2,
      amplitude: 150,
      wavelength: 100,
    },
    {
      timeModifier: 1,
      lineWidth: 1,
      amplitude: -150,
      wavelength: 50,
      segmentLength: 10,
    },
    {
      timeModifier: 1,
      lineWidth: 0.5,
      amplitude: -100,
      wavelength: 100,
      segmentLength: 10,
    },
  ];

  // Constants
  private readonly PI2 = Math.PI * 2;
  private readonly HALFPI = Math.PI / 2;

  constructor() {
    afterNextRender(() => {
      this.initializeCanvas();
      this.setupEventListeners();
      this.updateGradient();
      this.startAnimation();
    });

    this.destroyRef.onDestroy(() => {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      this.resizeObserver?.disconnect();
    });
  }

  private initializeCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    this.ctx = context;
    this.resizeCanvas();
  }

  private setupEventListeners(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }

    const parentElement = canvas.parentElement;
    if (parentElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(parentElement);
    }
  }

  private onResize = (): void => {
    this.resizeCanvas();
    this.updateGradient();
  };

  private resizeCanvas(): void {
    this.dpr = window.devicePixelRatio || 1;

    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }

    const parentElement = canvas.parentElement;
    if (!parentElement) {
      return;
    }

    const parentRect = parentElement.getBoundingClientRect();
    const parentWidth = parentRect.width;
    const parentHeight = parentRect.height;

    this.width = parentWidth * this.dpr;
    this.height = parentHeight * this.dpr;

    canvas.width = this.width;
    canvas.height = this.height;
    canvas.style.width = parentWidth + 'px';
    canvas.style.height = parentHeight + 'px';

    this.waveWidth = this.width * 0.95;
    this.waveLeft = this.width * 0.025;
  }

  private updateGradient(): void {
    if (!this.ctx) {
      return;
    }

    const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    this.waves.forEach((wave) => {
      wave.strokeStyle = gradient;
    });
  }

  private clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private update(time?: number): void {
    this.time = this.time - 0.007;
    if (typeof time === 'undefined') {
      time = this.time;
    }

    this.waves.forEach((wave) => {
      const timeModifier = wave.timeModifier || 1;
      this.drawSine(time! * timeModifier, wave);
    });
  }

  private ease(percent: number, amplitude: number): number {
    return amplitude * (Math.sin(percent * this.PI2 - this.HALFPI) + 1) * 0.5;
  }

  private drawSine(time: number, options: WaveConfig): void {
    const amplitude = options.amplitude || this.amplitude;
    const wavelength = options.wavelength || this.wavelength;
    const lineWidth = options.lineWidth || this.lineWidth;
    const strokeStyle = options.strokeStyle || this.strokeStyle;
    const segmentLength = options.segmentLength || this.segmentLength;

    // Center the waves
    const yAxis = this.height / 2;

    // Styles
    this.ctx.lineWidth = lineWidth * this.dpr;
    this.ctx.strokeStyle = strokeStyle;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();

    // Starting Line
    this.ctx.moveTo(0, yAxis);
    this.ctx.lineTo(this.waveLeft, yAxis);

    for (let i = 0; i < this.waveWidth; i += segmentLength) {
      const x = time * this.speed + (-yAxis + i) / wavelength;
      const y = Math.sin(x);

      // Easing
      const amp = this.ease(i / this.waveWidth, amplitude);

      this.ctx.lineTo(i + this.waveLeft, amp * y + yAxis);
    }

    // Ending Line
    this.ctx.lineTo(this.width, yAxis);

    // Stroke it
    this.ctx.stroke();
  }

  private loop = (): void => {
    this.clear();
    this.update();
    this.animationId = requestAnimationFrame(this.loop);
  };

  private startAnimation(): void {
    this.loop();
  }
}
