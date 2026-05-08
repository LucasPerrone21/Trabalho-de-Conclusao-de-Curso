# ADR 0001 — Monorepo para o Edge Server

**Status:** Aceito  
**Data:** 2024

## Contexto

O sistema é composto por múltiplos serviços que se comunicam via Redis Streams. Precisávamos decidir entre monorepo e multirepo.

## Decisão

Monorepo único para todos os serviços do Edge Server, incluindo simulador e infra.

## Justificativa

- Mudanças de contrato (schemas de eventos) impactam múltiplos serviços — um único PR mantém consistência
- Uma pessoa desenvolve todos os serviços — overhead de troca de contexto entre repos não tem benefício
- `docker compose up` único para subir todo o ambiente

## Consequências

- Repositório do servidor central fica separado — são sistemas com ciclos de vida distintos
