Documentación de JornalPro
==========================

Documentación auto-generada de la API, modelos y guías del proyecto.

.. toctree::
   :maxdepth: 2
   :caption: Contenido:

   howto
   users


Documentación complementaria (Markdown)
--------------------------------------

Estos archivos viven junto a este directorio y NO son generados por
Sphinx; se mantienen manualmente:

- ``arc42/`` — Arquitectura arc42 (12 secciones en Markdown).
- ``SETUP_NOTES.md`` — Bugs resueltos / pendientes del setup.
- ``jornalpro-django-models.md`` — MER de los modelos Django.
- ``PGBOUNCER_OPTIMAL.md`` — Tuning de pgbouncer para producción.

.. note::

   arc42 y esta doc Sphinx describen la misma arquitectura. Si cambias
   un bloque, los modelos o un endpoint, actualiza AMBOS. La
   "single source of truth" para modelos de Django es
   ``backend/apps/<app>/models.py``; arc42/Sphinx se generan desde ahí.


Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`