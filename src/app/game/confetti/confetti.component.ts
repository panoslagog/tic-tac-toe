import { Component, ElementRef, OnInit, OnDestroy, viewChild } from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
}

@Component({
  selector: 'app-confetti',
  standalone: true,
  template: `<canvas #canvas class="confetti-canvas"></canvas>`,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 100;
    }
    .confetti-canvas {
      width: 100%;
      height: 100%;
    }
  `],
})
export class ConfettiComponent implements OnInit, OnDestroy {
  canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private startTime = 0;
  private readonly DURATION = 2500;
  private readonly COLORS = ['#22d3ee', '#fb7185', '#facc15', '#a78bfa', '#34d399'];

  ngOnInit() {
    const el = this.canvas().nativeElement;
    el.width = window.innerWidth;
    el.height = window.innerHeight;
    this.spawnParticles();
    this.startTime = performance.now();
    this.animate();
  }

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  private spawnParticles() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        life: 1,
      });
    }
  }

  private animate() {
    const elapsed = performance.now() - this.startTime;
    if (elapsed > this.DURATION) return;

    const ctx = this.canvas().nativeElement.getContext('2d')!;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.rotation += p.rotationSpeed;
      p.life = Math.max(0, 1 - elapsed / this.DURATION);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }
}
