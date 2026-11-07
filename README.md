# Marketing con propósito · En vivo

Tres piezas que funcionan juntas desde un solo servidor:

| Ruta | Qué es | Quién la abre |
|---|---|---|
| `/` | **App para asistentes**: diagnóstico de 7 preguntas con plan personal (descargable y como PDF) + votación en vivo | El público, escaneando el QR de la diapositiva 5 |
| `/presentacion` | **Tus 30 diapositivas**. La 24 (encuesta) se anima sola con cada voto | Tú, en la pantalla del taller |
| `/resultados` | Pantalla de resultados a pantalla completa (respaldo), con QR para votar | Tú, si quieres mostrar solo los resultados |
| `/qr.svg` | QR que se genera solo con la dirección real del servidor | Lo usa la diapositiva 5 |

El tiempo real va por **WebSockets (Socket.IO)**. Si la red del lugar bloquea WebSockets, cambia solo a *long-polling*, y además la app y la diapositiva refrescan por HTTP cada 4–5 s. Cada teléfono tiene **un voto** (puede cambiarlo); los votos quedan guardados en `data/estado.json`.

---

## 1. Probar en tu computadora

Necesitas [Node.js 18 o superior](https://nodejs.org).

```bash
npm install
npm start
```

Abre `http://localhost:3000/presentacion` y, en otra pestaña o en tu teléfono (misma Wi‑Fi, usando la IP de tu computadora), `http://localhost:3000/#votar`.

## 2. Publicarlo en internet gratis (Render)

1. Sube esta carpeta a un repositorio de GitHub.
2. En [render.com](https://render.com) → **New → Web Service** → elige el repositorio.
3. Configura:
   - Build command: `npm install`
   - Start command: `npm start`
   - Variables de entorno:
     - `ADMIN_KEY` = una clave tuya (para reiniciar la encuesta)
     - `PUBLIC_URL` = la dirección que te da Render, por ejemplo `https://marketing-con-proposito.onrender.com`
4. Listo. El QR de la diapositiva 5 apunta automáticamente a esa dirección.

> En el plan gratuito de Render el servicio "se duerme" tras 15 min sin uso y tarda ~30 s en despertar. **Abre `/presentacion` unos minutos antes del taller.** El archivo `data/estado.json` se borra cuando Render reinicia el servicio; para un taller no importa, pero si quieres guardar los votos para siempre, usa un plan con disco o Railway/Fly.io con volumen.

También funciona igual en Railway, Fly.io o cualquier VPS con Node.

## 3. El día del taller

1. Reinicia la encuesta (borra votos de prueba):
   ```bash
   curl -X POST https://TU-DIRECCION/api/reiniciar -H "Content-Type: application/json" -d '{"clave":"TU_ADMIN_KEY"}'
   ```
2. Abre `https://TU-DIRECCION/presentacion` en la computadora del proyector y presiona **F** para pantalla completa.
3. Navegación: **→ / espacio** siguiente, **←** anterior, **Inicio/Fin**, o clic en la mitad derecha/izquierda. Puedes saltar a una diapositiva con `#24` al final de la dirección.
4. En la diapositiva 5 el público escanea el QR → hace el diagnóstico → toca **Votar**.
5. En la diapositiva 24 los porcentajes y "VOTOS REGISTRADOS" se mueven solos.

## 4. Tus imágenes

Las imágenes de la presentación original viven dentro de Claude y no se pudieron exportar. Reemplaza estos archivos (mismo nombre, PNG) en `public/img/`:

- `foto-manuel.png` — tu foto (diapositiva 2)
- `logo-sumaspro.png` — logo de Sumas Pro (diapositiva 3)
- `marcas/mexc.png`, `marcas/buen-dia-cbo.png`, `marcas/mana-fastfood.png`, `marcas/dores.png`, `marcas/jac-ciudad-bolivar.png`, `marcas/nova-vision.png` — logos de la diapositiva 4

El QR **no** hay que reemplazarlo: lo genera el servidor.

## 5. Si cambias las diapositivas

Las diapositivas fuente están en `slides/` (una por archivo, más `deck.json`). Después de editarlas:

```bash
python3 tools/build-presentacion.py
```

Eso regenera `public/presentacion.html`.

## API (por si quieres conectarla a otra cosa)

- `GET /api/resultados` → `{ conteo, porcentaje, total, perfiles, diagnosticos }`
- `POST /api/votar` `{ deviceId, opcion: "A"|"B"|"C" }`
- `POST /api/diagnostico` `{ deviceId, perfil }`
- `POST /api/reiniciar` `{ clave }`
- Socket.IO: eventos `votar`, `diagnostico` (cliente → servidor) y `resultados` (servidor → todos)
