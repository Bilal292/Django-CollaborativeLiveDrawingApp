from django.urls import re_path
from . import consumers

# WebSocket URL patterns, linking the "/ws/drawing/" URL to the DrawingConsumer
websocket_urlpatterns = [
    re_path(r'ws/drawing/$', consumers.DrawingConsumer.as_asgi()),
]
