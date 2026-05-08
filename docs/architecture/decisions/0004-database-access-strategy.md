# ADR 0004 — Estratégia de acesso aos bancos de dados

**Status:** Aceito  
**Data:** 2024

## Contexto

Com persistência poliglota, precisávamos decidir se apenas o persistence-service acessa os bancos, ou se outros serviços podem acessar diretamente.

## Opções avaliadas

**A) persistence-service como único dono — outros consultam via evento**  
Mais puro: notification-service publica `config.query` e aguarda resposta.  
Descartado: latência e complexidade desnecessárias para uma query de threshold.

**B) Acesso direto com responsabilidade documentada** ← escolhido  
Cada serviço declara explicitamente quais tabelas acessa e com qual permissão.

## Decisão

Serviços podem acessar o Postgres diretamente para leitura de dados de configuração. Escrita é exclusiva do persistence-service.

| Serviço               | Acesso Postgres           | Acesso InfluxDB |
|-----------------------|---------------------------|-----------------|
| persistence-service   | read/write (dono)         | read/write      |
| notification-service  | read (thresholds, devices)| —               |
| actuator-service      | —                         | —               |
| ml-service            | —                         | —               |
| ingest-service        | —                         | —               |

## Consequências

- Mudança no schema do Postgres pode impactar notification-service além do persistence-service
- Mitigação: camada de repositório clara em cada serviço isola o acoplamento ao schema
