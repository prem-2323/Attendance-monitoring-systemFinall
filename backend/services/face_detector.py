"""
Face Detection Service using OpenCV DNN with SSD MobileNet V1.
Falls back to Haar Cascade if model files are not found.
"""
import cv2
import numpy as np
import os
import logging

logger = logging.getLogger(__name__)

# Paths for SSD MobileNet V1 model files
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "ssd_mobilenet_v1")
PROTOTXT = os.path.join(MODEL_DIR, "deploy.prototxt")
CAFFEMODEL = os.path.join(MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

_net = None
_use_dnn = False


def _load_model():
    """Load SSD MobileNet V1 model once and cache it."""
    global _net, _use_dnn
    if _net is not None:
        return

    if os.path.exists(PROTOTXT) and os.path.exists(CAFFEMODEL):
        try:
            _net = cv2.dnn.readNetFromCaffe(PROTOTXT, CAFFEMODEL)
            _use_dnn = True
            logger.info("[FaceDetector] SSD MobileNet V1 model loaded.")
            return
        except Exception as e:
            logger.warning(f"[FaceDetector] Could not load DNN model: {e}")

    # Fallback: Haar Cascade (always available in OpenCV)
    logger.warning("[FaceDetector] Model files not found. Falling back to Haar Cascade.")
    _net = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    _use_dnn = False

_face_rec_available = False
try:
    import face_recognition as _fr_lib
    _face_rec_available = True
    logger.info("[FaceDetector] dlib face_recognition HOG detector available.")
except Exception as e:
    logger.warning(f"[FaceDetector] face_recognition not available: {e}")


def detect_faces(image_bgr: np.ndarray) -> list[dict]:
    """
    Detect faces in a BGR image.
    Prioritizes SSD MobileNet V1 DNN (high accuracy, deep learning face detection),
    with dlib and Haar Cascade fallbacks.

    Returns a list of dicts with keys:
        - box: (x, y, w, h)
        - confidence: float 0-1
    """
    if image_bgr is None or image_bgr.size == 0:
        return []

    _load_model()
    results = []

    # Method 1: SSD MobileNet V1 DNN (high accuracy, deep learning)
    if _use_dnn and _net is not None:
        try:
            h, w = image_bgr.shape[:2]
            # Standard OpenCV Caffe Face Detector mean is BGR: (104.0, 117.0, 123.0)
            blob = cv2.dnn.blobFromImage(
                cv2.resize(image_bgr, (300, 300)),
                scalefactor=1.0,
                size=(300, 300),
                mean=(104.0, 117.0, 123.0),
            )
            _net.setInput(blob)
            detections = _net.forward()

            for i in range(detections.shape[2]):
                confidence = float(detections[0, 0, i, 2])
                if confidence < 0.35:
                    continue
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x1, y1, x2, y2 = box.astype(int)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                if x2 > x1 and y2 > y1:
                    results.append({
                        "box": (x1, y1, x2 - x1, y2 - y1),
                        "confidence": round(confidence, 4),
                    })
            if results:
                return results
        except Exception as e:
            logger.warning(f"[FaceDetector] SSD MobileNet V1 forward error: {e}")

    # Method 2: dlib face detector fallback
    if _face_rec_available:
        try:
            rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
            locations = _fr_lib.face_locations(rgb, model="hog")
            if not locations and min(image_bgr.shape[:2]) < 400:
                # Upsample once if low-res frame
                locations = _fr_lib.face_locations(rgb, number_of_times_to_upsample=1, model="hog")
            for top, right, bottom, left in locations:
                results.append({
                    "box": (int(left), int(top), int(right - left), int(bottom - top)),
                    "confidence": 0.98,
                })
            if results:
                return results
        except Exception as e:
            logger.warning(f"[FaceDetector] dlib detection error: {e}")

    # Method 3: Multi-stage Haar Cascade fallback
    try:
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        
        # Stage A: standard grayscale with relaxed minSize
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(24, 24))
        
        # Stage B: try with CLAHE contrast enhancement if no faces found
        if len(faces) == 0:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            faces = cascade.detectMultiScale(enhanced, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))

        # Stage C: upscale small frame if webcam canvas is 320x240 or lower
        if len(faces) == 0 and max(image_bgr.shape[:2]) <= 360:
            up = cv2.resize(gray, (0, 0), fx=2.0, fy=2.0)
            up_faces = cascade.detectMultiScale(up, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
            faces = [(int(x/2), int(y/2), int(w/2), int(h/2)) for (x, y, w, h) in up_faces]

        for (x, y, w, h) in faces:
            results.append({"box": (int(x), int(y), int(w), int(h)), "confidence": 0.88})
    except Exception as e:
        logger.warning(f"[FaceDetector] Haar Cascade fallback error: {e}")

    return results


def decode_image(image_bytes: bytes) -> np.ndarray | None:
    """Decode raw bytes into a BGR numpy array."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.error(f"[FaceDetector] Image decode error: {e}")
        return None


def crop_face(image_bgr: np.ndarray, box: tuple, padding: float = 0.2) -> np.ndarray | None:
    """Crop the face region with optional padding."""
    x, y, w, h = box
    pad_x = int(w * padding)
    pad_y = int(h * padding)
    h_img, w_img = image_bgr.shape[:2]
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(w_img, x + w + pad_x)
    y2 = min(h_img, y + h + pad_y)
    crop = image_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    return crop


def extract_face_embedding_from_b64(raw_b64: str) -> tuple[list | None, str | None]:
    """
    Given a raw or data-url base64 image:
    1. Decodes image bytes.
    2. Detects human face via dlib HOG / Haar Cascade.
    3. Crops/aligns the detected face.
    4. Computes 128-d face embedding vector.
    Returns: (list_of_128_floats, clean_data_url) or (None, None)
    """
    if not raw_b64 or not raw_b64.strip():
        return None, None
    try:
        import base64
        cleaned = raw_b64.strip()
        payload_b64 = cleaned.split(",", 1)[1] if "," in cleaned else cleaned
        payload_b64 = payload_b64.replace(" ", "+")
        missing_pad = len(payload_b64) % 4
        if missing_pad:
            payload_b64 += "=" * (4 - missing_pad)

        img_bytes = base64.b64decode(payload_b64)
        if len(img_bytes) == 0:
            return None, None

        img = decode_image(img_bytes)
        if img is None:
            return None, None

        detections = detect_faces(img)
        from backend.services.face_landmark import align_face
        from backend.services import face_recognition as fr_service

        rgb_face = None
        if detections:
            best = max(detections, key=lambda d: d.get("confidence", 0.9))
            aligned = align_face(img, best["box"])
            if aligned is not None:
                rgb_face = aligned  # already in RGB format from align_face
            else:
                crop = crop_face(img, best["box"])
                if crop is not None and crop.size > 0:
                    rgb_face = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)

        if rgb_face is None:
            rgb_face = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        emb = fr_service.get_face_embedding(rgb_face)
        if emb is not None:
            data_url = cleaned if cleaned.startswith("data:image") else f"data:image/jpeg;base64,{payload_b64}"
            return emb.tolist(), data_url
        return None, None
    except Exception as e:
        logger.warning(f"[FaceDetector] Failed to extract embedding from base64: {e}")
        return None, None

