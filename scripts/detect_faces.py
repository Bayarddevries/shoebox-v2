#!/usr/bin/env /usr/bin/python3
"""
Face detection for Shoebox archive photos.
Uses OpenCV 5 DNN face detector (YuNet) to detect faces and returns
normalized center coordinates (faceX, faceY) for each photo.

Usage:
    python detect_faces.py <photos_dir> [output_json]

Defaults:
    photos_dir  = ./public/assets/shoebox/photos
    output_json = ./public/assets/shoebox/face_coords.json

Output JSON format:
    {
        "filename.jpg": {"faceX": 0.52, "faceY": 0.41},
        "another photo.png": {"faceX": 0.48, "faceY": 0.55},
        ...
    }
"""

import sys
import os
import json

# Try OpenCV 5 DNN face detection (YuNet model) first, fall back to Haar
FACE_MODEL_URL = (
    "https://raw.githubusercontent.com/opencv/opencv_zoo/"
    "main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
)

def get_face_detector():
    """Load a face detector — tries DNN (YuNet), falls back to Haar Cascade."""
    import cv2

    # --- Try DNN YuNet (OpenCV 5+, no extra model download from GitHub) ---
    # Use a locally-cached model file if available
    model_cache = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               '..', '..', 'public', 'assets', 'shoebox',
                               'face_detection_yunet_2023mar.onnx')
    model_cache = os.path.normpath(model_cache)

    # Also check system cache
    system_cache = '/tmp/face_detection_yunet_2023mar.onnx'

    model_path = None
    for candidate in [model_cache, system_cache]:
        if os.path.exists(candidate) and os.path.getsize(candidate) > 1000:
            model_path = candidate
            break

    if model_path:
        try:
            detector = cv2.FaceDetectorYN_create(model_path, "", (320, 320))
            return detector, "yunet"
        except Exception:
            pass

    # --- Fallback: Haar Cascade (requires opencv-python package with data) ---
    cascade_path = os.path.join(
        os.path.dirname(cv2.__file__), 'data',
        'haarcascade_frontalface_default.xml'
    )
    if os.path.exists(cascade_path):
        try:
            cascade = cv2.CascadeClassifier(cascade_path)
            return cascade, "haar"
        except Exception:
            pass

    # --- Last resort: try to download YuNet on the fly ---
    try:
        import urllib.request
        model_path = system_cache
        if not os.path.exists(model_path) or os.path.getsize(model_path) < 1000:
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            urllib.request.urlretrieve(FACE_MODEL_URL, model_path)
        detector = cv2.FaceDetectorYN_create(model_path, "", (320, 320))
        return detector, "yunet"
    except Exception:
        pass

    return None, None


def detect_faces_yunet(detector, photo_path, input_size=(320, 320)):
    """Detect face using YuNet DNN detector."""
    import cv2
    img = cv2.imread(photo_path)
    if img is None:
        return None

    h, w = img.shape[:2]
    detector.setInputSize(input_size)
    _, faces = detector.detect(img)

    if faces is None or len(faces) == 0:
        return None

    # Use the face with highest confidence
    best = max(faces, key=lambda f: float(f[4]))
    # best[0:4] = x, y, w, h (relative to input_size, need to scale to image)
    fx, fy, fw, fh = best[0:4]

    # Scale back to actual image dimensions
    scale_x = w / input_size[0]
    scale_y = h / input_size[1]

    face_x = ((fx * scale_x) + (fw * scale_x) / 2) / w
    face_y = ((fy * scale_y) + (fh * scale_y) / 2) / h

    return {"faceX": round(face_x, 3), "faceY": round(face_y, 3)}


def detect_faces_haar(cascade, photo_path):
    """Detect face using Haar Cascade detector."""
    import cv2
    img = cv2.imread(photo_path)
    if img is None:
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(40, 40),
    )

    if len(faces) == 0:
        return None

    largest = max(faces, key=lambda f: f[2] * f[3])
    x, y, fw, fh = largest
    face_x = (x + fw / 2) / img.shape[1]
    face_y = (y + fh / 2) / img.shape[0]

    return {"faceX": round(face_x, 3), "faceY": round(face_y, 3)}


def detect_faces(photo_path, detector, mode):
    """Detect face in image and return normalized (faceX, faceY), or None."""
    if mode == "yunet":
        return detect_faces_yunet(detector, photo_path)
    else:
        return detect_faces_haar(detector, photo_path)


def main():
    photos_dir = sys.argv[1] if len(sys.argv) > 1 else './public/assets/shoebox/photos'
    output_file = sys.argv[2] if len(sys.argv) > 2 else './public/assets/shoebox/face_coords.json'

    if not os.path.isdir(photos_dir):
        print(f"Error: directory not found: {photos_dir}", file=sys.stderr)
        sys.exit(1)

    print("Loading face detector...")
    detector, mode = get_face_detector()
    if detector is None:
        print("Error: could not load any face detector", file=sys.stderr)
        sys.exit(1)
    print(f"Using {mode} detector")

    extensions = {'.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp'}
    files = sorted(f for f in os.listdir(photos_dir)
                   if os.path.splitext(f)[1].lower() in extensions)

    total = len(files)
    results = {}
    print(f"Detecting faces in {total} photos...")

    for i, filename in enumerate(files, 1):
        filepath = os.path.join(photos_dir, filename)
        if i % 50 == 0 or i == 1:
            print(f"  [{i}/{total}] {filename}...")

        try:
            result = detect_faces(filepath, detector, mode)
            if result:
                results[filename] = result
        except Exception as e:
            print(f"  Warning: {filename}: {e}", file=sys.stderr)

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\nDone. Face coordinates for {len(results)}/{total} photos.")
    print(f"Output: {output_file}")


if __name__ == '__main__':
    main()