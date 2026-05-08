# ADR 0005 — Mosquitto como processo independente do Edge Server

**Status:** Aceito  
**Data:** 2024

## Contexto

O broker MQTT poderia rodar embutido no processo NestJS (ex: Aedes) ou como processo separado.

## Decisão

Mosquitto como container independente.

## Justificativa

- Sensores permanecem conectados mesmo durante restart dos serviços de aplicação
- Mosquitto é battle-tested para dezenas a milhares de conexões simultâneas
- Separação de ciclo de vida: broker tem uptime diferente dos serviços
- Aedes (broker Node.js) não é recomendado para uso em produção com múltiplos devices

## Consequências

- Um componente a mais para operar — mas Mosquitto tem footprint mínimo (~2MB RAM)
- Health check dos serviços NestJS depende do Mosquitto estar healthy
