#!/bin/sh
set -e

if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ]; then
    echo "Error: POSTGRES_USER and POSTGRES_PASSWORD environment variables are required"
    exit 1
fi

echo "Generating userlist.txt from template..."
envsubst < /etc/pgbouncer/userlist.template.txt > /etc/pgbouncer/userlist.txt
envsubst < /etc/pgbouncer/pgbouncer.ini.template > /etc/pgbouncer/pgbouncer.ini
chmod 600 /etc/pgbouncer/userlist.txt

echo "Generated userlist.txt content:"
cat /etc/pgbouncer/userlist.txt

echo "Starting PgBouncer..."

exec "$@"
