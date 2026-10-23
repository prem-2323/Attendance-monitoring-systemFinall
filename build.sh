#!/usr/bin/env bash
set -euo pipefail

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# face-recognition declares "dlib" as a dependency. We install the pre-built
# dlib-bin wheel above, so install face-recognition without letting pip try to
# compile dlib from source.
python -m pip install "face-recognition==1.3.0" --no-deps

# Fail the Render build immediately if the face stack cannot import.
python -c "import cv2, dlib, face_recognition; print('Face stack OK:', cv2.__version__)"
