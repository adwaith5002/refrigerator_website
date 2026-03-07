# SmartFridge AI — Website

A real-time fruit freshness dashboard for the Smart Fridge IoT project.

---

## How it works

```
ESP32-CAM  →  ThingsBoard MQTT  →  Website polls every 5s  →  Dashboard updates
```

The ESP32-CAM runs an Edge Impulse model, sends `fresh_score`, `rotten_score`, and `status` to ThingsBoard via MQTT. This website polls ThingsBoard directly and shows live results on the dashboard.

---

## Files

```
refrigerator_website/
├── index.html      ← Single-page app
├── style.css       ← Styles + fridge hero animation
└── app.js          ← ThingsBoard polling + dashboard logic
```

---

## Configuration

ThingsBoard credentials are already set in `app.js` lines 8–11:

```js
const TB_CONFIG = {
  host:     'https://thingsboard.cloud',
  deviceId: 'f99fdac0-10a4-11f1-b5a7-93241ed57bdc',
  jwtToken: '60iIEYd7Dt1HSR2tCNLD',
};
```

---

## Using the dashboard

1. Open `index.html` in a browser
2. Scroll down to the **Live Dashboard** section
3. Before the ESP32 scans a fruit, click the matching button in the topbar: **🍎 Apple / 🍌 Banana / 🍊 Orange**
4. The dashboard updates that fruit's card with live freshness scores

If ThingsBoard is unreachable, the dashboard shows demo data automatically.

---

## Supported fruits

| Fruit | Emoji |
|-------|-------|
| Apple  |
| Banana |
| Orange |

---

## ThingsBoard keys (what the ESP32 publishes)

| Key | Type | Range |
|-----|------|-------|
| `status` | string | `"FRESH"` or `"ROTTEN"` |
| `fresh_score` | float | 0 – 1 |
| `rotten_score` | float | 0 – 1 |
| `temperature` | float | °C (optional) |
