const CONFIG = {
  BOOKING_WEBHOOK: "https://hook.us2.make.com/5pyyfqcut9gmcq7kdjl1futvmw8s6v0r",
  AGENDA_WEBHOOK: "PEGAR_WEBHOOK_AGENDA_AQUI"
};

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().slice(0, 10);
  $("fecha").value = today;
  $("fecha").min = today;
  $("agendaDate").value = today;

  document.querySelectorAll(".tab").forEach(btn =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab))
  );

  $("fecha").addEventListener("change", checkAvailability);
  $("hora").addEventListener("change", checkAvailability);
  $("appointmentForm").addEventListener("submit", submitAppointment);
  $("refreshAgenda").addEventListener("click", loadAgenda);

  checkAvailability();
});

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach(x => x.classList.toggle("active", x.id === tab));
}

async function checkAvailability() {
  const fecha = $("fecha").value;
  const hora = $("hora").value;
  const box = $("availability");

  if (!fecha || !hora) {
    box.className = "availability";
    box.textContent = "Selecciona fecha y hora para consultar disponibilidad.";
    return;
  }

  box.className = "availability";
  box.textContent = "La disponibilidad se validará al enviar la solicitud.";
}

async function submitAppointment(event) {
  event.preventDefault();

  if (!CONFIG.BOOKING_WEBHOOK || CONFIG.BOOKING_WEBHOOK.includes("PEGAR_")) {
    showResult("DANGER", "Configura primero BOOKING_WEBHOOK en js/app.js con la URL de tu webhook de Make.", "danger");
    return;
  }

  const data = {
    propietario: $("propietario").value.trim(),
    correo: $("correo").value.trim(),
    mascota: $("mascota").value.trim(),
    especie: $("especie").value,
    servicio: $("servicio").value,
    fecha: $("fecha").value, // YYYY-MM-DD
    hora: $("hora").value,   // HH:mm
    origen: "WEB_HUELLAS_DEL_VALLE"
  };

  const btn = $("submitBtn");
  btn.disabled = true;
  btn.innerHTML = "Validando disponibilidad...";

  try {
    const response = await fetch(CONFIG.BOOKING_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    // Leemos la respuesta JSON sin importar el código de estado HTTP (200, 400, 404, etc.)
    const result = await response.json();

    // Normalización para soportar variaciones en el estado
    const estado = result.estado || result.status || "ERROR";
    const mensaje = result.mensaje || result.message || "Respuesta recibida desde Make.";

    // Mapeo dinámico de clase CSS según el estado de Make
    let cssClass = "danger";
    if (estado === "CONFIRMADA") {
      cssClass = "success";
    } else if (estado === "CONFIRMADA_ALERTA" || estado === "CONFIRMADA_CON_ALERTA") {
      cssClass = "warning";
    } else if (estado === "RESPALDO") {
      cssClass = "backup";
    }

    showResult(estado, mensaje, cssClass, result);

    // Limpia el formulario si la cita fue agendada correctamente
    if (["CONFIRMADA", "CONFIRMADA_ALERTA", "CONFIRMADA_CON_ALERTA"].includes(estado)) {
      $("appointmentForm").reset();
      $("fecha").value = data.fecha;
    }
  } catch (error) {
    console.error("Error al conectar con Make:", error);
    showResult("ERROR", "No se pudo comunicar con Make. Revisa la URL del webhook y que el escenario esté encendido (ON).", "danger");
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Enviar solicitud <b>→</b>';
  }
}

async function loadAgenda() {
  const fecha = $("agendaDate").value;
  if (!fecha) return;

  if (!CONFIG.AGENDA_WEBHOOK || CONFIG.AGENDA_WEBHOOK.includes("PEGAR_")) {
    $("agendaBody").innerHTML = `<tr><td colspan="6" class="empty">Configura AGENDA_WEBHOOK en js/app.js para consultar la agenda.</td></tr>`;
    return;
  }

  $("agendaBody").innerHTML = `<tr><td colspan="6" class="empty">Consultando Google Sheets...</td></tr>`;

  try {
    const response = await fetch(CONFIG.AGENDA_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, origen: "WEB_HUELLAS_DEL_VALLE" })
    });

    const data = await response.json();
    renderAgenda(data);
  } catch (error) {
    console.error("Error al consultar la agenda:", error);
    $("agendaBody").innerHTML = `<tr><td colspan="6" class="empty">No fue posible consultar la agenda desde Make.</td></tr>`;
  }
}

function renderAgenda(data) {
  const citas = Array.isArray(data) ? data : (data.citas || []);

  $("total").textContent = citas.length;
  $("confirmed").textContent = citas.filter(x => x.estado === "CONFIRMADA").length;
  $("alerts").textContent = citas.filter(x => x.estado === "CONFIRMADA_ALERTA" || x.estado === "CONFIRMADA_CON_ALERTA").length;

  if (data.libres !== undefined) $("available").textContent = data.libres;
  else $("available").textContent = "—";

  if (!citas.length) {
    $("agendaBody").innerHTML = `<tr><td colspan="6" class="empty">No hay citas registradas para esta fecha.</td></tr>`;
    return;
  }

  citas.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

  $("agendaBody").innerHTML = citas.map(cita => `
    <tr>
      <td><b>${esc(cita.hora)}</b></td>
      <td>${esc(cita.propietario)}</td>
      <td>${esc(cita.mascota)}</td>
      <td>${esc(cita.especie)}</td>
      <td>${esc(cita.servicio)}</td>
      <td>
        <span class="badge ${ (cita.estado === "CONFIRMADA_ALERTA" || cita.estado === "CONFIRMADA_CON_ALERTA") ? "warning" : "success" }">
          ${esc(formatStatus(cita.estado))}
        </span>
      </td>
    </tr>
  `).join("");
}

function showResult(estado, mensaje, css, details = {}) {
  const box = $("result");
  box.classList.remove("hidden");
  box.className = "result " + css;
  box.innerHTML = `<strong>${esc(formatStatus(estado))}</strong>${esc(mensaje)}
    ${details.libres !== undefined ? `<br><small>Cupos libres: <b>${esc(details.libres)}</b></small>` : ""}`;
}

function formatStatus(status) {
  return ({
    CONFIRMADA: "✓ CITA CONFIRMADA",
    CONFIRMADA_ALERTA: "⚠ CITA CONFIRMADA · ALERTA ADMINISTRATIVA",
    CONFIRMADA_CON_ALERTA: "⚠ CITA CONFIRMADA · ALERTA ADMINISTRATIVA",
    RECHAZADA: "✕ CITA RECHAZADA",
    RESPALDO: "↺ RESPALDO / INCIDENCIA",
    ERROR: "⚠ ERROR"
  })[status] || status;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}