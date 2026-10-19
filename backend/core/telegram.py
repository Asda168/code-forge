"""Send messages to a Telegram bot. The token and chat id come only from the environment (never from code or the browser)."""
import html
import json
import os
import urllib.request

TIMEOUT = 8


def configured():
    return bool(os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID"))


def send(text):
    """Send an HTML-formatted message. Returns True on success; never raises and never logs the token."""
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return False
    body = json.dumps({"chat_id": chat, "text": text[:4000], "parse_mode": "HTML", "disable_web_page_preview": True}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status == 200
    except Exception:
        return False


def feedback_text(kind, message, contact, version):
    icon = {"feedback": "💬", "improvement": "💡", "bug": "🐞"}.get(kind, "💬")
    lines = [f"{icon} <b>{html.escape(kind.title())}</b> · Asta website", "", html.escape(message)]
    if contact:
        lines += ["", f"From: {html.escape(contact)}"]
    if version:
        lines.append(f"Site version: v{html.escape(version)}")
    return "\n".join(lines)


CAPTION_MAX = 1024  # Telegram's limit for a photo caption


def send_photos(photos, caption=""):
    """Send 1-10 images (list of (filename, content_type, bytes)) as a photo album; `caption` (HTML, <= CAPTION_MAX) shows under the first image. Returns True on success; never raises."""
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat or not photos:
        return False
    boundary = "----asta" + os.urandom(8).hex()
    parts = []

    def field(name, value):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())

    def file(name, filename, ctype, data):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + data + b"\r\n")

    field("chat_id", chat)
    if len(photos) == 1:
        method = "sendPhoto"
        if caption:
            field("caption", caption)
            field("parse_mode", "HTML")
        file("photo", *photos[0])
    else:
        method = "sendMediaGroup"
        media = [{"type": "photo", "media": f"attach://f{i}", **({"caption": caption, "parse_mode": "HTML"} if i == 0 and caption else {})} for i in range(len(photos))]
        field("media", json.dumps(media))
        for i, p in enumerate(photos):
            file(f"f{i}", *p)
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/{method}", data=b"".join(parts), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT * 3) as r:
            return r.status == 200
    except Exception:
        return False
