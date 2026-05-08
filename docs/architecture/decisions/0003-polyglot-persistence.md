# ADR 0003 — Persistência Poliglota (InfluxDB + PostgreSQL)

**Status:** Aceito  
**Data:** 2024

## Contexto

O sistema armazena dois tipos de dados com naturezas fundamentalmente diferentes.

## Decisão

InfluxDB para leituras de sensores. PostgreSQL para dados relacionais e operacionais.

## Justificativa

**InfluxDB:**
- Leituras de sensor são fatos históricos imutáveis com timestamp
- Range queries por tempo são o padrão de acesso dominante
- Batch writes nativos para suportar 100 sensores em stress test
- TimescaleDB seria alternativa válida, mas adiciona extensão ao Postgres

**PostgreSQL:**
- Devices, usuários, thresholds, alertas e comandos têm semântica relacional
- Requerem consistência transacional (ex: criar alerta e atualizar status atomicamente)
- Joins entre entidades são frequentes

## Consequências

- persistence-service é o único dono de ambos os bancos
- Outros serviços com necessidade de leitura relacional (thresholds) acessam o Postgres diretamente — ver ADR 0004
