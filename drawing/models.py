from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

class Drawing(models.Model):
    data = models.TextField()

    def __str__(self):
        return self.data[:50]

class UserDrawInk(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    ink = models.IntegerField(default=200)
    last_claim_time = models.DateTimeField(null=True, blank=True, default=None)

    def can_claim(self):
        if self.last_claim_time is None:
            return True
        cooldown_period = timedelta(hours=8)  # 8 hours cooldown period
        return timezone.now() >= self.last_claim_time + cooldown_period

    def update_claim_time(self):
        self.last_claim_time = timezone.now()
        self.save()
