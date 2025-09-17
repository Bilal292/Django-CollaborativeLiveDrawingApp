from django.apps import AppConfig

class DrawingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'drawing'

    def ready(self):
        #import drawing.signalsImport signals if any
        pass
