"""ViewSets de ``apps.workdays``."""

from __future__ import annotations

from datetime import date
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.mixins import UpdateModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.catalogs.models import WorkdayType
from apps.users.models import WorkerProfile
from apps.users.permissions import IsMaestroOrAdminPlataforma
from apps.users.permissions import IsOrganizationMember
from apps.workdays.models import Workday
from apps.workdays.models import WorkerRate
from apps.workdays.serializers import WorkdaySerializer
from apps.workdays.serializers import WorkerRateSerializer
from apps.workdays.services import create_workday
from apps.workdays.services import create_worker_rate
from apps.workdays.services import update_workday


class _ScopedQsMixin:
    """Aplica for_organization en ``get_queryset``.

    Subclases deben definir ``_model`` y opcionalmente ``_via``.
    Los trabajadores (grupo "Trabajador") ven solo lo propio.
    """

    _model = None  # type: ignore[assignment]

    def get_queryset(self):
        qs = self._model.objects.all()
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if getattr(user, "is_admin_plataforma", False):
            return qs
        if user.organization_id is None:
            return qs.none()
        # Trabajador: solo lo suyo.
        if user.groups.filter(name="Trabajador").exists():
            worker_profile = getattr(user, "worker_profile", None)
            if worker_profile is None:
                return qs.none()
            qs = qs.filter(worker=worker_profile)
        else:
            qs = qs.filter(worker__user__organization_id=user.organization_id)
        return qs


class WorkdayViewSet(
    _ScopedQsMixin,
    ListModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
    GenericViewSet,
):
    _model = Workday

    serializer_class = WorkdaySerializer
    permission_classes = [IsOrganizationMember]
    http_method_names = ["get", "post", "patch", "delete"]
    filterset_fields = {
        "worker": ["exact"],
        "workday_type": ["exact"],
        "payment_status": ["exact"],
        "date": ["gte", "lte", "exact"],
    }
    ordering_fields = ["date", "created_at"]
    ordering = ["-date"]

    def get_permissions(self):
        # Escritura solo maestro/admin plataforma (incluido DELETE).
        if self.request.method in {"GET", "HEAD", "OPTIONS"}:
            return super().get_permissions()
        return [IsMaestroOrAdminPlataforma()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """POST /api/workdays/ — crea jornada llamando al servicio Fase B.

        Body:
            worker: id del WorkerProfile
            workday_type: id del WorkdayType
            date: ISO
            applied_rate: opcional (si no se pasa, el servicio calcula)
            notes: opcional
        """
        data = request.data
        worker_id = data.get("worker")
        workday_type_id = data.get("workday_type")
        if not worker_id or not workday_type_id:
            return Response(
                {"detail": "Campos 'worker' y 'workday_type' son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            worker = WorkerProfile.objects.get(id=worker_id)
        except WorkerProfile.DoesNotExist as exc:
            return Response(
                {"detail": str(exc) or "Trabajador no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            wd_type = WorkdayType.objects.get(id=workday_type_id)
        except WorkdayType.DoesNotExist as exc:
            return Response(
                {"detail": str(exc) or "Tipo de jornada no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Aislamiento: si el worker no pertenece a la org del caller (y no
        # es admin plataforma) → 404 para no filtrar información.
        if not getattr(request.user, "is_admin_plataforma", False):
            user_org = getattr(request.user, "organization_id", None)
            if worker.user.organization_id != user_org:
                return Response(
                    {"detail": "El trabajador no pertenece a tu organización."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        applied_rate = data.get("applied_rate")
        applied_rate_decimal: Decimal | None
        if applied_rate is None:
            applied_rate_decimal = None
        else:
            applied_rate_decimal = Decimal(str(applied_rate))

        wd = create_workday(
            worker=worker,
            workday_type=wd_type,
            date=date.fromisoformat(data["date"]),
            applied_rate=applied_rate_decimal,
            notes=data.get("notes", ""),
            created_by=request.user,
        )
        return Response(
            WorkdaySerializer(wd).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        wd = self.get_object()
        data = request.data
        workday_type = None
        if "workday_type" in data:
            workday_type = WorkdayType.objects.get(id=data["workday_type"])

        d = data.get("date")
        update_workday(
            workday=wd,
            workday_type=workday_type,
            date=date.fromisoformat(d) if d else None,
            notes=data.get("notes") if "notes" in data else None,
        )
        return Response(WorkdaySerializer(wd).data)

    def destroy(self, request, *args, **kwargs):
        from apps.workdays.services import delete_workday  # noqa: PLC0415

        wd = self.get_object()
        delete_workday(workday=wd)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk-mark")
    def bulk_mark(self, request):
        """``marcarDiaCompletoParaTodos`` atómico.

        Body: ``{"date": "YYYY-MM-DD", "workday_type_id": int,
        "worker_ids": [int, ...]}``. Una sola transacción; si algún
        trabajador falla, no se crea ninguno. Aislamiento: los workers
        deben pertenecer a la org del caller.
        """
        from apps.workdays.services import create_workday  # noqa: PLC0415

        try:
            target_date = date.fromisoformat(request.data["date"])
            wd_type_id = int(request.data["workday_type_id"])
            worker_ids = [int(x) for x in request.data["worker_ids"]]
        except (KeyError, TypeError, ValueError) as exc:
            return Response(
                {"detail": f"Payload inválido: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            try:
                wd_type = WorkdayType.objects.get(id=wd_type_id)
            except WorkdayType.DoesNotExist as exc:
                return Response(
                    {"detail": str(exc) or "Tipo de jornada no encontrado."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            workers = list(WorkerProfile.objects.filter(id__in=worker_ids))
            found_ids = {w.id for w in workers}
            missing = [wid for wid in worker_ids if wid not in found_ids]
            if missing:
                return Response(
                    {"detail": f"Trabajadores no encontrados: {missing}"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            denied = _ensure_workers_in_callers_org(request.user, workers)
            if denied is not None:
                return denied

            created_ids: list[int] = []
            for w in workers:
                wd = create_workday(
                    worker=w,
                    workday_type=wd_type,
                    date=target_date,
                    created_by=request.user,
                )
                created_ids.append(wd.id)

        return Response(
            {"created_ids": created_ids, "count": len(created_ids)},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="bulk-copy")
    def bulk_copy(self, request):
        """``repetirSemanaAnterior`` atómico.

        Body: ``{"from_start": "YYYY-MM-DD", "from_end": "YYYY-MM-DD",
        "to_start": "YYYY-MM-DD"}``. Copia cada jornada del rango origen
        a la posición relativa del rango destino, atómicamente.
        """
        from apps.workdays.services import create_workday  # noqa: PLC0415

        try:
            from_start = date.fromisoformat(request.data["from_start"])
            from_end = date.fromisoformat(request.data["from_end"])
            to_start = date.fromisoformat(request.data["to_start"])
        except (KeyError, TypeError, ValueError) as exc:
            return Response(
                {"detail": f"Payload inválido: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if from_end < from_start:
            return Response(
                {"detail": "from_end debe ser >= from_start."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            workdays = list(
                Workday.objects.filter(
                    date__gte=from_start,
                    date__lte=from_end,
                ),
            )
            denied = _ensure_workers_in_callers_org(
                request.user,
                [wd.worker for wd in workdays],
            )
            if denied is not None:
                return denied

            delta = (to_start - from_start).days
            created_ids: list[int] = []
            for wd in workdays:
                target_date = wd.date + timedelta(days=delta)
                # Si ya existe jornada en target, NO la creamos (no falla el lote).
                if Workday.objects.filter(
                    worker=wd.worker,
                    date=target_date,
                ).exists():
                    continue
                new_wd = create_workday(
                    worker=wd.worker,
                    workday_type=wd.workday_type,
                    date=target_date,
                    created_by=request.user,
                )
                created_ids.append(new_wd.id)

        return Response(
            {"created_ids": created_ids, "count": len(created_ids)},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="bulk-clear")
    def bulk_clear(self, request):
        """``limpiarSemana`` atómico.

        Body: ``{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}``. Borra las
        jornadas del rango que NO tengan pagos aplicados. Las que ya
        tengan pagos se saltan y se reportan; nunca se fuerzan.
        """

        try:
            start = date.fromisoformat(request.data["start"])
            end = date.fromisoformat(request.data["end"])
        except (KeyError, TypeError, ValueError) as exc:
            return Response(
                {"detail": f"Payload inválido: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if end < start:
            return Response(
                {"detail": "end debe ser >= start."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            workdays = list(
                Workday.objects.filter(
                    date__gte=start,
                    date__lte=end,
                ),
            )
            denied = _ensure_workers_in_callers_org(
                request.user,
                [wd.worker for wd in workdays],
            )
            if denied is not None:
                return denied

            deleted_ids: list[int] = []
            skipped_paid_ids: list[int] = []
            for wd in workdays:
                if _has_payments(wd):
                    skipped_paid_ids.append(wd.id)
                    continue
                deleted_ids.append(wd.id)
                wd.delete()

        return Response(
            {
                "deleted_ids": deleted_ids,
                "skipped_paid_ids": skipped_paid_ids,
                "deleted_count": len(deleted_ids),
                "skipped_count": len(skipped_paid_ids),
            },
            status=status.HTTP_200_OK,
        )


def _has_payments(workday: Workday) -> bool:
    """¿La jornada tiene ``PaymentWorkdayDetail`` de un pago NO anulado?"""
    from apps.payments.models import PaymentWorkdayDetail  # noqa: PLC0415

    return PaymentWorkdayDetail.objects.filter(
        workday=workday,
        payment__voided_at__isnull=True,
    ).exists()


def _ensure_workers_in_callers_org(user, workers):
    """404 si algún worker no es del caller (no leak).

    Devuelve un ``Response`` 404 listo para retornar, o ``None`` si OK.
    """
    if getattr(user, "is_admin_plataforma", False):
        return None
    user_org = getattr(user, "organization_id", None)
    for w in workers:
        if w.user.organization_id != user_org:
            from rest_framework import status as http_status  # noqa: PLC0415
            from rest_framework.response import Response  # noqa: PLC0415

            return Response(
                {"detail": "El trabajador no pertenece a tu organización."},
                status=http_status.HTTP_404_NOT_FOUND,
            )
    return None


class WorkerRateViewSet(
    _ScopedQsMixin,
    ListModelMixin,
    RetrieveModelMixin,
    GenericViewSet,
):
    _model = WorkerRate

    serializer_class = WorkerRateSerializer
    permission_classes = [IsMaestroOrAdminPlataforma]
    http_method_names = ["get", "post"]
    filterset_fields = {
        "worker": ["exact"],
        "valid_from": ["gte", "lte"],
        "valid_until": ["gte", "lte"],
    }
    ordering_fields = ["valid_from"]
    ordering = ["-valid_from"]

    def get_queryset(self):
        qs = super().get_queryset()
        worker_id = self.request.query_params.get("worker")
        if worker_id is not None:
            qs = qs.filter(worker_id=worker_id)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """POST /api/workday-rates/ — crea tarifa llamando al servicio."""
        data = request.data
        worker_id = data.get("worker")
        amount = data.get("amount")
        valid_from_str = data.get("valid_from")
        if not (worker_id and amount is not None and valid_from_str):
            return Response(
                {
                    "detail": (
                        "Campos 'worker', 'amount' y 'valid_from' son obligatorios."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            worker = WorkerProfile.objects.get(id=worker_id)
        except WorkerProfile.DoesNotExist as exc:
            return Response(
                {"detail": str(exc) or "Trabajador no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Aislamiento de body: si la org del worker no coincide (y no
        # eres admin plataforma) → 404.
        if not getattr(request.user, "is_admin_plataforma", False):
            if worker.user.organization_id != getattr(
                request.user,
                "organization_id",
                None,
            ):
                return Response(
                    {"detail": "El trabajador no pertenece a tu organización."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        try:
            rate = create_worker_rate(
                worker=worker,
                amount=Decimal(str(amount)),
                valid_from=date.fromisoformat(valid_from_str),
            )
        except __import__(
            "apps.workdays.exceptions",
            fromlist=["OverlappingRateError", "NoActiveRateError"],
        ).OverlappingRateError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            WorkerRateSerializer(rate).data,
            status=status.HTTP_201_CREATED,
        )


worker_rate_list = WorkerRateViewSet.as_view({"get": "list", "post": "create"})
workday_list = WorkdayViewSet.as_view({"get": "list", "post": "create"})
workday_detail = WorkdayViewSet.as_view(
    {
        "get": "retrieve",
        "patch": "partial_update",
        "delete": "destroy",
    },
)
