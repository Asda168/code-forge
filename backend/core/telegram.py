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
    lines = [f"{icon} <b>{html.escape(kind.title())}</b> · CodeCambo website", "", html.escape(message)]
    if contact:
        lines += ["", f"From: {html.escape(contact)}"]
    if version:
        lines.append(f"Site version: v{html.escape(version)}")
    return "\n".join(lines)
