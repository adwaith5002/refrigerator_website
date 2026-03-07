# SmartFridge AI — Python Flask Backend
# ══════════════════════════════════════
# ESP32-CAM sends results → Flask stores them → Website polls this API
# ══════════════════════════════════════
#
# SETUP:
#   pip install flask flask-cors
#   python app.py
#
# ENDPOINTS:
#   POST /api/scan          ← Called by ESP32-CAM with detection result
#   GET  /api/latest        ← Polled by website (latest per fruit)
#   GET  /api/history       ← Recent N detections (all fruits)
#   GET  /api/stats         ← Aggregate stats
#   POST /api/scan/image    ← (Optional) Upload raw image, server runs model
#   GET  /health            ← Health check

from flask import Flask, request, jsonify
from flask_cors import CORS
from database import Database
import traceback

app = Flask(__name__)

# Allow requests from the frontend (any origin during dev; restrict in prod)
CORS(app, resources={r"/api/*": {"origins": "*"}})

db = Database()


# ══════════════════════════════════════════
#  POST /api/scan
#  Called by ESP32-CAM (or ThingsBoard webhook)
#  Body (JSON):
#  {
#    "fruit":        "apple",     // "apple" | "banana" | "orange"
#    "status":       "fresh",     // "fresh" | "rotten"
#    "fresh_score":  92.4,        // 0–100
#    "rotten_score": 7.6,         // 0–100
#    "confidence":   0.924,       // 0–1 (optional alias)
#    "temperature":  4.2,         // °C (optional, fridge sensor)
#    "humidity":     72.0         // % (optional, fridge sensor)
#  }
# ══════════════════════════════════════════
@app.route('/api/scan', methods=['POST'])
def post_scan():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'error': 'No JSON body'}), 400

        fruit = str(data.get('fruit', '')).lower().strip()
        if fruit not in ('apple', 'banana', 'orange'):
            return jsonify({'error': f'Unknown fruit: {fruit}'}), 400

        status      = str(data.get('status', 'unknown')).lower().strip()
        fresh_score = float(data.get('fresh_score',  data.get('confidence', 0) * 100))
        rotten_score= float(data.get('rotten_score', 100 - fresh_score))
        temperature = data.get('temperature')
        humidity    = data.get('humidity')

        record_id = db.insert_detection(
            fruit=fruit,
            status=status,
            fresh_score=round(fresh_score, 2),
            rotten_score=round(rotten_score, 2),
            temperature=float(temperature) if temperature is not None else None,
            humidity=float(humidity)    if humidity    is not None else None,
        )
        return jsonify({'ok': True, 'id': record_id, 'fruit': fruit, 'status': status}), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════
#  GET /api/latest
#  Returns the most recent result for EACH fruit
#  Response:
#  {
#    "apple":  { "status": "fresh",  "fresh_score": 92, "rotten_score": 8, "ts": "..." },
#    "banana": { "status": "rotten", "fresh_score": 18, "rotten_score": 82, "ts": "..." },
#    "orange": { "status": "fresh",  "fresh_score": 87, "rotten_score": 13, "ts": "..." },
#    "environment": { "temperature": 4.2, "humidity": 72.0 }
#  }
# ══════════════════════════════════════════
@app.route('/api/latest', methods=['GET'])
def get_latest():
    try:
        result = db.get_latest_per_fruit()
        return jsonify(result), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════
#  GET /api/history?limit=20&fruit=banana
#  Returns recent detections (all or per fruit)
# ══════════════════════════════════════════
@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        limit = int(request.args.get('limit', 20))
        fruit = request.args.get('fruit', None)
        rows  = db.get_history(limit=limit, fruit=fruit)
        return jsonify({'history': rows}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════
#  GET /api/stats
#  Aggregate stats (total scans, accuracy, etc.)
# ══════════════════════════════════════════
@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        stats = db.get_stats()
        return jsonify(stats), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════
#  POST /api/scan/image
#  Upload a raw JPEG image → server runs the model → returns result
#  Multipart form:   image=<file>   fruit=<name>
# ══════════════════════════════════════════
@app.route('/api/scan/image', methods=['POST'])
def post_scan_image():
    try:
        from model_inference import predict_freshness
        fruit = request.form.get('fruit', 'unknown').lower().strip()
        if 'image' not in request.files:
            return jsonify({'error': 'No image file in request'}), 400

        img_bytes = request.files['image'].read()
        result    = predict_freshness(img_bytes, fruit)

        if result.get('error'):
            return jsonify({'error': result['error']}), 422

        record_id = db.insert_detection(
            fruit=fruit,
            status=result['status'],
            fresh_score=result['fresh_score'],
            rotten_score=result['rotten_score'],
        )
        return jsonify({'ok': True, 'id': record_id, **result}), 201

    except ImportError:
        return jsonify({'error': 'model_inference not available. Add your model file.'}), 501
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════
#  Health check
# ══════════════════════════════════════════
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'db': db.ping()}), 200


if __name__ == '__main__':
    print("\n🥬 SmartFridge AI Backend starting…")
    print("   POST /api/scan        ← ESP32-CAM sends detection result")
    print("   GET  /api/latest      ← Website polls this")
    print("   GET  /api/history     ← Detection log")
    print("   GET  /api/stats       ← Aggregate stats")
    print("   POST /api/scan/image  ← Upload image, run model server-side")
    print("   GET  /health          ← Health check\n")
    app.run(host='0.0.0.0', port=5000, debug=True)
