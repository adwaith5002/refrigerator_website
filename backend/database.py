# SmartFridge AI — database.py
# SQLite persistence for freshness detections

import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), 'smartfridge.db')

FRUITS = ('apple', 'banana', 'orange')

SCHEMA = """
CREATE TABLE IF NOT EXISTS detections (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fruit        TEXT    NOT NULL,
    status       TEXT    NOT NULL,          -- 'fresh' | 'rotten'
    fresh_score  REAL    NOT NULL DEFAULT 0,
    rotten_score REAL    NOT NULL DEFAULT 0,
    temperature  REAL,                      -- fridge temp °C (nullable)
    humidity     REAL,                      -- fridge humidity % (nullable)
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_fruit_created ON detections(fruit, created_at DESC);
"""


class Database:
    def __init__(self):
        self._conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(SCHEMA)
        self._conn.commit()
        print(f"[DB] SQLite ready → {DB_PATH}")

    # ── Write ────────────────────────────────────
    def insert_detection(self, fruit, status, fresh_score, rotten_score,
                         temperature=None, humidity=None) -> int:
        cur = self._conn.execute(
            """INSERT INTO detections (fruit, status, fresh_score, rotten_score, temperature, humidity)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (fruit, status, fresh_score, rotten_score, temperature, humidity)
        )
        self._conn.commit()
        return cur.lastrowid

    # ── Read latest per fruit ────────────────────
    def get_latest_per_fruit(self) -> dict:
        result = {}
        for fruit in FRUITS:
            row = self._conn.execute(
                """SELECT * FROM detections WHERE fruit = ?
                   ORDER BY created_at DESC LIMIT 1""",
                (fruit,)
            ).fetchone()
            if row:
                result[fruit] = {
                    'status':       row['status'],
                    'fresh_score':  row['fresh_score'],
                    'rotten_score': row['rotten_score'],
                    'ts':           row['created_at'],
                    'id':           row['id'],
                }
        # Latest env reading (from any row that has temp/humidity)
        env_row = self._conn.execute(
            """SELECT temperature, humidity, created_at FROM detections
               WHERE temperature IS NOT NULL
               ORDER BY created_at DESC LIMIT 1"""
        ).fetchone()
        if env_row:
            result['environment'] = {
                'temperature': env_row['temperature'],
                'humidity':    env_row['humidity'],
                'ts':          env_row['created_at'],
            }
        return result

    # ── History ──────────────────────────────────
    def get_history(self, limit=20, fruit=None) -> list:
        if fruit and fruit in FRUITS:
            rows = self._conn.execute(
                "SELECT * FROM detections WHERE fruit = ? ORDER BY created_at DESC LIMIT ?",
                (fruit, limit)
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT * FROM detections ORDER BY created_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    # ── Stats ─────────────────────────────────────
    def get_stats(self) -> dict:
        total = self._conn.execute("SELECT COUNT(*) FROM detections").fetchone()[0]
        fresh = self._conn.execute(
            "SELECT COUNT(*) FROM detections WHERE status='fresh'"
        ).fetchone()[0]
        rotten = total - fresh

        per_fruit = {}
        for fruit in FRUITS:
            row = self._conn.execute(
                """SELECT COUNT(*) as total,
                          SUM(CASE WHEN status='fresh'  THEN 1 ELSE 0 END) as fresh,
                          SUM(CASE WHEN status='rotten' THEN 1 ELSE 0 END) as rotten,
                          AVG(fresh_score)  as avg_fresh,
                          AVG(rotten_score) as avg_rotten
                   FROM detections WHERE fruit = ?""",
                (fruit,)
            ).fetchone()
            per_fruit[fruit] = {
                'total':      row[0],
                'fresh':      row[1] or 0,
                'rotten':     row[2] or 0,
                'avg_fresh':  round(row[3] or 0, 1),
                'avg_rotten': round(row[4] or 0, 1),
            }

        return {
            'total_scans':  total,
            'total_fresh':  fresh,
            'total_rotten': rotten,
            'accuracy_pct': round((fresh / total * 100) if total else 0, 1),
            'per_fruit':    per_fruit,
        }

    # ── Health ────────────────────────────────────
    def ping(self) -> str:
        try:
            self._conn.execute("SELECT 1").fetchone()
            return 'ok'
        except Exception:
            return 'error'
