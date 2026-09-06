"""
With these settings, tests run faster.
"""

from .base import *  # noqa: F403
from .base import TEMPLATES
from .base import env

# GENERAL
# ------------------------------------------------------------------------------
# https://docs.djangoproject.com/en/dev/ref/settings/#secret-key
SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="GyqXsEHaJfYbjH61YasdroNFadsIeJ507UxV0eUWSJi2VHAHKiLsjqkAnRourKle",
)
# https://docs.djangoproject.com/en/dev/ref/settings/#test-runner
TEST_RUNNER = "django.test.runner.DiscoverRunner"

# DATABASE OVERRIDE — direct postgres, pgbouncer fuera de los tests
# ------------------------------------------------------------------------------
# pgbouncer en ``pool_mode=transaction`` no soporta ``CREATE DATABASE``
# ni ``DROP DATABASE``, necesarios para crear / destruir la base de
# tests. pytest-django se conecta por aquí. Sobreescribimos el dict
# heredado de base.py para apuntar directo al postgres del compose,
# pasando por alto pgbouncer (que sí sigue siendo el gateway en runtime).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": env("POSTGRES_HOST", default="postgres"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "NAME": env("POSTGRES_DB", default="jornal_pro_trabajadores"),
        "USER": env("POSTGRES_USER", default="debug"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="debug"),
        "TEST": {
            "NAME": "test_jornal_pro_trabajadores",
        },
        "ATOMIC_REQUESTS": False,
    },
}

# PASSWORDS
# ------------------------------------------------------------------------------
# https://docs.djangoproject.com/en/dev/ref/settings/#password-hashers
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# EMAIL
# ------------------------------------------------------------------------------
# https://docs.djangoproject.com/en/dev/ref/settings/#email-backend
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# DEBUGGING FOR TEMPLATES
# ------------------------------------------------------------------------------
TEMPLATES[0]["OPTIONS"]["debug"] = True  # type: ignore[index]

# MEDIA
# ------------------------------------------------------------------------------
# https://docs.djangoproject.com/en/dev/ref/settings/#media-url
MEDIA_URL = "http://media.testserver/"
# Your stuff...
# ------------------------------------------------------------------------------
