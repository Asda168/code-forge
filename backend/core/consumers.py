from channels.generic.websocket import AsyncJsonWebsocketConsumer


class UpdatesConsumer(AsyncJsonWebsocketConsumer):
    """Pushes release / settings-sync notices to connected desktop clients.

    Carries no local-machine capabilities: it never receives commands to execute.
    """

    group = "updates"

    async def connect(self):
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def release_published(self, event):
        await self.send_json({"type": "release", "version": event["version"]})
