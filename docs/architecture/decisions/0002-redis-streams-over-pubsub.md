# ADR 0002 — Redis Streams como bus interno de eventos

**Status:** Aceito  
**Data:** 2024

## Contexto

Os serviços do Edge precisam se comunicar de forma assíncrona e desacoplada. Avaliamos Redis Pub/Sub, Redis Streams e Kafka local.

## Decisão

Redis Streams com um stream por tipo de evento.

## Justificativa

- **Redis Pub/Sub descartado:** fire-and-forget sem persistência — se o ML Service reiniciar, perde mensagens acumuladas durante o downtime
- **Kafka local descartado:** overhead operacional desnecessário para comunicação intra-edge; Kafka reservado para o canal Edge → Central
- **Redis Streams:** persistência com consumer groups, replay, e backpressure natural; volume do edge (100 sensores) está muito abaixo dos limites do Redis

## Stream por tipo vs. stream único

Stream por tipo escolhido: cada serviço consome apenas o que precisa, sem filtrar por `event_type`. Adicionar novo consumidor = assinar o stream, sem alterar produtores.

## Consequências

- Redis é dependência crítica do edge — sua indisponibilidade para o fluxo de dados
- `maxmemory-policy noeviction` configurado para evitar perda silenciosa de mensagens
