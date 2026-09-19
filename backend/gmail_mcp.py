import os

from mcp.server import MCPServer

from gmail_service import (
    list_emails as gmail_list_emails,
    read_email as gmail_read_email,
    search_emails as gmail_search_emails,
)


# =========================================================
# THOZHAN GMAIL MCP SERVER
# =========================================================

mcp = MCPServer(
    "Thozhan Gmail"
)


# =========================================================
# SERVER-SIDE CREDENTIAL CONTEXT
# =========================================================

def get_gmail_credentials() -> tuple[str, str]:
    """
    Gmail credentials are supplied to the MCP
    subprocess through its private environment.

    They are NOT MCP tool arguments and therefore
    are not exposed to the LLM as part of the
    tool schema.
    """

    gmail_address = (
        os.getenv(
            "THOZHAN_GMAIL_ADDRESS",
            "",
        )
        .strip()
        .lower()
    )


    app_password = (
        os.getenv(
            "THOZHAN_GMAIL_APP_PASSWORD",
            "",
        )
        .strip()
    )


    if (
        not gmail_address
        or
        not app_password
    ):
        raise RuntimeError(
            "Gmail credentials were not supplied "
            "to the Thozhan Gmail MCP server."
        )


    return (
        gmail_address,
        app_password,
    )


# =========================================================
# TOOL 1 — LIST EMAILS
# =========================================================

@mcp.tool()
def list_emails(
    limit: int = 10,
) -> dict:
    """
    List the user's latest Gmail inbox messages.

    Use this when the user asks about recent,
    latest, or new emails.
    """

    safe_limit = max(
        1,
        min(
            int(limit),
            20,
        ),
    )


    try:
        (
            gmail_address,
            app_password,
        ) = get_gmail_credentials()


        messages = (
            gmail_list_emails(
                gmail_address=
                    gmail_address,

                app_password=
                    app_password,

                limit=
                    safe_limit,
            )
        )


        return {
            "success": True,
            "count":
                len(messages),
            "emails":
                messages,
        }


    except Exception as error:

        return {
            "success": False,
            "error":
                str(error),
            "emails": [],
        }


# =========================================================
# TOOL 2 — READ EMAIL
# =========================================================

@mcp.tool()
def read_email(
    message_id: str,
) -> dict:
    """
    Read one Gmail message.

    message_id is the IMAP UID returned by
    list_emails or search_emails.
    """

    uid = (
        message_id.strip()
    )


    if not uid:

        return {
            "success": False,
            "error":
                "message_id is required.",
        }


    try:
        (
            gmail_address,
            app_password,
        ) = get_gmail_credentials()


        message = (
            gmail_read_email(
                gmail_address=
                    gmail_address,

                app_password=
                    app_password,

                uid=
                    uid,
            )
        )


        if not message:

            return {
                "success": False,
                "error":
                    "Email was not found.",
            }


        return {
            "success": True,
            "email":
                message,
        }


    except Exception as error:

        return {
            "success": False,
            "error":
                str(error),
        }


# =========================================================
# TOOL 3 — SEARCH EMAILS
# =========================================================

@mcp.tool()
def search_emails(
    query: str,
    limit: int = 10,
) -> dict:
    """
    Search the user's Gmail inbox.

    Use this when the user asks for emails
    containing a word, name, subject,
    organization, or other text.
    """

    query = (
        query.strip()
    )


    if not query:

        return {
            "success": False,
            "error":
                "Search query is required.",
            "emails": [],
        }


    safe_limit = max(
        1,
        min(
            int(limit),
            20,
        ),
    )


    try:
        (
            gmail_address,
            app_password,
        ) = get_gmail_credentials()


        messages = (
            gmail_search_emails(
                gmail_address=
                    gmail_address,

                app_password=
                    app_password,

                query=
                    query,

                limit=
                    safe_limit,
            )
        )


        return {
            "success": True,
            "query":
                query,
            "count":
                len(messages),
            "emails":
                messages,
        }


    except Exception as error:

        return {
            "success": False,
            "error":
                str(error),
            "emails": [],
        }


# =========================================================
# RUN MCP SERVER
# =========================================================

if __name__ == "__main__":
    mcp.run(
        transport="stdio"
    )