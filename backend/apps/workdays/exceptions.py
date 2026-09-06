"""Excepciones de dominio para la app ``workdays``."""

from __future__ import annotations


class WorkdaysError(Exception):
    """Base de las excepciones del dominio de jornadas."""


class WorkdayAlreadyPaidError(WorkdaysError):
    """Se intenta modificar / eliminar una jornada con pagos aplicados."""


class NoActiveRateError(WorkdaysError):
    """El trabajador no tiene tarifa vigente en la fecha de la jornada."""


class OverlappingRateError(WorkdaysError):
    """La nueva tarifa solapa con la vigente del trabajador."""
