# Streaming App

App simple de transmisión WebRTC punto a punto para uso interno.

## Cómo funciona

- Un usuario entra a `/broadcast`, elige cámara o compartir pantalla, y obtiene un ID de stream (ej. `1`, `2`, ...).
- Otros usuarios entran a `/watch` para ver la lista de transmisiones activas, o directamente a `/<id>` (ej. `/1`) para ver una.
- El video viaja **directo entre navegadores** (WebRTC P2P). El servidor solo hace señalización por WebSocket.

## Correr en local

```bash
npm install
npm start
```

Abrir http://localhost:3000

En local, WebRTC funciona sobre HTTP porque `localhost` cuenta como origen seguro.

## Deploy a Render (plan free)

1. Subir el repo a GitHub.
2. En Render: **New → Web Service** → conectar el repo.
3. Configuración:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Render inyecta `PORT` automáticamente y sirve HTTPS. WebSocket funciona en el mismo puerto vía upgrade en `/ws`.

## Rutas

| Ruta | Descripción |
|---|---|
| `/` | Index con dos opciones |
| `/broadcast` | Iniciar una transmisión |
| `/watch` | Lista de transmisiones activas |
| `/<n>` | Ver el stream N (ej. `/1`, `/2`) |
| `/api/streams` | JSON con streams activos |
| `/ws` | WebSocket de señalización |

## Limitaciones

- **Sin TURN**: en NATs simétricos (algunas redes corporativas o de mobile carriers) la conexión puede fallar.
- **~5-10 viewers por stream**: el broadcaster sube el video una vez por cada viewer (mesh P2P). Para más viewers hace falta un SFU (no cabe en Render free).
- **iOS no comparte pantalla**: solo cámara. El botón de pantalla se deshabilita automáticamente.
- **Render free duerme**: tras ~15 min sin tráfico el servicio se apaga. El primer request tarda ~30-50s en despertar. Al apagarse, los streams activos se cortan (el estado vive solo en memoria).
- **Sin autenticación**: cualquiera con la URL puede transmitir y ver.

## Estructura

```
streaming-app/
├── package.json
├── server.js          # Express + WebSocket signaling
└── public/
    ├── index.html
    ├── broadcast.html
    ├── watch.html
    └── stream.html
```
