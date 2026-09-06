import pytest
from celery.result import EagerResult
from django.contrib.auth import get_user_model

from apps.users.tasks import get_users_count
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_user_count(settings):
    """A basic test to execute the get_users_count Celery task."""
    # El seed (0003_seed_users) persiste entre tests con --reuse-db.
    # Verificamos el delta en lugar del total absoluto.
    User = get_user_model()
    initial = User.objects.count()
    batch_size = 3
    UserFactory.create_batch(batch_size)
    settings.CELERY_TASK_ALWAYS_EAGER = True
    task_result = get_users_count.delay()
    assert isinstance(task_result, EagerResult)
    assert task_result.result == initial + batch_size
