import requests
from typing import Any
from urllib.parse import quote

CALENDAR_API = "https://www.googleapis.com/calendar/v3"


def _headers(access_token: str) -> dict[str, str]:
    if not access_token.strip():
        raise ValueError("Google Calendar access token is required.")

    return {
        "Authorization": f"Bearer {access_token.strip()}",
        "Content-Type": "application/json",
    }


def _raise_for_google(response: requests.Response) -> None:
    if response.ok:
        return

    try:
        detail = response.json()
    except Exception:
        detail = response.text

    raise RuntimeError(
        f"Google Calendar API error {response.status_code}: {detail}"
    )


def list_events(
    access_token: str,
    time_min: str,
    time_max: str | None = None,
    max_results: int = 20,
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "timeMin": time_min,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": max(1, min(max_results, 50)),
    }

    if time_max:
        params["timeMax"] = time_max

    response = requests.get(
        f"{CALENDAR_API}/calendars/primary/events",
        headers=_headers(access_token),
        params=params,
        timeout=20,
    )

    _raise_for_google(response)

    data = response.json()

    events = []

    for event in data.get("items", []):
        events.append(
            {
                "id": event.get("id"),
                "summary": event.get("summary") or "(No title)",
                "description": event.get("description") or "",
                "location": event.get("location") or "",
                "start": event.get("start", {}),
                "end": event.get("end", {}),
                "html_link": event.get("htmlLink") or "",
                "hangout_link": event.get("hangoutLink") or "",
                "attendees": event.get("attendees", []),
                "status": event.get("status") or "",
            }
        )

    return {
        "count": len(events),
        "events": events,
    }


def check_availability(
    access_token: str,
    time_min: str,
    time_max: str,
    time_zone: str = "Pacific/Auckland",
) -> dict[str, Any]:
    payload = {
        "timeMin": time_min,
        "timeMax": time_max,
        "timeZone": time_zone,
        "items": [{"id": "primary"}],
    }

    response = requests.post(
        f"{CALENDAR_API}/freeBusy",
        headers=_headers(access_token),
        json=payload,
        timeout=20,
    )

    _raise_for_google(response)

    data = response.json()
    calendar = data.get("calendars", {}).get("primary", {})
    busy = calendar.get("busy", [])

    return {
        "time_min": time_min,
        "time_max": time_max,
        "time_zone": time_zone,
        "busy": busy,
        "is_free": len(busy) == 0,
    }


def create_event(
    access_token: str,
    summary: str,
    start: str,
    end: str,
    time_zone: str = "Pacific/Auckland",
    description: str = "",
    location: str = "",
    attendees: list[str] | None = None,
) -> dict[str, Any]:
    if not summary.strip():
        raise ValueError("Event summary is required.")

    event: dict[str, Any] = {
        "summary": summary.strip(),
        "description": description.strip(),
        "location": location.strip(),
        "start": {
            "dateTime": start,
            "timeZone": time_zone,
        },
        "end": {
            "dateTime": end,
            "timeZone": time_zone,
        },
    }

    attendee_values = [
        email.strip()
        for email in (attendees or [])
        if isinstance(email, str) and email.strip()
    ]

    if attendee_values:
        event["attendees"] = [
            {"email": email}
            for email in attendee_values
        ]

    response = requests.post(
        f"{CALENDAR_API}/calendars/primary/events",
        headers=_headers(access_token),
        params={"sendUpdates": "all" if attendee_values else "none"},
        json=event,
        timeout=20,
    )

    _raise_for_google(response)

    created = response.json()

    return {
        "id": created.get("id"),
        "summary": created.get("summary"),
        "start": created.get("start", {}),
        "end": created.get("end", {}),
        "html_link": created.get("htmlLink") or "",
        "hangout_link": created.get("hangoutLink") or "",
        "attendees": created.get("attendees", []),
    }
