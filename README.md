# HUELLAS DEL VALLE — MAKE + GOOGLE SHEETS

Esta versión está preparada para que el navegador se comunique con Make mediante Webhooks.

## Arquitectura

Navegador
  ↓ POST JSON
Make — Webhook Agendar
  ↓
Google Sheets — Agenda
  ↓
Validación de cupos
  ↓
Google Sheets — Citas
  ↓
Webhook Response
  ↓
Navegador

Para consultar agenda:

Navegador
  ↓ POST fecha
Make — Webhook Agenda
  ↓
Google Sheets — Citas
  ↓
JSON
  ↓
Navegador

## HOJAS DE GOOGLE SHEETS

### Hoja Agenda

Usa exactamente:

franja | fecha | hora | cupo | ocupados

Ejemplo:

2026-10-14 08:00 | 2026-10-14 | 08:00 | 3 | 0
2026-10-14 09:00 | 2026-10-14 | 09:00 | 3 | 1
2026-10-14 10:00 | 2026-10-14 | 10:00 | 3 | 2
2026-10-14 11:00 | 2026-10-14 | 11:00 | 3 | 3
2026-10-15 08:00 | 2026-10-15 | 08:00 | 3 | 0
2026-10-15 09:00 | 2026-10-15 | 09:00 | 3 | 1
2026-10-15 10:00 | 2026-10-15 | 10:00 | 3 | 2
2026-10-15 11:00 | 2026-10-15 | 11:00 | 3 | 3

### Hoja Citas

id_cita | propietario | correo | mascota | especie | servicio | fecha | hora | franja | fecha_solicitud | estado | cupo | ocupados_antes | ocupados_despues | libres | observacion

### Hoja Incidencias

id_incidencia | fecha_hora | tipo | detalle | fecha | hora | mascota | origen

## MAKE — ESCENARIO 1: AGENDAR

Módulos:

1. Webhooks > Custom webhook
2. Google Sheets > Search Rows
3. Router
4. Validación
5. Google Sheets > Update a Row
6. Google Sheets > Add a Row
7. Webhooks > Webhook response

El webhook recibe:

{
  "propietario":"Juan Pérez",
  "correo":"juan@email.com",
  "mascota":"Luna",
  "especie":"Perro",
  "servicio":"Consulta general",
  "fecha":"2026-10-14",
  "hora":"08:00",
  "origen":"WEB_HUELLAS_DEL_VALLE"
}

### Lógica

Buscar en Agenda donde:

fecha = fecha recibida
hora = hora recibida

Si no existe:
estado = RESPALDO
registrar incidencia
no modificar cupos
responder JSON

Si existe:
libres = cupo - ocupados

Si libres <= 0:
estado = RECHAZADA
no modificar nada
no registrar cita

Antes de confirmar:
buscar en Citas una cita confirmada con la misma mascota y fecha.

Si existe:
estado = RECHAZADA
mensaje = La mascota ya tiene una cita ese día.
no modificar cupos.

Si hay cupo:
ocupados_despues = ocupados + 1
libres_despues = cupo - ocupados_despues

Actualizar Agenda.

Agregar fila en Citas.

Si libres_despues <= 1:
estado = CONFIRMADA_CON_ALERTA
además enviar aviso al administrador.

Si libres_despues > 1:
estado = CONFIRMADA.

### Respuestas

Confirmada:

{
 "estado":"CONFIRMADA",
 "mensaje":"Cita confirmada correctamente.",
 "cupo":3,
 "ocupados":1,
 "libres":2
}

Confirmada con alerta:

{
 "estado":"CONFIRMADA_CON_ALERTA",
 "mensaje":"Cita confirmada. La franja quedó llena y se generó una alerta administrativa.",
 "cupo":3,
 "ocupados":3,
 "libres":0
}

Rechazada:

{
 "estado":"RECHAZADA",
 "mensaje":"No hay cupos disponibles."
}

Duplicado:

{
 "estado":"RECHAZADA",
 "mensaje":"La mascota ya tiene una cita ese día."
}

Respaldo:

{
 "estado":"RESPALDO",
 "mensaje":"La franja no existe en la agenda. Se registró la incidencia."
}

## MAKE — ESCENARIO 2: AGENDA

Crea un segundo Custom Webhook.

Entrada:

{
 "fecha":"2026-10-14"
}

Después:

Google Sheets > Search Rows

Filtra:

fecha = fecha recibida

Devuelve:

{
 "fecha":"2026-10-14",
 "citas":[
   {
     "hora":"08:00",
     "propietario":"Juan Pérez",
     "mascota":"Luna",
     "especie":"Perro",
     "servicio":"Consulta general",
     "estado":"CONFIRMADA"
   }
 ],
 "libres":6
}

## CONECTAR LOS WEBHOOKS

Abre:

js/app.js

Busca:

BOOKING_WEBHOOK: "PEGAR_WEBHOOK_AGENDAR_AQUI",
AGENDA_WEBHOOK: "PEGAR_WEBHOOK_AGENDA_AQUI"

Pega las dos URL de Make.

Luego abre index.html con Live Server.

## IMPORTANTE SOBRE CORS

El navegador debe poder hacer POST al webhook de Make. Si el navegador muestra un error CORS, la lógica de Make puede estar correcta pero el navegador está bloqueando la respuesta. En ese caso se necesita configurar el acceso del webhook o usar un pequeño intermediario web.

## SEGURIDAD

No pongas credenciales de Google Sheets, tokens privados ni claves de Make dentro de Google Sheets o del frontend.

La página solamente conoce las URLs públicas de los webhooks; Make es quien accede a Google Sheets.
