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

    # Method 1: SSD MobileNet V1 DNN
    if _use_dnn and _net is not None:
        try:
            h, w = image_bgr.shape[:2]
            blob = cv2.dnn.blobFromImage(
                cv2.resize(image_bgr, (300, 300)),
                scalefactor=1.0,
                size=(300, 300),
                mean=(104.0, 177.0, 123.0),
            )
            _net.setInput(blob)
            detections = _net.forward()

            for i in range(detections.shape[2]):
                confidence = float(detections[0, 0, i, 2])
                if confidence < 0.5:
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
            for top, right, bottom, left in locations:
                results.append({
                    "box": (int(left), int(top), int(right - left), int(bottom - top)),
                    "confidence": 0.98,
                })
            if results:
                return results
        except Exception as e:
            logger.warning(f"[FaceDetector] dlib detection error: {e}")

    # Method 3: Haar Cascade fallback
    try:
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))
        for (x, y, w, h) in faces:
            results.append({"box": (int(x), int(y), int(w), int(h)), "confidence": 0.9})
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
        img_bytes = base64.b64decode(payload_b64)
        if len(img_bytes) == 0:
            return None, None

        img = decode_image(img_bytes)
        if img is None:
            return None, None

        detections = detect_faces(img)
        from backend.services.face_landmark import align_face
        from backend.services import face_recognition as fr_service

        face_crop = None
        if detections:
            best = max(detections, key=lambda d: d.get("confidence", 0.9))
            aligned = align_face(img, best["box"])
            face_crop = aligned if aligned is not None else crop_face(img, best["box"])

        if face_crop is None:
            face_crop = img

        if len(face_crop.shape) == 3 and face_crop.shape[2] == 3:
            rgb_face = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
        else:
            rgb_face = face_crop

        emb = fr_service.get_face_embedding(rgb_face)
        if emb is not None:
            data_url = cleaned if cleaned.startswith("data:image") else f"data:image/jpeg;base64,{payload_b64}"
            return emb.tolist(), data_url
        return None, None
    except Exception as e:
        logger.warning(f"[FaceDetector] Failed to extract embedding from base64: {e}")
        return None, None

