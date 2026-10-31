import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, Layers, ChevronDown, Check } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';

export interface LayerItem {
  id: string;
  label: string;
  on: boolean;
}

/**
 * Top-right pill with the map layers as a checklist. Replaces the view switcher, which had a
 * single option (decision 2026-10-31).
 */
@Component({
  selector: 'app-layers-menu',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      class="pill-btn"
      [attr.aria-expanded]="open()"
      aria-haspopup="true"
      [attr.aria-label]="i18n.t().layersLabel"
      (click)="open.set(!open())">
      <lucide-icon [img]="icons.Layers" [size]="15"></lucide-icon>
      <span>{{ i18n.t().layersLabel }}</span>
      <lucide-icon class="chev" [class.chev--up]="open()" [img]="icons.ChevronDown" [size]="13"></lucide-icon>
    </button>
    @if (open()) {
      <ul class="menu glass-panel" role="group" [attr.aria-label]="i18n.t().layersLabel">
        @for (l of items(); track l.id) {
          <li>
            <button type="button" class="item" role="menuitemcheckbox" [attr.aria-checked]="l.on" (click)="toggle.emit(l.id)">
              <span class="box" [class.box--on]="l.on">
                @if (l.on) {
                  <lucide-icon [img]="icons.Check" [size]="11"></lucide-icon>
                }
              </span>
              <span class="sw" [attr.data-layer]="l.id" aria-hidden="true"></span>
              {{ l.label }}
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host { position: relative; display: block; }
      .pill-btn {
        display: inline-flex; align-items: center; gap: 8px; width: 100%; height: 34px; padding: 0 12px;
        border: 0; border-radius: 999px; background: transparent; font: inherit; font-size: 13px; font-weight: 600;
        color: var(--color-text-bright); cursor: pointer;
      }
      .pill-btn:hover { background: var(--color-btn-hover); }
      .pill-btn span { flex: 1; text-align: left; }
      .chev { transition: transform 0.15s; display: inline-flex; }
      .chev--up { transform: rotate(180deg); }
      .menu {
        position: absolute; top: calc(100% + 10px); right: -4px; z-index: 40; min-width: 220px;
        margin: 0; padding: 6px; list-style: none; border-radius: 12px;
        background: var(--color-panel-bg-heavy);
      }
      .item {
        display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 10px; border: 0; border-radius: 8px;
        background: transparent; font: inherit; font-size: 12.5px; color: var(--color-text-main); text-align: left; cursor: pointer;
      }
      .item:hover, .item:focus-visible { background: var(--color-btn-hover); outline: none; }
      .box {
        display: inline-grid; place-items: center; width: 16px; height: 16px; flex: none; border-radius: 4px;
        border: 1.5px solid var(--color-line-strong); color: #fff;
      }
      .box--on { background: var(--color-text-bright); border-color: var(--color-text-bright); }
      .sw { width: 12px; height: 10px; flex: none; border-radius: 3px; }
      .sw[data-layer='ice'] { background: #eef3f8; border: 1px solid var(--color-paleo-ice-edge); }
      .sw[data-layer='band'] { background: var(--color-paleo-ice-band); border: 1px dashed var(--color-paleo-ice-edge); }
      .sw[data-layer='today'] { height: 0; border-top: 2px solid var(--color-neutral-600); border-radius: 0; }
      .sw[data-layer='prev'] { height: 0; border-top: 2px solid var(--color-accent); border-radius: 0; }
      .sw[data-layer='sills'] { width: 8px; height: 8px; margin: 0 2px; transform: rotate(45deg); background: var(--color-accent); }
      .sw[data-layer='transect'] { height: 0; border-top: 2px dashed var(--color-text-bright); border-radius: 0; }
      .sw[data-layer='labels'] { visibility: hidden; }
    `
  ]
})
export class LayersMenuComponent {
  readonly items = input.required<LayerItem[]>();
  readonly toggle = output<string>();
  readonly i18n = inject(I18nService);
  readonly open = signal(false);
  readonly icons = { Layers, ChevronDown, Check };
  private readonly host = inject(ElementRef<HTMLElement>);

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
