export class ClipRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private lastBlobUrl: string | null = null;
  private isRecording = false;

  public startRecording(canvas: HTMLCanvasElement, audioStream: MediaStream | null) {
    this.stopRecording();
    this.recordedChunks = [];

    try {
      const canvasStream = canvas.captureStream(30); // 30 fps
      const combinedTracks = [...canvasStream.getVideoTracks()];

      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => {
          combinedTracks.push(track);
        });
      }

      const combinedStream = new MediaStream(combinedTracks);

      // Check supported MIME types
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: 3500000 // High quality 3.5 Mbps
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.recordedChunks.length > 0) {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'video/webm' });
          if (this.lastBlobUrl) {
            URL.revokeObjectURL(this.lastBlobUrl);
          }
          this.lastBlobUrl = URL.createObjectURL(blob);
          console.log('Sigma edit video recording complete! Blob size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (err) {
      console.warn('MediaRecorder error:', err);
    }
  }

  public stopRecording(): string | null {
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    return this.lastBlobUrl;
  }

  public getLastDownloadUrl(): string | null {
    return this.lastBlobUrl;
  }

  public downloadLastClip(filename = 'sigma_phonk_edit.webm') {
    if (!this.lastBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.lastBlobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export const clipRecorder = new ClipRecorder();
