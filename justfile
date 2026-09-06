export COMPOSE_FILE := "docker-compose.local.yml"

## Just does not yet manage signals for subprocesses reliably, which can lead to unexpected behavior.
## Exercise caution before expanding its usage in production environments.
## For more information, see https://github.com/casey/just/issues/2473 .


# Default command to list all available commands.
default:
    @just --list

# build: Build python image.
build *args:
    @echo "Building python image..."
    @docker compose -f docker-compose.local.yml build {{args}}

# up: Start up containers.
up:
    @echo "Starting up containers..."
    @docker compose -f docker-compose.local.yml up -d --remove-orphans

# down: Stop containers.
down:
    @echo "Stopping containers..."
    @docker compose -f docker-compose.local.yml down

# prune: Remove containers and their volumes.
prune *args:
    @echo "Killing containers and removing volumes..."
    @docker compose -f docker-compose.local.yml down -v {{args}}

# logs: View container logs
logs *args:
    @docker compose -f docker-compose.local.yml logs -f {{args}}

# manage: Executes `manage.py` command.
manage +args:
    @docker compose -f docker-compose.local.yml run --rm django python ./manage.py {{args}}

# manage-direct-db: Executes `manage.py` command directly connecting to postgres (bypasses pgbouncer).
# Use this for migrate, createsuperuser, and other commands that don't work through pgbouncer's pool_mode=transaction.
manage-direct-db +args:
    @PGB_POSTGRES_HOST=postgres PGB_POSTGRES_PORT=5432 docker compose -f docker-compose.local.yml run --rm django python ./manage.py {{args}}

# pytest: Run tests with pytest.
pytest *args:
    @docker compose -f docker-compose.local.yml run --rm django pytest {{args}}


# ==============================================================================
# PRUEBAS
# ==============================================================================
#
#   just test              -> backend + frontend (se detiene en el primer fallo)
#   just test backend      -> solo backend  (pytest en el contenedor django)
#   just test frontend     -> solo frontend (lint + build en el host)
#   just alltests          -> alias de `just test`
#
# Argumentos extra van al final y se pasan tal cual al runner:
#   just test backend -k token -x
#   just test frontend --no-fix
#
# Frontend todavía no tiene vitest; `test frontend` ejecuta lint + build.
# ==============================================================================

# test: Ejecuta las suites de pruebas. Objetivo: all | backend | frontend
test objetivo="all" *args:
    #!/usr/bin/env bash
    set -euo pipefail
    case "{{objetivo}}" in
        all)      just _test-all ;;
        backend)  just test-backend {{args}} ;;
        frontend) just test-frontend {{args}} ;;
        *)
            echo "Objetivo desconocido: '{{objetivo}}'" >&2
            echo "Usa: just test [all|backend|frontend] [args...]" >&2
            exit 2
            ;;
    esac

# alltests: Alias de `just test all`.
alltests:
    @just test all

# _test-all: Corre las dos suites en orden, deteniendose en el primer fallo.
_test-all:
    #!/usr/bin/env bash
    set -uo pipefail

    echo ""
    echo "=============================================="
    echo "  SUITE COMPLETA - JornalPro"
    echo "=============================================="

    echo ""
    echo ">> [1/2] BACKEND"
    if just test-backend; then
        echo "   backend OK"
    else
        echo "   backend FALLO - se detiene aqui, no se corre frontend." >&2
        exit 1
    fi

    echo ""
    echo ">> [2/2] FRONTEND"
    if just test-frontend; then
        echo "   frontend OK"
    else
        echo "   frontend FALLO" >&2
        exit 1
    fi

    echo ""
    echo "=============================================="
    echo "  TODAS LAS SUITES PASARON"
    echo "=============================================="

# test-backend: pytest dentro del contenedor django. Requiere postgres arriba.
test-backend *args:
    #!/usr/bin/env bash
    set -euo pipefail
    just _requiere-servicio postgres backend
    echo "-> pytest (contenedor django)"
    docker compose -f docker-compose.local.yml run --rm django pytest {{args}}

# test-frontend: lint + build en el host. No necesita contenedores.
test-frontend *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v pnpm >/dev/null 2>&1; then
        echo "ERROR: pnpm no esta instalado en el host." >&2
        echo "       Instalalo con: npm i -g pnpm   (o corepack enable)" >&2
        exit 1
    fi
    if [ ! -d frontend/node_modules ]; then
        echo "!! frontend/node_modules no existe. Instalando dependencias..."
        cd frontend && pnpm install --frozen-lockfile && cd ..
    fi
    echo "-> pnpm lint (host)"
    cd frontend && pnpm lint {{args}}
    echo "-> pnpm build (host)"
    cd frontend && pnpm build
    cd ..

# _requiere-servicio: Verifica que un servicio de compose este corriendo antes de probar.
_requiere-servicio servicio suite:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! docker compose -f docker-compose.local.yml ps --services --status running 2>/dev/null | grep -qx "{{servicio}}"; then
        echo "" >&2
        echo "ERROR: la suite '{{suite}}' necesita el servicio '{{servicio}}' corriendo." >&2
        echo "" >&2
        echo "  Servicios activos ahora:" >&2
        docker compose -f docker-compose.local.yml ps --services --status running 2>/dev/null | sed 's/^/    - /' >&2 || true
        echo "" >&2
        echo "  Levanta el stack con:  just up" >&2
        echo "" >&2
        exit 1
    fi


# ==============================================================================
# DOCUMENTACIÓN (Sphinx)
# ==============================================================================
#
#   just docs-build   -> genera la doc interactiva Sphinx en docs/_build/html
#   just docs-serve   -> sirve la doc en http://localhost:9000 (requiere stack)
#   just docs-clean   -> borra el build de Sphinx
#
# La fuente está en docs/ (raíz). arc42 vive en docs/arc42/ como Markdown
# hermano de la doc Sphinx; ambos describen la misma arquitectura y deben
# mantenerse sincronizados.
# ==============================================================================

# docs-build: Genera la documentación Sphinx estática.
docs-build:
    #!/usr/bin/env bash
    set -euo pipefail
    docker compose -f docker-compose.docs.yml run --rm docs sphinx-build -b html /docs /docs/_build/html

# docs-serve: Sirve la documentación en http://localhost:9000.
docs-serve:
    @docker compose -f docker-compose.docs.yml up -d docs

# docs-clean: Borra el build de Sphinx.
docs-clean:
    @rm -rf docs/_build


# ==============================================================================
# CI LOCAL
# ==============================================================================
#
#   just ci-local   -> reproduce los gates del pipeline local:
#                       1) pytest backend --create-db
#                       2) frontend lint + build
#                       Úsalo antes de abrir un PR para detectar el mismo
#                       tipo de fallos que vería el pipeline.
#
# Se ejecuta secuencial y se detiene en el primer fallo.
# ==============================================================================

ci-local:
    #!/usr/bin/env bash
    set -euo pipefail

    mkdir -p backend/logs

    just _requiere-servicio postgres backend

    echo ""
    echo ">> [1/2] BACKEND (pytest --create-db)"
    docker compose -f docker-compose.local.yml run --rm django pytest --create-db

    if ! command -v pnpm >/dev/null 2>&1; then
        echo "ERROR: pnpm no esta instalado en el host." >&2
        echo "       corepack enable   /   npm i -g pnpm" >&2
        exit 1
    fi

    echo ""
    echo ">> [2/2] FRONTEND (lint + build)"
    cd frontend
    pnpm install --frozen-lockfile
    pnpm lint
    pnpm build
    cd ..

    echo ""
    echo "=============================================="
    echo "  CI LOCAL EN VERDE — el PR debería pasar"
    echo "=============================================="
