FROM edoburu/pgbouncer:v1.24.1-p1

USER root

RUN apk add --no-cache gettext \
    && addgroup -S pgbouncer \
    && adduser -S -G pgbouncer pgbouncer

COPY ./compose/production/pgbouncer/pgbouncer.ini.template /etc/pgbouncer/pgbouncer.ini.template
COPY ./compose/production/pgbouncer/userlist.template.txt /etc/pgbouncer/userlist.template.txt
COPY ./compose/production/pgbouncer/entrypoint.sh /entrypoint-custom.sh

RUN chmod +x /entrypoint-custom.sh
RUN chown -R pgbouncer:pgbouncer /etc/pgbouncer
RUN mkdir -p /var/log/pgbouncer
RUN chown pgbouncer:pgbouncer /var/log/pgbouncer
RUN mkdir -p /var/run/pgbouncer
RUN chown pgbouncer:pgbouncer /var/run/pgbouncer

USER pgbouncer
EXPOSE 5432
ENTRYPOINT ["/entrypoint-custom.sh"]
CMD ["pgbouncer", "/etc/pgbouncer/pgbouncer.ini"]
