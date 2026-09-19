import os
from mcp.server import MCPServer

from calendar_service import (
    list_events as calendar_list_events,
    check_availability as calendar_check_availability,
    create_event as calendar_create_event,
)

mcp = MCPServer("Thozhan Calendar")


def _access_token() -> str:
    value = os.getenv(
        "THOZHAN_GOOGLE_CALENDAR_ACCESS_TOKEN",
        "",
    ).strip()

    if not value:
        raise RuntimeError(
            "Google Calendar access token is unavailable."
        )

    return value


@mcp.tool()
def list_events(
    time_min: str,
    time_max: str = "",
    max_results: int = 20,
) -> dict:
    """List upcoming events from the user's primary Google Calendar."""

    return calendar_list_events(
        access_token=_access_token(),
        time_min=time_min,
        time_max=time_max or None,
        max_results=max_results,
    )


@mcp.tool()
def check_availability(
    time_min: str,
    time_max: str,
    time_zone: str = "Pacific/Auckland",
) -> dict:
    """Check whether the user's primary calendar is free in a time range."""

    return calendar_check_availability(
        access_token=_access_token(),
        time_min=time_min,
        time_max=time_max,
        time_zone=time_zone,
    )


@mcp.tool()
def create_event(
    summary: str,
    start: str,
    end: str,
    time_zone: str = "Pacific/Auckland",
    description: str = "",
    location: str = "",
    attendees: list[str] | None = None,
) -> dict:
    """Create a Google Calendar event after the user has explicitly confirmed it."""

    return calendar_create_event(
        access_token=_access_token(),
        summary=summary,
        start=start,
        end=end,
        time_zone=time_zone,
        description=description,
        location=location,
        attendees=attendees or [],
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
