"""ViewSets para ``apps.payments``."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.payments.models import Loan
from apps.payments.models import Payment
from apps.payments.services import LoanAllocation
from apps.payments.services import create_loan
from apps.payments.services import preview_payment
from apps.payments.services import register_payment
from apps.payments.services import void_payment
from apps.payments.services import worker_balance
from apps.users.permissions import IsMaestroOrAdminPlataforma
from apps.users.permissions import IsOrganizationMember

# Serializers inlined -----------------------------------------------


class LoanSerializer(drf_serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = [
            "id",
            "worker",
            "status",
            "amount",
            "outstanding_balance",
            "date",
            "reason",
            "created_by",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "outstanding_balance",
            "status",
            "created_by",
            "created_at",
        ]


class LoanAllocationField(drf_serializers.DictField):
    """``{loan_id: amount}`` para asignar abonos a préstamos por id."""

    def to_internal_value(self, data):
        out = {}
        for k, v in data.items():
            try:
                loan_id = int(k)
            except (TypeError, ValueError) as exc:
                msg = f"loan_id inválido: {k!r}"
                raise drf_serializers.ValidationError(
                    msg,
                ) from exc
            try:
                amount = Decimal(str(v))
            except (TypeError, ValueError) as exc:
                msg = f"amount inválido para loan {loan_id}: {v!r}"
                raise drf_serializers.ValidationError(
                    msg,
                ) from exc
            out[loan_id] = amount
        return out


class LoanAllocationInputSerializer(drf_serializers.Serializer):
    loan = drf_serializers.IntegerField()
    amount = drf_serializers.DecimalField(max_digits=10, decimal_places=2)


class RegisterPaymentSerializer(drf_serializers.Serializer):
    """Body para POST /api/payments/.

    Acepta:
        worker (int), payment_method (int), payment_date (ISO),
        workday_ids (list[int]), loan_allocations (list[{loan, amount}]),
        workday_overrides (dict[int, Decimal] opcional).
    """

    worker = drf_serializers.IntegerField()
    payment_method = drf_serializers.IntegerField()
    payment_date = drf_serializers.DateField()
    workday_ids = drf_serializers.ListField(
        child=drf_serializers.IntegerField(),
        required=False,
        default=list,
    )
    loan_allocations = drf_serializers.ListField(
        child=LoanAllocationInputSerializer(),
        required=False,
        default=list,
    )
    workday_overrides = drf_serializers.DictField(
        child=drf_serializers.DecimalField(max_digits=10, decimal_places=2),
        required=False,
        default=dict,
    )


class PaymentDetailSerializer(drf_serializers.ModelSerializer):
    """Payload de respuesta del POST/GET de Payment.

    NO expone ``voided_by``, ``voided_at`` si está anulado, ni nada sensible.
    """

    class Meta:
        model = Payment
        fields = [
            "id",
            "worker",
            "payment_method",
            "total_amount",
            "payment_date",
            "notes",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class VoidInputSerializer(drf_serializers.Serializer):
    confirm = drf_serializers.BooleanField(required=False, default=True)


# Helpers --------------------------------------------------------------


def _ensure_worker_in_callers_org(user, worker):
    """404 si el worker no es del caller (no 403)."""
    if not getattr(user, "is_admin_plataforma", False):
        user_org = getattr(user, "organization_id", None)
        if worker.user.organization_id != user_org:
            return Response(
                {"detail": "El trabajador no pertenece a tu organización."},
                status=status.HTTP_404_NOT_FOUND,
            )
    return None


# ViewSets -------------------------------------------------------------


class _ScopedQsMixin:
    _model = None  # type: ignore[assignment]
    _via_worker_id = False  # Workday/Loan/Payment: filtran por ``worker__user__organization_id``.  # noqa: E501

    def get_queryset(self):
        qs = self._model.objects.all()
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if getattr(user, "is_admin_plataforma", False):
            return qs
        if user.organization_id is None:
            return qs.none()
        if self._via_worker_id:
            return qs.filter(worker__user__organization_id=user.organization_id)
        if hasattr(self._model, "user"):
            return qs.filter(user__organization_id=user.organization_id)
        return qs.none()


class LoanViewSet(
    _ScopedQsMixin,
    ListModelMixin,
    RetrieveModelMixin,
    GenericViewSet,
):
    _model = Loan
    _via_worker_id = True

    serializer_class = LoanSerializer
    permission_classes = [IsOrganizationMember]
    http_method_names = ["get", "post"]
    filterset_fields = {
        "worker": ["exact"],
        "status": ["exact"],
        "date": ["gte", "lte"],
    }
    ordering_fields = ["date", "created_at"]
    ordering = ["-date"]

    def get_permissions(self):
        if self.request.method in {"GET", "HEAD", "OPTIONS"}:
            return super().get_permissions()
        return [IsMaestroOrAdminPlataforma()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """POST /api/loans/ — crea préstamo llamando al servicio."""
        s = LoanSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        from apps.users.models import WorkerProfile  # noqa: PLC0415

        try:
            worker = WorkerProfile.objects.get(id=data["worker"].id)
        except WorkerProfile.DoesNotExist as exc:
            return Response(
                {"detail": str(exc) or "Trabajador no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        denied = _ensure_worker_in_callers_org(request.user, worker)
        if denied is not None:
            return denied

        loan = create_loan(
            worker=worker,
            amount=data["amount"],
            date=data["date"],
            reason=data.get("reason", ""),
            created_by=request.user,
        )
        return Response(
            LoanSerializer(loan).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentViewSet(
    _ScopedQsMixin,
    ListModelMixin,
    RetrieveModelMixin,
    GenericViewSet,
):
    _model = Payment
    _via_worker_id = True

    serializer_class = PaymentDetailSerializer
    permission_classes = [IsOrganizationMember]
    http_method_names = ["get", "post"]
    filterset_fields = {
        "worker": ["exact"],
        "payment_method": ["exact"],
        "payment_date": ["gte", "lte", "exact"],
        "voided_at": ["isnull"],
    }
    ordering_fields = ["payment_date", "created_at"]
    ordering = ["-payment_date"]

    def get_permissions(self):
        if self.request.method in {"GET", "HEAD", "OPTIONS"}:
            return super().get_permissions()
        return [IsMaestroOrAdminPlataforma()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """POST /api/payments/ — registra pago llamando al servicio."""
        s = RegisterPaymentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        from apps.catalogs.models import PaymentMethod  # noqa: PLC0415
        from apps.users.models import WorkerProfile  # noqa: PLC0415

        try:
            worker = WorkerProfile.objects.get(id=data["worker"])
        except WorkerProfile.DoesNotExist as exc:
            return Response(
                {"detail": str(exc) or "Trabajador no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        denied = _ensure_worker_in_callers_org(request.user, worker)
        if denied is not None:
            return denied
        try:
            payment_method = PaymentMethod.objects.get(id=data["payment_method"])
        except PaymentMethod.DoesNotExist as exc:
            return Response(
                {"detail": str(exc) or "Método de pago no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Loan allocations: traer Loan por id.
        allocs = []
        for la in data["loan_allocations"]:
            try:
                ln = Loan.objects.get(id=la["loan"])
            except Loan.DoesNotExist as exc:
                return Response(
                    {"detail": str(exc) or f"Préstamo {la['loan']} no encontrado."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            allocs.append(LoanAllocation(loan=ln, amount=la["amount"]))

        payment = register_payment(
            worker=worker,
            payment_method=payment_method,
            payment_date=data["payment_date"],
            workday_ids=data["workday_ids"],
            loan_allocations=allocs,
            created_by=request.user,
            workday_overrides={
                int(k): v for k, v in (data.get("workday_overrides") or {}).items()
            },
        )
        return Response(
            PaymentDetailSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsMaestroOrAdminPlataforma],
        url_path="void",
    )
    def void(self, request, pk=None):
        payment = self.get_object()
        void_payment(payment=payment, voided_by=request.user)
        return Response(
            PaymentDetailSerializer(payment).data,
            status=status.HTTP_200_OK,
        )


class WorkerBalanceView(APIView):
    """GET /api/workers/{id}/balance/ — expone ``worker_balance``.

    Payload (Fase D2-bis):
    - 5 agregados previos (compatibilidad con consumidores existentes).
    - ``workdays``: lista de jornadas pendientes/parciales con
      ``id``, ``date`` (YYYY-MM-DD), ``workday_type`` (``id``+``name``),
      ``applied_rate``, ``ya_pagado`` y ``pendiente``. Las pagadas NO
      aparecen.
    - ``loans``: lista de préstamos activos con ``id``, ``date``,
      ``reason``, ``amount``, ``outstanding_balance``.
    """

    permission_classes = [IsOrganizationMember]
    serializer_class = drf_serializers.Serializer  # placeholder para OpenAPI

    def get(self, request, worker_id):
        from apps.users.models import WorkerProfile  # noqa: PLC0415

        try:
            worker = WorkerProfile.objects.get(id=worker_id)
        except WorkerProfile.DoesNotExist:
            return Response(
                {"detail": "Trabajador no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        denied = _ensure_worker_in_callers_org(request.user, worker)
        if denied is not None:
            return denied

        bal = worker_balance(worker)
        return Response(
            {
                "worker_id": bal.worker_id,
                "pendientes_count": bal.pendientes_count,
                "adeudado_workdays": str(bal.adeudado_workdays),
                "saldo_prestamos": str(bal.saldo_prestamos),
                "neto_a_pagar": str(bal.neto_a_pagar),
                "workdays": [
                    {
                        "id": line.id,
                        "date": line.date.isoformat(),
                        "workday_type": {
                            "id": line.workday_type_id,
                            "name": line.workday_type_name,
                        },
                        "applied_rate": str(line.applied_rate),
                        "ya_pagado": str(line.ya_pagado),
                        "pendiente": str(line.pendiente),
                    }
                    for line in bal.workdays
                ],
                "loans": [
                    {
                        "id": line.id,
                        "date": line.date.isoformat(),
                        "reason": line.reason,
                        "amount": str(line.amount),
                        "outstanding_balance": str(line.outstanding_balance),
                    }
                    for line in bal.loans
                ],
            },
            status=status.HTTP_200_OK,
        )


class PreviewPaymentView(APIView):
    """POST /api/payments/preview/ — calcula el costo de un pago SIN persistir.

    Body: mismo que ``RegisterPaymentSerializer``
    (``worker``, ``workday_ids``, ``loan_allocations``, ``workday_overrides``).
    ``payment_method`` y ``payment_date`` se aceptan pero se ignoran
    para el cálculo (la regla es la misma; solo no toca BD).

    Respuesta:
        ``subtotal_workdays``: Decimal como string.
        ``total_abonos_prestamos``: Decimal como string.
        ``total_amount``: Decimal como string (bruto, igual que
        ``Payment.total_amount``).
        ``saldo_prestamos_despues``: dict ``{loan_id: Decimal}`` con el
        saldo que quedaría en cada préstamo tras aplicar el pago.

    Validaciones (vía ``preview_payment``):
        - sobrepago de jornada → 409 (``OverpaymentError``).
        - sobrepago de préstamo → 409 (``LoanOverpaymentError``).
        - cross-org → 404 (``CrossOrganizationError``).

    No persiste nada: ``Payment.objects.count()`` no cambia.
    """

    permission_classes = [IsMaestroOrAdminPlataforma]
    serializer_class = RegisterPaymentSerializer  # mismo body que el POST real.

    def post(self, request):
        s = RegisterPaymentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        from apps.users.models import WorkerProfile  # noqa: PLC0415

        try:
            worker = WorkerProfile.objects.get(id=data["worker"])
        except WorkerProfile.DoesNotExist:
            return Response(
                {"detail": "Trabajador no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        denied = _ensure_worker_in_callers_org(request.user, worker)
        if denied is not None:
            return denied

        # Loan allocations: traer Loan por id (mismo patrón que el POST real).
        allocs: list[LoanAllocation] = []
        for la in data["loan_allocations"]:
            try:
                ln = Loan.objects.get(id=la["loan"])
            except Loan.DoesNotExist:
                return Response(
                    {
                        "detail": (f"Préstamo {la['loan']} no encontrado."),
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
            allocs.append(LoanAllocation(loan=ln, amount=la["amount"]))

        breakdown = preview_payment(
            worker=worker,
            workday_ids=list(data["workday_ids"]),
            loan_allocations=allocs,
            workday_overrides={
                int(k): v for k, v in (data.get("workday_overrides") or {}).items()
            },
        )
        return Response(
            {
                "subtotal_workdays": str(breakdown.subtotal_workdays),
                "total_abonos_prestamos": str(breakdown.total_abonos_prestamos),
                "total_amount": str(breakdown.total_amount),
                "saldo_prestamos_despues": {
                    str(loan_id): str(saldo)
                    for loan_id, saldo in breakdown.saldo_prestamos_despues.items()
                },
            },
            status=status.HTTP_200_OK,
        )
