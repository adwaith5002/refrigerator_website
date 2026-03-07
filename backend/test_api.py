# SmartFridge AI — Backend Test Script
# Run this to verify all API endpoints work correctly.
#
# USAGE:
#   1. Start backend:    cd backend && python app.py
#   2. Run this script:  python test_api.py
#
# All tests should print ✅ PASS

import json
import sys
import time

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

BASE = "http://localhost:5000"
PASS = 0
FAIL = 0

def ok(name):
    global PASS
    PASS += 1
    print(f"  ✅ PASS  {name}")

def fail(name, reason):
    global FAIL
    FAIL += 1
    print(f"  ❌ FAIL  {name}: {reason}")

# ── Helpers ───────────────────────────────────────────
def post(path, **kwargs):
    return requests.post(BASE + path, timeout=5, **kwargs)

def get(path, **kwargs):
    return requests.get(BASE + path, timeout=5, **kwargs)

# ── 1. Health check ───────────────────────────────────
print("\n── 1. Health check")
try:
    r = get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    ok("GET /health")
except Exception as e:
    fail("GET /health", e)

# ── 2. POST /api/scan — apple fresh ──────────────────
print("\n── 2. POST /api/scan  (apple fresh)")
try:
    r = post("/api/scan", json={
        "fruit": "apple",
        "status": "fresh",
        "fresh_score": 91.4,
        "rotten_score": 8.6,
    })
    assert r.status_code == 201, f"status={r.status_code}"
    body = r.json()
    assert body["ok"] == True
    assert body["fruit"] == "apple"
    ok("POST /api/scan (apple)")
except Exception as e:
    fail("POST /api/scan (apple)", e)

# ── 3. POST /api/scan — banana rotten ────────────────
print("\n── 3. POST /api/scan  (banana rotten)")
try:
    r = post("/api/scan", json={
        "fruit": "banana",
        "status": "rotten",
        "fresh_score": 17.2,
        "rotten_score": 82.8,
        "temperature": 4.1,
        "humidity": 70.0,
    })
    assert r.status_code == 201, f"status={r.status_code}"
    ok("POST /api/scan (banana)")
except Exception as e:
    fail("POST /api/scan (banana)", e)

# ── 4. POST /api/scan — orange fresh ─────────────────
print("\n── 4. POST /api/scan  (orange fresh)")
try:
    r = post("/api/scan", json={
        "fruit": "orange",
        "status": "fresh",
        "fresh_score": 86.5,
        "rotten_score": 13.5,
    })
    assert r.status_code == 201, f"status={r.status_code}"
    ok("POST /api/scan (orange)")
except Exception as e:
    fail("POST /api/scan (orange)", e)

# ── 5. POST /api/scan — bad fruit name ───────────────
print("\n── 5. POST /api/scan  (bad fruit — expect 400)")
try:
    r = post("/api/scan", json={"fruit": "mango", "status": "fresh", "fresh_score": 90})
    assert r.status_code == 400, f"expected 400, got {r.status_code}"
    ok("POST /api/scan bad fruit → 400")
except Exception as e:
    fail("POST /api/scan bad fruit → 400", e)

# ── 6. GET /api/latest ───────────────────────────────
print("\n── 6. GET /api/latest")
try:
    r = get("/api/latest")
    assert r.status_code == 200, f"status={r.status_code}"
    body = r.json()
    assert "apple"  in body, "apple missing"
    assert "banana" in body, "banana missing"
    assert "orange" in body, "orange missing"
    assert body["apple"]["status"]  == "fresh"
    assert body["banana"]["status"] == "rotten"
    assert "environment" in body, "environment missing (should have temp+humidity from banana scan)"
    ok("GET /api/latest — all 3 fruits + env")
except Exception as e:
    fail("GET /api/latest", e)

# ── 7. GET /api/history ───────────────────────────────
print("\n── 7. GET /api/history")
try:
    r = get("/api/history?limit=10")
    assert r.status_code == 200
    body = r.json()
    assert len(body["history"]) >= 3, f"expected ≥3 rows, got {len(body['history'])}"
    ok("GET /api/history")
except Exception as e:
    fail("GET /api/history", e)

# ── 8. GET /api/history?fruit=banana ─────────────────
print("\n── 8. GET /api/history?fruit=banana")
try:
    r = get("/api/history?fruit=banana")
    assert r.status_code == 200
    body = r.json()
    assert all(row["fruit"] == "banana" for row in body["history"])
    ok("GET /api/history?fruit=banana")
except Exception as e:
    fail("GET /api/history?fruit=banana", e)

# ── 9. GET /api/stats ─────────────────────────────────
print("\n── 9. GET /api/stats")
try:
    r = get("/api/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["total_scans"] >= 3
    assert "per_fruit" in body
    assert body["per_fruit"]["apple"]["fresh"] >= 1
    ok("GET /api/stats")
except Exception as e:
    fail("GET /api/stats", e)

# ── 10. CORS header ────────────────────────────────────
print("\n── 10. CORS header present on /api/latest")
try:
    r = get("/api/latest")
    assert "Access-Control-Allow-Origin" in r.headers, "missing CORS header"
    ok("CORS header")
except Exception as e:
    fail("CORS header", e)

# ── Summary ────────────────────────────────────────────
print(f"\n{'─'*40}")
total = PASS + FAIL
print(f"  {PASS}/{total} tests passed", "🎉" if FAIL == 0 else "⚠")
if FAIL:
    print(f"  {FAIL} test(s) failed — check backend logs")
print()
sys.exit(0 if FAIL == 0 else 1)
