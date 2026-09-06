"""Excepciones de dominio para la app ``payments``."""

from __future__ import annotations


class PaymentsError(Exception):
    """Base de las excepciones del dominio de pagos y préstamos."""


class OverpaymentError(PaymentsError):
    """El monto aplicado a una jornada excede su ``applied_rate``."""


class LoanOverpaymentError(PaymentsError):
    """El abono a un préstamo excede su ``outstanding_balance``."""


class InconsistentPaymentTotalError(PaymentsError):
    """La suma real de los detalles NO coincide con ``payment.total_amount``.

    Detectada al releer el agregado desde la BD: si la suma de los detalles
    (``PaymentWorkdayDetail.applied_amount`` + ``PaymentLoanDetail.paid_amount``)
    difiere de ``payment.total_amount``, se asume corrupción y se rechaza
    el pago (no se persiste la operación que estamos cancelando).
    """


class PaymentAlreadyVoidedError(PaymentsError):
    """Se intenta anular un pago que ya fue anulado."""


class CrossOrganizationError(PaymentsError):
    """Se intenta mezclar entidades (jornadas/préstamos) de organizaciones distintas."""
