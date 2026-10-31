import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';

/** Base for the dock's canvas panels: HiDPI sizing and redraw on resize. */
@Directive()
export abstract class CanvasPanel implements AfterViewInit, OnDestroy {
  @ViewChild('cv', { static: true }) cvRef!: ElementRef<HTMLCanvasElement>;
  protected readonly zone = inject(NgZone);
  private ro?: ResizeObserver;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.ro = new ResizeObserver(() => this.redraw());
    this.ro.observe(this.cvRef.nativeElement);
    this.redraw();
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  protected redraw(): void {
    if (!this.viewReady) return;
    this.zone.runOutsideAngular(() => {
      const c = this.cvRef.nativeElement;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (!w || !h) return;
      const r = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) {
        c.width = Math.round(w * r);
        c.height = Math.round(h * r);
      }
      const x = c.getContext('2d')!;
      x.setTransform(r, 0, 0, r, 0, 0);
      x.clearRect(0, 0, w, h);
      this.draw(x, w, h);
    });
  }

  protected abstract draw(x: CanvasRenderingContext2D, w: number, h: number): void;
}
