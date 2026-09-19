import json
from pathlib import Path
from typing import Any

from mcp import Client
from mcp.client.stdio import StdioServerParameters

BACKEND_DIR = Path(__file__).resolve().parent
PYTHON_EXECUTABLE = BACKEND_DIR / "venv" / "bin" / "python"
GMAIL_MCP_SERVER = BACKEND_DIR / "gmail_mcp.py"
CALENDAR_MCP_SERVER = BACKEND_DIR / "calendar_mcp.py"


def create_gmail_server_params(
    gmail_address: str,
    app_password: str,
) -> StdioServerParameters:
    gmail_address = gmail_address.strip().lower()
    app_password = app_password.strip()

    if not gmail_address:
        raise ValueError("Gmail address is required.")
    if not app_password:
        raise ValueError("Gmail App Password is required.")
    if not PYTHON_EXECUTABLE.exists():
        raise RuntimeError("Project Python executable was not found.")
    if not GMAIL_MCP_SERVER.exists():
        raise RuntimeError("gmail_mcp.py was not found.")

    return StdioServerParameters(
        command=str(PYTHON_EXECUTABLE),
        args=[str(GMAIL_MCP_SERVER)],
        cwd=str(BACKEND_DIR),
        env={
            "THOZHAN_GMAIL_ADDRESS": gmail_address,
            "THOZHAN_GMAIL_APP_PASSWORD": app_password,
        },
    )


def create_calendar_server_params(
    access_token: str,
) -> StdioServerParameters:
    access_token = access_token.strip()

    if not access_token:
        raise ValueError("Google Calendar access token is required.")
    if not PYTHON_EXECUTABLE.exists():
        raise RuntimeError("Project Python executable was not found.")
    if not CALENDAR_MCP_SERVER.exists():
        raise RuntimeError("calendar_mcp.py was not found.")

    return StdioServerParameters(
        command=str(PYTHON_EXECUTABLE),
        args=[str(CALENDAR_MCP_SERVER)],
        cwd=str(BACKEND_DIR),
        env={
            "THOZHAN_GOOGLE_CALENDAR_ACCESS_TOKEN": access_token,
        },
    )


def parse_tool_result(result: Any) -> Any:
    structured_content = getattr(result, "structured_content", None)
    if structured_content is not None:
        return structured_content

    content = getattr(result, "content", None)
    if not content:
        return None

    text_parts: list[str] = []

    for item in content:
        text = getattr(item, "text", None)
        if text is not None:
            text_parts.append(text)

    if not text_parts:
        return content

    combined_text = "\n".join(text_parts)

    try:
        return json.loads(combined_text)
    except json.JSONDecodeError:
        return combined_text


async def list_gmail_mcp_tools(
    gmail_address: str,
    app_password: str,
) -> list[dict]:
    server_params = create_gmail_server_params(
        gmail_address=gmail_address,
        app_password=app_password,
    )

    async with Client(server_params) as client:
        result = await client.list_tools()
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for tool in result.tools
        ]


async def call_gmail_tool(
    tool_name: str,
    arguments: dict | None,
    gmail_address: str,
    app_password: str,
) -> Any:
    allowed_tools = {
        "list_emails",
        "read_email",
        "search_emails",
    }

    if tool_name not in allowed_tools:
        raise ValueError(f"Unsupported Gmail MCP tool: {tool_name}")

    server_params = create_gmail_server_params(
        gmail_address=gmail_address,
        app_password=app_password,
    )

    async with Client(server_params) as client:
        result = await client.call_tool(
            tool_name,
            arguments or {},
        )

        if getattr(result, "is_error", False):
            parsed = parse_tool_result(result)
            raise RuntimeError(f"MCP tool failed: {parsed}")

        return parse_tool_result(result)


async def call_calendar_tool(
    tool_name: str,
    arguments: dict | None,
    access_token: str,
) -> Any:
    allowed_tools = {
        "list_events",
        "check_availability",
        "create_event",
    }

    if tool_name not in allowed_tools:
        raise ValueError(
            f"Unsupported Calendar MCP tool: {tool_name}"
        )

    server_params = create_calendar_server_params(
        access_token=access_token,
    )

    async with Client(server_params) as client:
        result = await client.call_tool(
            tool_name,
            arguments or {},
        )

        if getattr(result, "is_error", False):
            parsed = parse_tool_result(result)
            raise RuntimeError(
                f"Calendar MCP tool failed: {parsed}"
            )

        return parse_tool_result(result)
