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
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

// Cargar variables de .env si existe localmente
const ENV_FILE = path.join(__dirname, ".env");
if (fs.existsSync(ENV_FILE)) {
  try {
    const lines = fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = (match[2] || "").trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } catch (e) {}
}

let leads = [];
try {
  if (fs.existsSync(LEADS_FILE)) leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
} catch (e) {
  leads = [];
}

// Guardado local con 'debounce' para evitar bloqueos del disco cuando hay alta concurrencia
let saveLeadsTimer = null;
function guardarLeadLocal(lead) {
  leads.push(lead);
  clearTimeout(saveLeadsTimer);
  saveLeadsTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    } catch (e) {
      console.error("Error guardando lead local:", e.message);
    }
  }, 250);
}

// Envío a Supabase
async function enviarASupabase(lead) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) return false;
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/leads_taller`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        nombre: lead.nombre,
        telefono: lead.telefono,
        email: lead.email,
        dedicacion: lead.dedicacion,
        tema_interes: lead.tema_interes,
        perfil: lead.perfil,
        device_id: lead.deviceId,
        created_at: lead.fecha || new Date().toISOString()
      })
    });
    if (res.ok) {
      console.log(`✓ Lead de ${lead.nombre} sincronizado en Supabase`);
      return true;
    }
    const errText = await res.text().catch(() => "");
    console.warn(`Aviso Supabase (${res.status}): ${errText}`);
    return false;
  } catch (err) {
    console.warn(`Error de red con Supabase: ${err.message}`);
    return false;
  }
}

// Cola en memoria con reintentos automáticos para soportar ráfagas concurrentes sin perder leads
const supabaseQueue = [];
let processingQueue = false;

function encolarParaSupabase(lead) {
  supabaseQueue.push({ lead, retries: 0 });
  procesarColaSupabase();
}

async function procesarColaSupabase() {
  if (processingQueue || supabaseQueue.length === 0) return;
  processingQueue = true;

  while (supabaseQueue.length > 0) {
    const item = supabaseQueue[0];
    const ok = await enviarASupabase(item.lead);
    if (ok) {
      supabaseQueue.shift(); // Enviado exitosamente
    } else {
      item.retries++;
      if (item.retries >= 5) {
        console.error(`Descartado de cola tras 5 reintentos fallidos: ${item.lead.nombre}`);
        supabaseQueue.shift();
      } else {
        const delay = Math.min(item.retries * 800, 4000);
        console.log(`Reintentando envío a Supabase en ${delay}ms (intento ${item.retries}/5)...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    // Pausa de 35ms entre peticiones para no saturar conexiones HTTP concurrentes
    await new Promise((r) => setTimeout(r, 35));
  }

  processingQueue = false;
}

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

// Cabeceras de seguridad HTTP
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Limitador de tasa (Anti-spam / Anti-DDoS) en memoria por IP
const ipLimits = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of ipLimits.entries()) {
    if (now > rec.reset) ipLimits.delete(ip);
  }
}, 60000);

function rateLimit({ max, windowMs, message }) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || "anon";
    const now = Date.now();
    const record = ipLimits.get(ip) || { count: 0, reset: now + windowMs };
    if (now > record.reset) {
      record.count = 1;
      record.reset = now + windowMs;
    } else {
      record.count++;
    }
    ipLimits.set(ip, record);
    if (record.count > max) {
      return res.status(429).json({ ok: false, error: message || "Demasiadas peticiones. Intenta en un momento." });
    }
    next();
  };
}

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
app.post("/api/votar", rateLimit({ max: 40, windowMs: 60000 }), (req, res) => {
  const { deviceId, opcion } = req.body || {};
  if (!registrarVoto(deviceId, opcion)) return res.status(400).json({ ok: false });
  io.emit("resultados", resultados());
  res.json({ ok: true, ...resultados() });
});

app.post("/api/diagnostico", rateLimit({ max: 30, windowMs: 60000 }), (req, res) => {
  const { deviceId, perfil } = req.body || {};
  if (!registrarDiagnostico(deviceId, perfil)) return res.status(400).json({ ok: false });
  io.emit("resultados", resultados());
  res.json({ ok: true });
});

// Captura de datos del asistente (Lead para desbloquear el diagnóstico)
app.post("/api/registro-lead", rateLimit({ max: 20, windowMs: 60000, message: "Demasiados registros desde este dispositivo. Espera un minuto." }), async (req, res) => {
  const { nombre, telefono, email, dedicacion, tema_interes, perfil, respuestas, deviceId } = req.body || {};
  if (!nombre || !telefono || !email) {
    return res.status(400).json({ ok: false, error: "Nombre, teléfono y correo son requeridos" });
  }

  // Sanitización de entradas
  const cleanNombre = String(nombre).trim().replace(/[<>]/g, "").slice(0, 100);
  const cleanTelefono = String(telefono).trim().replace(/[^\d+()\s-]/g, "").slice(0, 40);
  const cleanEmail = String(email).trim().toLowerCase().slice(0, 120);

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    nombre: cleanNombre,
    telefono: cleanTelefono,
    email: cleanEmail,
    dedicacion: String(dedicacion || "").trim().replace(/[<>]/g, "").slice(0, 120),
    tema_interes: String(tema_interes || "").trim().replace(/[<>]/g, "").slice(0, 120),
    perfil: String(perfil || "").trim().slice(0, 50),
    respuestas: respuestas || null,
    deviceId: String(deviceId || "").trim().slice(0, 64),
    fecha: new Date().toISOString()
  };

  guardarLeadLocal(lead);
  if (lead.deviceId && lead.perfil) {
    registrarDiagnostico(lead.deviceId, lead.perfil);
    io.emit("resultados", resultados());
  }

  // Encolar para envío a Supabase con reintentos automáticos
  encolarParaSupabase(lead);

  res.json({ ok: true, leadId: lead.id });
});

// Listado de leads para el orador / organizador: GET /api/leads?clave=...
app.get("/api/leads", (req, res) => {
  if (req.query.clave !== ADMIN_KEY) return res.status(403).json({ ok: false, error: "Clave no autorizada" });
  res.json({ total: leads.length, leads });
});

// Sanitización para prevenir CSV Injection (inyección de fórmulas en Excel)
function sanitizeCsvCell(val) {
  let str = String(val || "").trim();
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  return `"${str.replace(/"/g, '""')}"`;
}

// Descargar lista de leads en formato CSV para Excel: GET /api/leads/export.csv?clave=...
app.get("/api/leads/export.csv", (req, res) => {
  if (req.query.clave !== ADMIN_KEY) return res.status(403).send("No autorizado. Pasa ?clave=TU_ADMIN_KEY");
  const headers = ["Fecha", "Nombre", "Teléfono", "Email", "¿A qué se dedica?", "Tema de interés", "Perfil de Marketing"];
  const rows = leads.map((l) => [
    sanitizeCsvCell(l.fecha),
    sanitizeCsvCell(l.nombre),
    sanitizeCsvCell(l.telefono),
    sanitizeCsvCell(l.email),
    sanitizeCsvCell(l.dedicacion),
    sanitizeCsvCell(l.tema_interes),
    sanitizeCsvCell(l.perfil)
  ].join(","));
  const csv = [headers.join(","), ...rows].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="leads-taller-marketing.csv"');
  res.send("\uFEFF" + csv);
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
