# SmartFridge AI — Website

A real-time fruit freshness dashboard for the Smart Fridge IoT project.

---

## How it works

```
ESP32-CAM  →  ThingsBoard MQTT  →  Website polls every 5s  →  Dashboard updates
```

The ESP32-CAM runs an Edge Impulse model, sends `fresh_score`, `rotten_score`, and `status` to ThingsBoard via MQTT. This website fetches a JWT using your ThingsBoard account credentials, polls ThingsBoard directly, and shows live results on the dashboard.

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

ThingsBoard credentials are set at the top of `app.js`:

```js
const TB_CONFIG = {
  host:     'https://thingsboard.cloud', // or demo.thingsboard.io
  deviceId: 'YOUR_DEVICE_ID',
  username: 'YOUR_TB_ACCOUNT_EMAIL',
  password: 'YOUR_TB_ACCOUNT_PASSWORD',
};
```

---

## Using the dashboard

1. Serve the `refrigerator_website` folder statically. You must use a local server (e.g., `python -m http.server 8000` or VS Code Live Server) to avoid CORS issues.
2. Open `index.html` in your browser.
3. Scroll down to the **Live Dashboard** section.
4. The dashboard will automatically fetch the latest item scanned by the ESP32 and show its status, fresh score, and rotten score in the "Last Scanned Item" card.

If ThingsBoard is unreachable or credentials fail, the dashboard shows demo data automatically.

---

## Supported fruits

| Fruit |
|-------|
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
