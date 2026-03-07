# SmartFridge AI — model_inference.py
# ══════════════════════════════════════════════════════════════════
# This module wraps your trained ML model.
#
# HOW TO USE:
#   1. Place your trained model file in backend/model/
#      Supported formats:
#        - TensorFlow/Keras:  model.h5  or  saved_model/
#        - TFLite:            model.tflite
#        - PyTorch:           model.pt
#        - OpenCV DNN:        model.onnx
#
#   2. Uncomment the section that matches your model type.
#   3. Adjust class labels to match your training output.
#
# INPUT:  raw JPEG bytes from ESP32-CAM
# OUTPUT: { status, fresh_score, rotten_score, fruit, error? }
# ══════════════════════════════════════════════════════════════════

import io
import os

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'model')

# ── Class labels (order must match your training) ────────────────
# Two-class model: [fresh, rotten]
CLASS_LABELS = ['fresh', 'rotten']
# Four-class model example: ['apple_fresh','apple_rotten','banana_fresh','banana_rotten']
# If you use a multi-class model, override parse_result() below.

# ── Image preprocessing ──────────────────────────────────────────
IMG_SIZE = (224, 224)   # change to match your model's expected input


def predict_freshness(img_bytes: bytes, fruit: str = 'unknown') -> dict:
    """
    Run the freshness model on raw JPEG bytes.
    Returns:
      { 'status': 'fresh'|'rotten', 'fresh_score': float, 'rotten_score': float, 'fruit': str }
      or
      { 'error': str }
    """
    try:
        probs = _run_model(img_bytes)
        return _build_result(probs, fruit)
    except FileNotFoundError as e:
        return {'error': str(e)}
    except Exception as e:
        return {'error': f'Inference failed: {e}'}


# ═════════════════════════════════════════════════════════════
#  CHOOSE ONE MODEL BACKEND — uncomment the right block
# =============================================================

def _run_model(img_bytes: bytes) -> list:
    """Returns probability list matching CLASS_LABELS order."""

    # ── Option A: TensorFlow / Keras (.h5 or SavedModel) ──────
    # import numpy as np
    # import tensorflow as tf
    # from PIL import Image
    #
    # MODEL_PATH = os.path.join(MODEL_DIR, 'model.h5')
    # _model = tf.keras.models.load_model(MODEL_PATH)   # load once at module level in prod
    #
    # img = Image.open(io.BytesIO(img_bytes)).resize(IMG_SIZE).convert('RGB')
    # arr = np.array(img, dtype=np.float32) / 255.0
    # arr = np.expand_dims(arr, 0)    # shape: (1, 224, 224, 3)
    # probs = _model.predict(arr)[0]   # shape: (num_classes,)
    # return probs.tolist()

    # ── Option B: TFLite ──────────────────────────────────────
    # import numpy as np
    # import tflite_runtime.interpreter as tflite
    # from PIL import Image
    #
    # MODEL_PATH = os.path.join(MODEL_DIR, 'model.tflite')
    # interp = tflite.Interpreter(model_path=MODEL_PATH)
    # interp.allocate_tensors()
    # in_idx  = interp.get_input_details()[0]['index']
    # out_idx = interp.get_output_details()[0]['index']
    #
    # img = Image.open(io.BytesIO(img_bytes)).resize(IMG_SIZE).convert('RGB')
    # arr = np.array(img, dtype=np.float32) / 255.0
    # arr = np.expand_dims(arr, 0)
    # interp.set_tensor(in_idx, arr)
    # interp.invoke()
    # return interp.get_tensor(out_idx)[0].tolist()

    # ── Option C: ONNX ────────────────────────────────────────
    # import numpy as np
    # import onnxruntime as ort
    # from PIL import Image
    #
    # MODEL_PATH = os.path.join(MODEL_DIR, 'model.onnx')
    # sess = ort.InferenceSession(MODEL_PATH)
    # in_name = sess.get_inputs()[0].name
    #
    # img = Image.open(io.BytesIO(img_bytes)).resize(IMG_SIZE).convert('RGB')
    # arr = np.array(img, dtype=np.float32) / 255.0
    # arr = np.transpose(arr, (2,0,1))   # CHW
    # arr = np.expand_dims(arr, 0)
    # out = sess.run(None, {in_name: arr})[0][0]
    # # If logits, apply softmax:
    # e = np.exp(out - out.max()); out = (e / e.sum()).tolist()
    # return out

    # ── STUB (replace with one of the above) ──────────────────
    raise FileNotFoundError(
        "No model loaded. Edit model_inference.py and uncomment "
        "the block matching your model format (TF/TFLite/ONNX), "
        "then place your model file in backend/model/."
    )


def _build_result(probs: list, fruit: str) -> dict:
    """Turn raw probabilities into the standard response dict."""
    if len(probs) == 2:
        # Binary: [fresh_prob, rotten_prob]
        fresh_p, rotten_p = probs[0], probs[1]
    else:
        # Multi-class: pick the indices for this fruit
        # Override this logic to match your label ordering
        fresh_p  = probs[0]
        rotten_p = probs[1]

    status = 'fresh' if fresh_p >= rotten_p else 'rotten'
    return {
        'fruit':        fruit,
        'status':       status,
        'fresh_score':  round(fresh_p  * 100, 2),
        'rotten_score': round(rotten_p * 100, 2),
    }
