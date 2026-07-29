"""
camera_stream.py
================
Multi-threaded zero-latency video ingestion engine and interactive multi-camera
selector grid UI.

Solves the input delay & buffering issues inherent in wireless streams like Link
to Windows / Phone Link by maintaining an async background thread that constantly
flushes stale video driver buffers and exposes only the freshest frame.
"""
import time
import threading
import cv2
import numpy as np
import config

class AsyncVideoCapture:
    """
    Background worker thread that constantly polls webcam frames.
    Removes the 3-5 frame queue buffering lag common in DirectShow and Wi-Fi streaming.
    """
    def __init__(self, camera_index: int, width: int = config.DEFAULT_CAPTURE_WIDTH, height: int = config.DEFAULT_CAPTURE_HEIGHT, fps: int = config.DEFAULT_CAPTURE_FPS):
        self.camera_index = camera_index
        # Use DirectShow on Windows for fast init; fallback to default if needed
        self.cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            self.cap = cv2.VideoCapture(camera_index)
            
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS,          fps)
        
        self.width  = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)  or width)
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or height)
        self.fps    = self.cap.get(cv2.CAP_PROP_FPS) or fps
        
        self.lock = threading.Lock()
        self.running = True
        self.latest_frame = None
        self.frame_count = 0
        
        # Start continuous reading thread
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()
        
        # Give thread 500ms to ingest initial frames
        time.sleep(0.4)

    def _worker_loop(self):
        while self.running and self.cap.isOpened():
            ret, frame = self.cap.read()
            if ret and frame is not None:
                with self.lock:
                    self.latest_frame = frame
                    self.frame_count += 1
            else:
                time.sleep(0.005)

    def read_latest(self) -> tuple[bool, np.ndarray]:
        """Return the absolute latest frame without blocking or queue lag."""
        with self.lock:
            if self.latest_frame is not None:
                return True, self.latest_frame.copy()
            return False, None

    def release(self):
        self.running = False
        if self.thread.is_alive():
            self.thread.join(timeout=1.0)
        self.cap.release()
        print(f"[CameraStream] Released webcam index {self.camera_index}.")


def select_camera_interactive(max_test_index: int = 4) -> int:
    """
    Scans system video feeds (0 to max_test_index) and presents an interactive
    grid window allowing the user to select their Link to Windows smartphone camera.
    Returns the selected camera index.
    """
    print("[CameraStream] Scanning for active video devices (including Phone Link)...")
    available_cameras = []
    temp_caps = {}

    for idx in range(max_test_index + 1):
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                h, w = frame.shape[:2]
                available_cameras.append(idx)
                temp_caps[idx] = cap
                print(f"  -> Found active camera at Index [{idx}]: {w}x{h}")
            else:
                cap.release()

    if not available_cameras:
        print("[CameraStream] WARNING: No active cameras found! Defaulting to Index 0.")
        return 0

    if len(available_cameras) == 1:
        chosen = available_cameras[0]
        print(f"[CameraStream] Only 1 camera found (Index {chosen}). Auto-selecting.")
        temp_caps[chosen].release()
        return chosen

    # Multiple cameras found: open visual selector grid UX!
    print("[CameraStream] Multiple video feeds found. Please select in window...")
    selected_idx_ptr = [0]  # pointer to list index in available_cameras
    window_name = "Desk Touchpad - Select Your Smartphone Camera Feed"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 1000, 600)

    # Mouse callback for direct clicking on tiles
    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            cols = len(available_cameras)
            tile_width = 1000 // cols if cols > 0 else 1000
            clicked_col = min(x // tile_width, cols - 1)
            selected_idx_ptr[0] = max(0, clicked_col)
            print(f"  -> Selected Camera Index [{available_cameras[selected_idx_ptr[0]]}] via mouse click.")
    
    cv2.setMouseCallback(window_name, on_mouse)

    while True:
        tiles = []
        for i, idx in enumerate(available_cameras):
            ret, frame = temp_caps[idx].read()
            if not ret or frame is None:
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, "No Signal", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
            else:
                frame = cv2.resize(frame, (640, 480))
            
            # Draw highlight border and label
            is_selected = (i == selected_idx_ptr[0])
            border_col = (40, 245, 110) if is_selected else (60, 60, 60)
            thickness = 8 if is_selected else 2
            cv2.rectangle(frame, (0, 0), (639, 479), border_col, thickness)
            
            # Label overlay
            cv2.rectangle(frame, (0, 0), (640, 60), (20, 20, 20), -1)
            status_txt = f"INDEX [{idx}] - {'[ SELECTED ]' if is_selected else 'Press ' + str(idx)}"
            txt_col = (40, 245, 110) if is_selected else (200, 200, 200)
            cv2.putText(frame, status_txt, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, txt_col, 2, cv2.LINE_AA)
            tiles.append(frame)

        # Horizontally stack thumbnails
        grid_img = np.hstack(tiles) if len(tiles) > 1 else tiles[0]
        
        # Instructions bar at bottom
        h, w = grid_img.shape[:2]
        bar = np.zeros((70, w, 3), dtype=np.uint8)
        bar[:] = (25, 25, 25)
        instr_text = "Click tile or Press Number [0-4] / TAB to switch | Press ENTER or SPACE to confirm selection"
        cv2.putText(bar, instr_text, (20, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 215, 0), 1, cv2.LINE_AA)
        full_display = np.vstack([grid_img, bar])

        cv2.imshow(window_name, full_display)
        key = cv2.waitKey(30) & 0xFF
        
        if key in (13, 32):  # ENTER or SPACE key
            break
        elif key == 9:       # TAB key cycles selection
            selected_idx_ptr[0] = (selected_idx_ptr[0] + 1) % len(available_cameras)
        elif ord('0') <= key <= ord('9'):
            val = key - ord('0')
            if val in available_cameras:
                selected_idx_ptr[0] = available_cameras.index(val)
        elif key == 27 or key == ord('q'):
            break

    cv2.destroyWindow(window_name)
    for cap in temp_caps.values():
        cap.release()
        
    chosen_cam = available_cameras[selected_idx_ptr[0]]
    print(f"[CameraStream] Confirmed Camera Index [{chosen_cam}]. Starting Zero-Latency Engine...")
    return chosen_cam
