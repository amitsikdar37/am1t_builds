export class CameraManager {
  private currentStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private facingMode: 'user' | 'environment' = 'user';
  private isMirrored = true;

  public async init(videoElement: HTMLVideoElement): Promise<MediaStream> {
    this.videoElement = videoElement;
    return this.startStream();
  }

  public async startStream(): Promise<MediaStream> {
    this.stopStream();

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: this.facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;

      // Force camera hardware to zoom all the way out (minimum zoom / widest FOV)
      const [track] = stream.getVideoTracks();
      if (track) {
        try {
          const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
          if (capabilities && capabilities.zoom && typeof capabilities.zoom.min === 'number') {
            await (track as any).applyConstraints({
              advanced: [{ zoom: capabilities.zoom.min }]
            });
          }
        } catch (e) {}
      }

      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
        await this.videoElement.play();
      }

      return stream;
    } catch (err) {
      console.warn('Initial camera constraints failed, attempting fallback constraints:', err);
      const fallbackConstraints: MediaStreamConstraints = {
        video: { facingMode: this.facingMode },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      this.currentStream = stream;

      const [track] = stream.getVideoTracks();
      if (track) {
        try {
          const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
          if (capabilities && capabilities.zoom && typeof capabilities.zoom.min === 'number') {
            await (track as any).applyConstraints({
              advanced: [{ zoom: capabilities.zoom.min }]
            });
          }
        } catch (e) {}
      }

      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
        await this.videoElement.play();
      }

      return stream;
    }
  }

  public async toggleFacingMode(): Promise<'user' | 'environment'> {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.isMirrored = this.facingMode === 'user';
    await this.startStream();
    return this.facingMode;
  }

  public getFacingMode(): 'user' | 'environment' {
    return this.facingMode;
  }

  public isFrontCamera(): boolean {
    return this.facingMode === 'user';
  }

  public toggleMirror(): boolean {
    this.isMirrored = !this.isMirrored;
    return this.isMirrored;
  }

  public getIsMirrored(): boolean {
    return this.isMirrored;
  }

  public getStream(): MediaStream | null {
    return this.currentStream;
  }

  public stopStream() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }
}

export const cameraManager = new CameraManager();
