// Marketing con propósito — servidor en tiempo real
// Sirve: app para asistentes (/), presentación (/presentacion), resultados (/resultados)
// y la votación en vivo por WebSockets (Socket.IO, con long-polling automático de respaldo).

const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const express = require("express");
const QRCode = require("qrcode");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "cambia-esta-clave";
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "estado.json");

// Opciones de la encuesta (deben coincidir con la app y la diapositiva 24)
const OPCIONES = {
  A: "Saber qué publicar",
  B: "Llegar a las personas correctas",
  C: "Medir resultados",
};
const PERFILES = ["creativo", "comunicador", "estratega", "servidor"];

// ---------- Estado (en memoria + archivo JSON) ----------
let estado = { votos: {}, diagnosticos: {} };
try {
  if (fs.existsSync(DATA_FILE)) estado = { ...estado, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
} catch (e) {
  console.warn("No se pudo leer el estado guardado, empiezo vacío:", e.message);
}

let saveTimer = null;
function guardar() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(estado));
    } catch (e) {
      console.warn("No se pudo guardar el estado:", e.message);
    }
  }, 300);
}

function resultados() {
  const conteo = { A: 0, B: 0, C: 0 };
  for (const v of Object.values(estado.votos)) if (conteo[v] !== undefined) conteo[v]++;
  const total = conteo.A + conteo.B + conteo.C;
  const porcentaje = {};
  for (const k of Object.keys(conteo)) porcentaje[k] = total ? Math.round((conteo[k] / total) * 100) : 0;
  const perfiles = Object.fromEntries(PERFILES.map((p) => [p, 0]));
  for (const p of Object.values(estado.diagnosticos)) if (perfiles[p] !== undefined) perfiles[p]++;
  return { opciones: OPCIONES, conteo, porcentaje, total, perfiles, diagnosticos: Object.keys(estado.diagnosticos).length };
}

const idValido = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(id);

function registrarVoto(deviceId, opcion) {
  if (!idValido(deviceId) || !OPCIONES[opcion]) return false;
  estado.votos[deviceId] = opcion; // un voto por teléfono; puede cambiarlo
  guardar();
  return true;
}

function registrarDiagnostico(deviceId, perfil) {
  if (!idValido(deviceId) || !PERFILES.includes(perfil)) return false;
  estado.diagnosticos[deviceId] = perfil;
  guardar();
  return true;
}

// ---------- HTTP ----------
const app = express();
app.use(express.json({ limit: "10kb" }));
app.set("trust proxy", true);

const pub = path.join(__dirname, "public");
app.get("/", (req, res) => res.sendFile(path.join(pub, "app.html")));
app.get("/votar", (req, res) => res.redirect("/#votar"));
app.get("/presentacion", (req, res) => res.sendFile(path.join(pub, "presentacion.html")));
app.get("/resultados", (req, res) => res.sendFile(path.join(pub, "resultados.html")));
app.use(express.static(pub, { extensions: ["html"] }));

function getLocalIp() {
  const nets = os.networkInterfaces();
  let candidate = null;
  for (const name of Object.keys(nets)) {
    if (/vEthernet|Virtual|VMware|WSL|Default Switch|Loopback|TUN|TAP|VPN/i.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        if (/Wi-Fi|Ethernet|WLAN/i.test(name) || net.address.startsWith("192.168.")) {
          return net.address;
        }
        if (!candidate) candidate = net.address;
      }
    }
  }
  return candidate || "localhost";
}

function urlPublica(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const host = req.get("host") || "";
  const hostname = host.split(":")[0];
  const port = host.split(":")[1] || PORT;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const localIp = getLocalIp();
    return `${req.protocol}://${localIp}${port ? ":" + port : ""}`;
  }
  return `${req.protocol}://${host}`;
}

// QR dinámico: apunta a la app de asistentes (o a /votar con ?destino=votar)
app.get("/qr.svg", async (req, res) => {
  const destino = req.query.destino === "votar" ? "/votar" : "/";
  try {
    const svg = await QRCode.toString(urlPublica(req) + destino, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#15102E", light: "#FFFDF9" },
    });
    res.type("image/svg+xml").set("Cache-Control", "no-cache").send(svg);
  } catch (e) {
    res.status(500).send("No se pudo generar el QR");
  }
});

app.get("/api/info", (req, res) => res.json({ url: urlPublica(req) }));
app.get("/api/resultados", (req, res) => res.json(resultados()));

// Respaldo por HTTP (por si un teléfono no logra abrir el WebSocket)
app.post("/api/votar", (req, res) => {
  const { deviceId, opcion } = req.body || {};
  if (!registrarVoto(deviceId, opcion)) return res.status(400).json({ ok: false });
  io.emit("resultados", resultados());
  res.json({ ok: true, ...resultados() });
});

app.post("/api/diagnostico", (req, res) => {
  const { deviceId, perfil } = req.body || {};
  if (!registrarDiagnostico(deviceId, perfil)) return res.status(400).json({ ok: false });
  io.emit("resultados", resultados());
  res.json({ ok: true });
});

// Reiniciar la encuesta antes del taller: POST /api/reiniciar con { "clave": "..." }
app.post("/api/reiniciar", (req, res) => {
  if ((req.body || {}).clave !== ADMIN_KEY) return res.status(403).json({ ok: false });
  estado = { votos: {}, diagnosticos: {} };
  guardar();
  io.emit("resultados", resultados());
  res.json({ ok: true });
});

// ---------- WebSockets ----------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

io.on("connection", (socket) => {
  socket.emit("resultados", resultados());

  socket.on("votar", ({ deviceId, opcion } = {}, ack) => {
    const ok = registrarVoto(deviceId, opcion);
    if (ok) io.emit("resultados", resultados());
    if (typeof ack === "function") ack({ ok });
  });

  socket.on("diagnostico", ({ deviceId, perfil } = {}, ack) => {
    const ok = registrarDiagnostico(deviceId, perfil);
    if (ok) io.emit("resultados", resultados());
    if (typeof ack === "function") ack({ ok });
  });
});

server.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log(`\n=================================================`);
  console.log(`Marketing con propósito en vivo listo en puerto ${PORT}:`);
  console.log(`  Proyector / Presentación: http://localhost:${PORT}/presentacion`);
  console.log(`  App asistentes (móvil):   http://${localIp}:${PORT}/`);
  console.log(`  Pantalla de resultados:   http://localhost:${PORT}/resultados`);
  if (PUBLIC_URL) console.log(`  URL Pública activa:       ${PUBLIC_URL}`);
  console.log(`=================================================\n`);
  if (ADMIN_KEY === "cambia-esta-clave") {
    console.log("  [Tip] Puedes definir ADMIN_KEY=tu_clave para proteger el reinicio de la encuesta.");
  }
});
