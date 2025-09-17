from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import User
from .models import Drawing, UserDrawInk
import json
from channels.db import database_sync_to_async

class DrawingConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        self.user = self.scope["user"]

        if self.user.is_authenticated:
            self.user_ink = await self.get_user_ink(self.user)
        else:
            self.user_ink = None

        # Add the current user to the 'drawing' group where drawing updates are broadcasted 
        await self.channel_layer.group_add(
            "drawing",
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            "drawing",
            self.channel_name
        )
    
    async def receive(self, text_data):
        data = json.loads(text_data)

        if self.user_ink:
            remaining_ink = await self.get_remaining_ink(self.user)

            if remaining_ink > 0:
                await self.save_drawing(data)

                await self.channel_layer.group_send(
                    "drawing",
                    {
                        "type": "draw_message",
                        "message": data,
                    }
                )
                await self.decrement_ink(self.user)
            else:
                await self.send(text_data=json.dumps({"error": "No ink left"}))

        else:
            await self.send(text_data=json.dumps({"error": "Authentication required"}))

    async def draw_message(self, event):
        message = event["message"]
        await self.send(text_data=json.dumps(message))
    
    @database_sync_to_async
    def save_drawing(self, data):
        Drawing.objects.create(data=json.dumps(data))

    @database_sync_to_async
    def get_user_ink(self, user):
        return UserDrawInk.objects.get(user=user)

    @database_sync_to_async
    def get_remaining_ink(self, user):
        ink = UserDrawInk.objects.get(user=user)
        return ink.ink

    @database_sync_to_async
    def decrement_ink(self, user):
        ink = UserDrawInk.objects.get(user=user)
        if ink.ink > 0:
            ink.ink -= 1
            ink.save()
