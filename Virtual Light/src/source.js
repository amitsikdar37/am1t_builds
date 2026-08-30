/**
 * Frame source: webcam, a local video file, or a local still image.
 *
 * Everything downstream only cares about three things — a texture-uploadable
 * element, its intrinsic size, and whether a genuinely new frame has arrived
 * since the last upload. Still images report "new frame" exactly once.
 */

export class FrameSource {
  constructor() {
    this.el = null;
    this.stream = null;
    this.kind = 'none'; // 'camera' | 'video' | 'image'
    this.width = 0;
    this.height = 0;
    this._dirty = false;
    this._rvfcHandle = null;
    this._objectUrl = null;
  }

  get ready() {
    return this.width > 0 && this.height > 0;
  }

  get isLive() {
    return this.kind === 'camera' || this.kind === 'video';
  }

  /** True once per new decoded frame; clears the flag. */
  takeFrame() {
    if (!this._dirty) return false;
    this._dirty = false;
    return true;
  }

  markDirty() {
    this._dirty = true;
  }

  /**
   * The frame is displayed at canvas resolution, so asking for 720p on a
   * 1500-px-wide stage means bilinear upscaling and a visibly soft image. These
   * are `ideal`, so a camera that only does 720p simply gives us 720p rather
   * than being scaled up to fake 1080p.
   */
  async useCamera({ facingMode = 'user', width = 1920, height = 1080 } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not expose camera access (navigator.mediaDevices).');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode,
        width: { ideal: width },
        height: { ideal: height },
      },
    });
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.srcObject = stream;
    await video.play();
    await waitForMetadata(video);

    this._teardown();
    this.stream = stream;
    this.el = video;
    this.kind = 'camera';
    this.width = video.videoWidth;
    this.height = video.videoHeight;
    this._watchVideo(video);
    return this;
  }

  async useFile(file) {
    const url = URL.createObjectURL(file);
    try {
      if (file.type.startsWith('image/')) {
        const img = await loadImage(url);
        this._teardown();
        this._objectUrl = url;
        this.el = img;
        this.kind = 'image';
        this.width = img.naturalWidth;
        this.height = img.naturalHeight;
        this._dirty = true;
        return this;
      }

      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.loop = true;
      video.src = url;
      await video.play().catch(() => {});
      await waitForMetadata(video);

      this._teardown();
      this._objectUrl = url;
      this.el = video;
      this.kind = 'video';
      this.width = video.videoWidth;
      this.height = video.videoHeight;
      this._watchVideo(video);
      return this;
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }

  _watchVideo(video) {
    if (typeof video.requestVideoFrameCallback === 'function') {
      const tick = () => {
        this._dirty = true;
        if (this.el === video) this._rvfcHandle = video.requestVideoFrameCallback(tick);
      };
      this._rvfcHandle = video.requestVideoFrameCallback(tick);
    } else {
      // Safari <15.4 and friends: assume a new frame is always available.
      this._dirty = true;
      this._pollFallback = true;
    }
  }

  /** Older browsers with no requestVideoFrameCallback need a per-render poke. */
  pokeIfPolling() {
    if (this._pollFallback && this.el && !this.el.paused) this._dirty = true;
  }

  _teardown() {
    if (this._rvfcHandle != null && this.el?.cancelVideoFrameCallback) {
      this.el.cancelVideoFrameCallback(this._rvfcHandle);
    }
    this._rvfcHandle = null;
    this._pollFallback = false;
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.el?.tagName === 'VIDEO') {
      this.el.pause();
      this.el.srcObject = null;
      this.el.removeAttribute('src');
      this.el.load();
    }
    if (this._objectUrl) {
      URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = null;
    }
  }

  stop() {
    this._teardown();
    this.el = null;
    this.kind = 'none';
    this.width = this.height = 0;
    this._dirty = false;
  }
}

function waitForMetadata(video) {
  if (video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error('Could not decode that file as video.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', ok);
      video.removeEventListener('error', fail);
    };
    video.addEventListener('loadedmetadata', ok, { once: true });
    video.addEventListener('error', fail, { once: true });
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'sync';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode that file as an image.'));
    img.src = url;
  });
}
