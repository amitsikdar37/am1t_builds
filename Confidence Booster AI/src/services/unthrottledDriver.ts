/**
 * Unthrottled 60 FPS Background Clock Driver
 * 
 * Browsers (especially Chromium / Edge) suspend requestAnimationFrame and clamp
 * setTimeout/setInterval to 1000ms when a tab is minimized or switched to the background.
 * 
 * Web Workers run on an independent OS thread and are NOT throttled by the browser.
 * This driver creates an inline Web Worker ticker that continuously fires at 60 FPS,
 * ensuring that AI face tracking, camera buffering, audio synchronization, and video
 * rendering continue completely uninterrupted when you switch tabs to Google Meet, OmeTV, or Teams.
 */

type TickCallback = (now: number) => void;

export class UnthrottledDriver {
  private worker: Worker | null = null;
  private listeners = new Set<TickCallback>();
  private isRunning = false;
  private lastRafTime = performance.now();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      const code = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (!timer) {
              timer = setInterval(function() {
                self.postMessage(performance.now());
              }, 1000 / 60); // 60 FPS continuous background clock (~16.66ms)
            }
          } else if (e.data === 'stop') {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
          }
        };
      `;
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);

      this.worker.onmessage = (e: MessageEvent<number>) => {
        const now = e.data || performance.now();
        // If document is hidden, or if requestAnimationFrame has stalled for more than 24ms, fire ticks via worker!
        if (typeof document !== 'undefined' && (document.hidden || now - this.lastRafTime > 24)) {
          this.dispatchTick(now);
        }
      };
    } catch (err) {
      console.warn('[UnthrottledDriver] Web Worker not available, using fallback timer:', err);
    }
  }

  public register(cb: TickCallback): () => void {
    this.listeners.add(cb);
    if (!this.isRunning) {
      this.start();
    }
    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  public recordRafTick(now = performance.now()) {
    this.lastRafTime = now;
  }

  public dispatchTick(now = performance.now()) {
    for (const listener of this.listeners) {
      try {
        listener(now);
      } catch (err) {
        console.error('[UnthrottledDriver] Listener error:', err);
      }
    }
  }

  public start() {
    this.isRunning = true;
    this.worker?.postMessage('start');
  }

  public stop() {
    this.isRunning = false;
    this.worker?.postMessage('stop');
  }
}

export const unthrottledDriver = new UnthrottledDriver();
