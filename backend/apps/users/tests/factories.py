from __future__ import annotations

from factory import Faker
from factory import post_generation
from factory.django import DjangoModelFactory


class UserFactory(DjangoModelFactory):
    email = Faker("email")
    name = Faker("name")

    @post_generation
    def password(self, create: bool, extracted: str | None, **kwargs):  # noqa: FBT001
        password = (
            extracted
            if extracted
            else Faker(
                "password",
                length=42,
                special_chars=True,
                digits=True,
                upper_case=True,
                lower_case=True,
            ).evaluate(None, None, extra={"locale": None})
        )
        self.set_password(password)
        if create:
            self.save()

    class Meta:
        # Lazy string notation: Factory Boy resolves the model class
        # AFTER Django settings are configured, avoiding ImproperlyConfigured
        # during pytest collection.
        # NOTE: app_label is the LAST segment of the AppConfig.name, not the
        # full Python path. With INSTALLED_APPS=["apps.users", ...] the
        # registered label is "users", not "apps".
        model = "users.User"
        django_get_or_create = ["email"]
        skip_postgeneration_save = True
