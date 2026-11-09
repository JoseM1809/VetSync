#!/usr/bin/env bash
# Demo de VetSync: recorre los 3 requerimientos de negocio contra el servidor en marcha.
# Uso: bash scripts/demo.sh [url_base]   (por defecto http://localhost:3010/api)
set -euo pipefail

API="${1:-http://localhost:3010/api}"
# Las rutas de notificaciones exigen el token de administrador (cabecera X-Token-Admin).
TOKEN="${TOKEN_ADMIN:-$(grep -s '^TOKEN_ADMIN=' .env | cut -d= -f2-)}"
SUFIJO="$(date +%s)"
INICIO="$(date -u -d '+3 hours' +%Y-%m-%dT%H:00:00Z)"        # cita próxima (entra en la ventana de 24 h)
INICIO_CHOQUE="$(date -u -d '+3 hours' +%Y-%m-%dT%H:15:00Z)" # se cruza con la anterior
DESDE="$(date -u +%Y-%m-%dT00:00:00Z)"
HASTA="$(date -u -d '+2 days' +%Y-%m-%dT00:00:00Z)"

bonito() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(d),null,2))}catch{console.log(d)}})'; }
paso() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
llamar() { # metodo ruta [json]
  local respuesta codigo
  if [ $# -ge 3 ]; then
    # El JSON va por stdin: en Windows, curl convierte los argumentos a la página de códigos local y rompe los acentos.
    respuesta="$(printf '%s' "$3" | curl -s -w '\n%{http_code}' -X "$1" "$API$2" -H 'Content-Type: application/json; charset=utf-8' --data-binary @-)"
  else
    respuesta="$(curl -s -w '\n%{http_code}' -X "$1" "$API$2" -H "X-Token-Admin: $TOKEN")"
  fi
  codigo="${respuesta##*$'\n'}"
  echo "$1 $2 -> HTTP $codigo"
  printf '%s' "${respuesta%$'\n'*}" | bonito
}
enviar() { printf '%s' "$2" | curl -s -X POST "$API$1" -H 'Content-Type: application/json; charset=utf-8' --data-binary @-; }
campo() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).$1))"; }

paso "0. El servidor responde"
llamar GET /salud

paso "1. Requerimiento 1: registrar dueño, veterinario, mascota e historial médico"
PROP=$(enviar /propietarios "{\"nombre\":\"Ana López\",\"email\":\"ana$SUFIJO@correo.com\",\"telefono\":\"6621234567\"}")
echo "$PROP" | bonito; PROP_ID=$(echo "$PROP" | campo id)
VET=$(enviar /veterinarios "{\"nombre\":\"Dra. Ruiz\",\"email\":\"ruiz$SUFIJO@vetsync.mx\",\"especialidad\":\"Felinos\"}")
echo "$VET" | bonito; VET_ID=$(echo "$VET" | campo id)
MASC=$(enviar /mascotas "{\"propietarioId\":$PROP_ID,\"nombre\":\"Michi\",\"especie\":\"Gato\",\"fechaNacimiento\":\"2023-05-01\"}")
echo "$MASC" | bonito; MASC_ID=$(echo "$MASC" | campo id)
llamar POST "/mascotas/$MASC_ID/historial" "{\"veterinarioId\":$VET_ID,\"diagnostico\":\"Otitis leve\",\"tratamiento\":\"Gotas óticas 7 días\"}"
llamar GET "/mascotas/$MASC_ID/historial"

paso "2. Requerimiento 2: agendar cita y evitar choque de horario"
CITA=$(enviar /citas "{\"mascotaId\":$MASC_ID,\"veterinarioId\":$VET_ID,\"inicio\":\"$INICIO\",\"duracionMinutos\":30,\"motivo\":\"Revisión de oído\",\"modalidad\":\"TELEMEDICINA\"}")
echo "$CITA" | bonito; CITA_ID=$(echo "$CITA" | campo id)
echo "-- Intento de otra cita 15 minutos después con la misma veterinaria (debe dar 409):"
llamar POST /citas "{\"mascotaId\":$MASC_ID,\"veterinarioId\":$VET_ID,\"inicio\":\"$INICIO_CHOQUE\",\"duracionMinutos\":30,\"motivo\":\"Vacuna\"}"
echo "-- Intento de cita en el pasado (debe dar 400):"
llamar POST /citas "{\"mascotaId\":$MASC_ID,\"veterinarioId\":$VET_ID,\"inicio\":\"2020-01-01T10:00:00Z\",\"duracionMinutos\":30,\"motivo\":\"Vacuna\"}"
echo "-- Agenda de la veterinaria:"
llamar GET "/veterinarios/$VET_ID/agenda?desde=$DESDE&hasta=$HASTA"

paso "3. Requerimiento 3: recordatorio por correo (simulado) de la cita próxima"
llamar POST /notificaciones/recordatorios/ejecutar
llamar GET "/notificaciones?limite=1"
echo "-- Segunda ejecución: no reenvía (idempotente):"
llamar POST /notificaciones/recordatorios/ejecutar

paso "4. Cancelar la cita libera el horario"
llamar PATCH "/citas/$CITA_ID/cancelar"
llamar POST /citas "{\"mascotaId\":$MASC_ID,\"veterinarioId\":$VET_ID,\"inicio\":\"$INICIO_CHOQUE\",\"duracionMinutos\":30,\"motivo\":\"Vacuna\"}"
