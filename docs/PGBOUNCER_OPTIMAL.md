# PGBOUNCER_OPTIMAL — Configuración óptima recomendada

> **Estado actual:** la plantilla ya viene configurada con valores razonables.
> Este documento describe los valores **OPTIMAL** para entornos con carga
> mayor a la de demo. No modifica la plantilla — sólo documenta qué cambiar
> si se necesita escalar.

## 1. Configuración actual de la plantilla

Archivo: `backend/compose/production/pgbouncer/pgbouncer.ini.template`

```ini
[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction        # ✅ OPTIMAL: pooling a nivel de transacción
max_client_conn = 1000
default_pool_size = 80
min_pool_size = 30
reserve_pool_size = 10
reserve_pool_timeout = 5
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
admin_users = ${POSTGRES_USER}
```

Esta es ya una configuración sana para la mayoría de cargas pequeñas/medias.
`pool_mode = transaction` libera la conexión a Postgres al final de cada
transacción, lo que evita bloqueos entre clientes.

## 2. Configuración OPTIMAL (referencia)

Si necesitas escalar (más de ~50 usuarios concurrentes o > 1000 RPS), aplica
estos valores sobre `pgbouncer.ini.template` (NO en producción sin probar):

```ini
[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 200          # OPTIMAL: por debajo del límite del SO (ulimit -n)
default_pool_size = 20         # OPTIMAL: pool por (db, user). Ajustar a CPU/2
min_pool_size = 5              # OPTIMAL: mantener conexiones cálidas
reserve_pool_size = 5          # OPTIMAL: para picos
reserve_pool_timeout = 3
server_reset_query = DEALLOCATE ALL  # OPTIMAL: libera prepared statements
server_reset_query_always = 1        # OPTIMAL: ejecutar SIEMPRE al liberar
ignore_startup_parameters = extra_float_digits, search_path, application_name
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
admin_users = ${POSTGRES_USER}
stats_period = 60
```

## 3. Postgres — parámetros OPTIMAL

Para Postgres 18 (versión actual de la plantilla), `shared_buffers` y
`work_mem` deben ajustarse según la RAM disponible del host. La plantilla
NO los pasa explícitamente, así que Postgres usa defaults.

Si quieres ajustar, modifica `docker-compose.local.yml` (sólo entorno local)
o el comando de arranque en producción:

```yaml
postgres:
  command: postgres \
    -c shared_buffers=256MB \
    -c work_mem=4MB \
    -c statement_timeout=60s \
    -c idle_in_transaction_session_timeout=30s \
    -c log_min_duration_statement=250ms
```

| Parámetro | Default Postgres 18 | OPTIMAL demo | OPTIMAL prod (4GB RAM) |
|-----------|---------------------|--------------|------------------------|
| `shared_buffers` | 128MB | 256MB | 1GB |
| `work_mem` | 4MB | 4MB | 16MB |
| `statement_timeout` | 0 (sin límite) | 60s | 30s |
| `idle_in_transaction_session_timeout` | 0 | 30s | 15s |

> **Por qué esto importa:** pgbouncer con `pool_mode = transaction`
> devuelve la conexión a Postgres al final de cada transacción, pero si el
> cliente deja una transacción abierta (bug), la conexión queda retenida
> hasta `idle_in_transaction_session_timeout`. Sin ese timeout, una
> transacción colgada puede agotar el pool.

## 4. Cómo verificar el estado actual

```bash
# Ver config activa de pgbouncer
docker exec jornal_pro_trabajadores_local_pgbouncer \
  psql -p 6432 -U ${POSTGRES_USER} -d pgbouncer -c "SHOW POOL_MODE; SHOW POOLS;"

# Ver conexiones activas
docker exec jornal_pro_trabajadores_local_pgbouncer \
  psql -p 6432 -U ${POSTGRES_USER} -d pgbouncer -c "SHOW STATS;"

# Ver parámetros de Postgres
docker exec jornal_pro_trabajadores_local_postgres \
  psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} \
  -c "SHOW shared_buffers; SHOW work_mem; SHOW statement_timeout;"
```

## 5. Riesgos y trade-offs

- **`statement_timeout` muy bajo** puede romper migraciones largas. Si vas
  a aplicar migraciones, sube temporalmente el valor a 0 (sin límite).
- **`pool_mode = transaction`** desactiva `PREPARE`/`DEALLOCATE` que
  sobreviven al COMMIT. Si tu app usa prepared statements extensivamente,
  considera `pool_mode = session`.
- **`pgbouncer` + Django `ATOMIC_REQUESTS`**: la plantilla usa
  `ATOMIC_REQUESTS = True`, lo que envuelve cada request HTTP en una
  transacción. Con `pool_mode = transaction`, esto está OK: cada request
  toma y devuelve una conexión.
