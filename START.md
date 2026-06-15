# START.md — Guía para renombrar plantilla-django-react

Esta guía te ayuda a renombrar `plantilla-django-react` a tu nuevo proyecto en **5-10 minutos**.

---

## 0. Pre-requisitos

Define 3 variantes de tu nombre de proyecto:

| Variante | Valor ejemplo |
|----------|---------------|
| **kebab** (Docker, URL) | `mi-proyecto` |
| **snake** (Python, variables) | `mi_proyecto` |
| **Title** (humano) | `Mi Proyecto` |

---

## 1. Find-and-replace global

Ejecuta este comando desde la raíz del proyecto (reemplaza `mi-proyecto` y `mi_proyecto` con tus valores):

```bash
find . -type f \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  -not -path './.venv/*' \
  -not -path './**/__pycache__/*' \
  -not -path './dist/*' \
  -not -path './planes/*' \
  -not -path './.serena/*' \
  -not -path './.opencode/*' \
  -not -path './.claude/*' \
  -exec sed -i 's/plantilla-django-react/mi-proyecto/g' {} \; \
  -exec sed -i 's/plantilla_django_react/mi_proyecto/g' {} \;
```

---

## 2. Cambios manuales post-find-and-replace

### 2.1 Mover directorio de la app Django

```bash
mv backend/plantilla_django_react backend/mi_proyecto
```

### 2.2 Verificar `pyproject.toml`

En `backend/pyproject.toml`, verifica que `name` y el `include` de `tool.coverage.run` se actualizaron correctamente.

### 2.3 Verificar `celery_app.py`

En `backend/config/celery_app.py`, verifica que el nombre del broker sea correcto (debe coincidir con `mi_proyecto`).

### 2.4 Volúmenes Docker

En los 3 archivos `docker-compose.*.yml`, verifica que los nombres de volumenes se actualizaron:
- `plantilla_django_react_local_*` → `mi_proyecto_local_*`
- `production_django_*` → `mi_proyecto_django_*`

### 2.5 Dominio

En `backend/.envs/.production/.django`, cambia:
- `DJANGO_ALLOWED_HOSTS=.plantilla.yoyodr.dev` → `.mi-dominio.com`
- `DJANGO_CORS_ALLOWED_ORIGINS=https://plantilla.yoyodr.dev` → `https://mi-dominio.com`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://plantilla.yoyodr.dev` → `https://mi-dominio.com`

### 2.6 `frontend/package.json`

Verifica que `name` se actualizó a `mi-proyecto`.

### 2.7 Regenerar `DJANGO_SECRET_KEY`

Genera una nueva clave segura:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Actualiza `DJANGO_SECRET_KEY` en:
- `backend/.envs/.local/.django`
- `backend/.envs/.production/.django`

### 2.8 `POSTGRES_DB` y password

En `backend/.envs/.local/.postgres` y `backend/.envs/.production/.postgres`:
- `POSTGRES_DB=mi_proyecto`
- Cambia `POSTGRES_PASSWORD` a un password seguro

### 2.9 Reescribir `README.md`

Borra o reescribe el `README.md` con la información de tu proyecto.

### 2.10 `backend/.gitignore`

Verifica que la línea `<project_snake>/media/` esté correcta.

### 2.11 Ocultar `.envs/` del repo

En `backend/.gitignore`, **descomenta** las 2 líneas del bloque "PLANTILLA BASE":

```gitignore
.envs/*
!.envs/.local/
```

Por que: en este repo base las `.envs/` estan comentadas a proposito
para que se commiteen y un dev que clona la plantilla vea que variables
existen. En un proyecto real nunca debes commitear `DJANGO_SECRET_KEY`,
`POSTGRES_PASSWORD`, `RESEND_API_KEY` ni ninguna credencial.

Despues de descomentar:

```bash
# Verifica que el .envs/.production/ ya no se trackea
git rm --cached -r backend/.envs/.production/
git status  # .envs/.production/ debe aparecer como ignored
```

### 2.12 Regenerar `uv.lock`

```bash
cd backend && uv lock
```

---

## 3. Apps Django internas

Esta plantilla incluye las siguientes apps Django:

| App | Descripción |
|-----|-------------|
| `users` | Modelo User con allauth + MFA |
| `custom_auth` | SimpleJWT: login, refresh, logout |

**Cómo añadir nuevas apps:**

```bash
cd backend
python manage.py startapp mi_app
# Luego añade a LOCAL_APPS en config/settings/base.py:
# "mi_proyecto.mi_app",
```

---

## 4. Verificación post-rename

Ejecuta estos comandos para confirmar que todo funciona:

```bash
# 1. Verificar que no quedan residuos de "plantilla"
grep -r "plantilla" --include="*.py" --include="*.js" --include="*.yml" backend/ frontend/ . | grep -v ".git" | grep -v "planes" | grep -v "START.md"

# 2. Verificar que Django arranca
cd backend && python manage.py check

# 3. Verificar que el compose es válido
docker compose -f docker-compose.local.yml config --quiet

# 4. Crear superusuario
just manage-direct-db createsuperuser

# 5. Login en navegador
# Abre http://localhost:5173 y verifica que el login funciona
```

---

## 5. Limpieza opcional

Después de verificar que todo funciona, puedes borrar:

```bash
rm START.md
rm -rf planes/
rm -rf .serena/
rm -rf .opencode/
rm -rf .claude/
```

---

## 6. Checklist final

- [ ] `grep -r "plantilla" backend/ frontend/` devuelve vacío (excepto archivos de docs)
- [ ] `docker compose -f docker-compose.local.yml config --quiet` pasa sin errores
- [ ] `docker compose -f docker-compose.production.yml config --quiet` pasa sin errores
- [ ] `docker compose -f docker-compose.dokploy.yml config --quiet` pasa sin errores
- [ ] `python manage.py check` pasa sin errores
- [ ] `uv lock` se ejecutó sin errores
- [ ] `DJANGO_SECRET_KEY` es nuevo y seguro
- [ ] `POSTGRES_DB` y `POSTGRES_PASSWORD` están actualizados
- [ ] `DJANGO_ALLOWED_HOSTS` apunta al dominio correcto
- [ ] `frontend/package.json` tiene el nombre correcto
- [ ] `just manage-direct-db createsuperuser` funciona
- [ ] Login en http://localhost:5173 funciona con el superusuario creado
- [ ] `.envs/*` esta descomentado en `backend/.gitignore` y `git rm --cached` aplicado
