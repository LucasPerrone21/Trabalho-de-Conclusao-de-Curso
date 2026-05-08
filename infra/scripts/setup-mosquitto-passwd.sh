#!/bin/bash
# =============================================================================
# Setup de senhas do Mosquitto
# Execute depois de subir os containers: ./scripts/setup-mosquitto-passwd.sh
# =============================================================================

set -e

# Carrega variáveis do .env
if [ ! -f "../.env" ]; then
  echo "Erro: arquivo .env não encontrado em infra/.env"
  echo "Execute: cp .env.example .env e preencha as variáveis"
  exit 1
fi

source ../.env

echo "Configurando usuários do Mosquitto..."

# Cria o arquivo com o primeiro usuário (-c sobrescreve se existir)
docker exec edge-mosquitto mosquitto_passwd -b -c \
  /mosquitto/config/passwd \
  "$MQTT_EDGE_USERNAME" \
  "$MQTT_EDGE_PASSWORD"

# Adiciona simulador
docker exec edge-mosquitto mosquitto_passwd -b \
  /mosquitto/config/passwd \
  "$MQTT_SIM_USERNAME" \
  "$MQTT_SIM_PASSWORD"

# Adiciona usuário de healthcheck
docker exec edge-mosquitto mosquitto_passwd -b \
  /mosquitto/config/passwd \
  "healthcheck-user" \
  "healthcheck-pass"

# Recarrega configuração do Mosquitto
docker exec edge-mosquitto kill -HUP 1

echo "Mosquitto configurado com sucesso."
echo "Usuários criados: $MQTT_EDGE_USERNAME, $MQTT_SIM_USERNAME, healthcheck-user"
