"""Exception handler DRF para JornalPro.

Mapea excepciones de dominio (Fase B) y de permisos a respuestas HTTP
consistentes:

- ``CrossOrganizationError`` → **404** (no filtramos información).
- ``WorkdayAlreadyPaidError`` → **409 Conflict**.
- ``PaymentAlreadyVoidedError`` → **409 Conflict**.
- ``LoanOverpaymentError`` → **400 Bad Request**.
- ``OverpaymentError`` → **400 Bad Request**.
- ``InconsistentPaymentTotalError`` → **500 Internal Server Error**
  (corrupción de BD detectada, alertar).
- ``NoActiveRateError`` / ``OverlappingRateError`` → **400 Bad Request**.
- ``PermissionDenied`` (DRF) → **403**.
- ``Http404`` → **404**.
- ``IntegrityError`` (unique_together) → **409 Conflict**.
- Cualquier otro ``APIException`` → comportamiento por defecto.

El cuerpo siempre es ``{"detail": "<mensaje>"}`` (formato DRF estándar).
"""

from __future__ import annotations

import logging

from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from apps.payments.exceptions import CrossOrganizationError
from apps.payments.exceptions import InconsistentPaymentTotalError
from apps.payments.exceptions import LoanOverpaymentError
from apps.payments.exceptions import OverpaymentError
from apps.payments.exceptions import PaymentAlreadyVoidedError
from apps.workdays.exceptions import NoActiveRateError
from apps.workdays.exceptions import OverlappingRateError
from apps.workdays.exceptions import WorkdayAlreadyPaidError

logger = logging.getLogger(__name__)


# Mapa dominio → status.
# 409 Conflict: estado del recurso no permite la operación (loan ya
# saldado, pago ya voided, pago excede tarifa, etc.).
# 400 Bad Request: payload mal formado o entrada inválida.
# 404 Not Found: intento de acceso cross-organization (no leak).
_DOMAIN_STATUS = {
    CrossOrganizationError: status.HTTP_404_NOT_FOUND,
    WorkdayAlreadyPaidError: status.HTTP_409_CONFLICT,
    PaymentAlreadyVoidedError: status.HTTP_409_CONFLICT,
    LoanOverpaymentError: status.HTTP_409_CONFLICT,
    OverpaymentError: status.HTTP_409_CONFLICT,
    NoActiveRateError: status.HTTP_400_BAD_REQUEST,
    OverlappingRateError: status.HTTP_400_BAD_REQUEST,
    InconsistentPaymentTotalError: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


def _domain_status(exc: Exception):
    for cls, code in _DOMAIN_STATUS.items():
        if isinstance(exc, cls):
            return code
    return None


def journalpro_exception_handler(exc, context):
    """Punto de entrada: envuelve al handler por defecto de DRF."""
    code = _domain_status(exc)
    if code is not None:
        # ``InconsistentPaymentTotalError`` se loggea para investigación
        # operacional porque significa posible corrupción de BD.
        if code == status.HTTP_500_INTERNAL_SERVER_ERROR:
            logger.exception("InconsistentPaymentTotalError detectado: %s", exc)
        return Response({"detail": str(exc)}, status=code)

    if isinstance(exc, IntegrityError):
        # Constraints (unique_together) chocadas por concurrencia o
        # por bug. 409 Conflict.
        return Response(
            {"detail": str(exc) or "Conflicto de integridad en la base de datos."},
            status=status.HTTP_409_CONFLICT,
        )

    if isinstance(exc, Http404):
        return Response({"detail": str(exc) or "No encontrado."}, status=status.HTTP_404_NOT_FOUND)  # noqa: E501

    if isinstance(exc, APIException):
        return drf_exception_handler(exc, context)

    # Si no es APIException ni algo conocido, devolvemos 500 vía DRF.
    logger.exception("Excepción no manejada en API: %r", exc)
    return drf_exception_handler(exc, context)
