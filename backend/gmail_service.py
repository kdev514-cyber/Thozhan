import imaplib

from email import message_from_bytes
from email.header import decode_header
from email.utils import parseaddr


# =========================================================
# GENERAL HELPERS
# =========================================================

def clean_app_password(
    password: str,
) -> str:
    """
    Remove spaces from a Google App Password.

    Google may display an app password like:

        abcd efgh ijkl mnop

    IMAP expects:

        abcdefghijklmnop
    """

    return "".join(
        password.split()
    )


def decode_email_header(
    value: str | None,
) -> str:
    """
    Decode MIME encoded email headers.
    """

    if not value:
        return ""

    decoded_parts = decode_header(
        value
    )

    result = ""

    for part, encoding in decoded_parts:

        if isinstance(
            part,
            bytes,
        ):
            try:
                result += part.decode(
                    encoding or "utf-8",
                    errors="replace",
                )

            except Exception:
                result += part.decode(
                    "utf-8",
                    errors="replace",
                )

        else:
            result += part

    return result.strip()


# =========================================================
# EMAIL BODY
# =========================================================

def extract_plain_text(
    email_message,
) -> str:
    """
    Extract the text/plain portion of an email.

    Attachments are ignored.
    """

    body_parts: list[str] = []

    if email_message.is_multipart():

        for part in email_message.walk():

            content_type = (
                part.get_content_type()
            )

            disposition = str(
                part.get(
                    "Content-Disposition",
                    "",
                )
            ).lower()

            if (
                content_type
                !=
                "text/plain"
            ):
                continue

            if (
                "attachment"
                in disposition
            ):
                continue

            try:
                payload = (
                    part.get_payload(
                        decode=True
                    )
                )

                if not payload:
                    continue

                charset = (
                    part.get_content_charset()
                    or
                    "utf-8"
                )

                text = payload.decode(
                    charset,
                    errors="replace",
                )

                body_parts.append(
                    text
                )

            except Exception:
                continue

    else:

        if (
            email_message.get_content_type()
            ==
            "text/plain"
        ):

            try:
                payload = (
                    email_message.get_payload(
                        decode=True
                    )
                )

                if payload:

                    charset = (
                        email_message
                        .get_content_charset()
                        or
                        "utf-8"
                    )

                    body_parts.append(
                        payload.decode(
                            charset,
                            errors="replace",
                        )
                    )

            except Exception:
                pass


    return "\n".join(
        body_parts
    ).strip()


# =========================================================
# IMAP CONNECTION
# =========================================================

def create_gmail_connection(
    gmail_address: str,
    app_password: str,
):
    """
    Create an authenticated Gmail IMAP connection.

    This function does not modify messages.
    """

    connection = (
        imaplib.IMAP4_SSL(
            "imap.gmail.com",
            993,
        )
    )

    connection.login(
        gmail_address,
        clean_app_password(
            app_password
        ),
    )

    return connection


def close_gmail_connection(
    connection,
):
    """
    Safely close an IMAP connection.
    """

    try:
        connection.close()
    except Exception:
        pass

    try:
        connection.logout()
    except Exception:
        pass


# =========================================================
# PARSE ONE MESSAGE
# =========================================================

def parse_email(
    uid: str,
    raw_email: bytes,
    include_body: bool = True,
) -> dict:
    """
    Convert a raw RFC822 email into a
    JSON-friendly dictionary.
    """

    email_message = (
        message_from_bytes(
            raw_email
        )
    )

    subject = (
        decode_email_header(
            email_message.get(
                "Subject"
            )
        )
        or
        "(No subject)"
    )


    sender_raw = (
        decode_email_header(
            email_message.get(
                "From"
            )
        )
    )


    sender_name, sender_email = (
        parseaddr(
            sender_raw
        )
    )


    sender_name = (
        decode_email_header(
            sender_name
        )
    )


    date = (
        email_message.get(
            "Date",
            "",
        )
    )


    message_id = (
        email_message.get(
            "Message-ID",
            "",
        )
    )


    body = ""

    if include_body:
        body = (
            extract_plain_text(
                email_message
            )
        )


    return {
        "id": uid,
        "uid": uid,
        "message_id": message_id,
        "subject": subject,
        "sender_name": sender_name,
        "sender_email": sender_email,
        "date": date,
        "body": body,
    }


# =========================================================
# FETCH RAW MESSAGE BY UID
# =========================================================

def fetch_raw_email_by_uid(
    connection,
    uid: str,
) -> bytes | None:
    """
    Fetch one Gmail message using its IMAP UID.
    """

    status, message_data = (
        connection.uid(
            "fetch",
            uid,
            "(BODY.PEEK[])",
        )
    )


    if (
        status != "OK"
        or
        not message_data
    ):
        return None


    for item in message_data:

        if (
            isinstance(
                item,
                tuple,
            )
            and
            len(item) > 1
            and
            isinstance(
                item[1],
                bytes,
            )
        ):
            return item[1]


    return None


# =========================================================
# LIST EMAILS
# =========================================================

def list_emails(
    gmail_address: str,
    app_password: str,
    limit: int = 10,
) -> list[dict]:
    """
    Return the newest Gmail inbox messages.

    Uses IMAP UIDs rather than sequence numbers.
    The inbox is opened read-only.
    """

    safe_limit = max(
        1,
        min(
            int(limit),
            50,
        ),
    )


    connection = (
        create_gmail_connection(
            gmail_address,
            app_password,
        )
    )


    try:
        status, _ = (
            connection.select(
                "INBOX",
                readonly=True,
            )
        )


        if status != "OK":
            raise RuntimeError(
                "Unable to open Gmail inbox."
            )


        status, data = (
            connection.uid(
                "search",
                None,
                "ALL",
            )
        )


        if status != "OK":
            raise RuntimeError(
                "Unable to search Gmail inbox."
            )


        uids = (
            data[0].split()
            if data and data[0]
            else []
        )


        latest_uids = (
            uids[-safe_limit:]
        )


        latest_uids.reverse()


        messages: list[dict] = []


        for uid_bytes in latest_uids:

            uid = (
                uid_bytes.decode(
                    errors="replace"
                )
            )


            raw_email = (
                fetch_raw_email_by_uid(
                    connection,
                    uid,
                )
            )


            if not raw_email:
                continue


            parsed = (
                parse_email(
                    uid,
                    raw_email,
                    include_body=True,
                )
            )


            # Keep list results reasonably small.
            parsed["body"] = (
                parsed["body"][:3000]
            )


            messages.append(
                parsed
            )


        return messages


    finally:
        close_gmail_connection(
            connection
        )


# =========================================================
# READ ONE EMAIL
# =========================================================

def read_email(
    gmail_address: str,
    app_password: str,
    uid: str,
) -> dict | None:
    """
    Read one email using its IMAP UID.

    BODY.PEEK[] prevents this fetch from
    intentionally setting the Seen flag.
    """

    uid = uid.strip()


    if not uid:
        raise ValueError(
            "Email UID is required."
        )


    connection = (
        create_gmail_connection(
            gmail_address,
            app_password,
        )
    )


    try:
        status, _ = (
            connection.select(
                "INBOX",
                readonly=True,
            )
        )


        if status != "OK":
            raise RuntimeError(
                "Unable to open Gmail inbox."
            )


        raw_email = (
            fetch_raw_email_by_uid(
                connection,
                uid,
            )
        )


        if not raw_email:
            return None


        return parse_email(
            uid,
            raw_email,
            include_body=True,
        )


    finally:
        close_gmail_connection(
            connection
        )


# =========================================================
# SEARCH EMAILS
# =========================================================

def search_emails(
    gmail_address: str,
    app_password: str,
    query: str,
    limit: int = 10,
) -> list[dict]:
    """
    Search Gmail inbox messages.

    For the first MVP this performs a
    safe text search across common fields
    using IMAP TEXT.

    More advanced Gmail-style search can
    be added later.
    """

    query = query.strip()


    if not query:
        raise ValueError(
            "Search query is required."
        )


    safe_limit = max(
        1,
        min(
            int(limit),
            50,
        ),
    )


    connection = (
        create_gmail_connection(
            gmail_address,
            app_password,
        )
    )


    try:
        status, _ = (
            connection.select(
                "INBOX",
                readonly=True,
            )
        )


        if status != "OK":
            raise RuntimeError(
                "Unable to open Gmail inbox."
            )


        status, data = (
            connection.uid(
                "search",
                None,
                "TEXT",
                f'"{query}"',
            )
        )


        if status != "OK":
            raise RuntimeError(
                "Unable to search Gmail inbox."
            )


        uids = (
            data[0].split()
            if data and data[0]
            else []
        )


        selected_uids = (
            uids[-safe_limit:]
        )


        selected_uids.reverse()


        results: list[dict] = []


        for uid_bytes in selected_uids:

            uid = (
                uid_bytes.decode(
                    errors="replace"
                )
            )


            raw_email = (
                fetch_raw_email_by_uid(
                    connection,
                    uid,
                )
            )


            if not raw_email:
                continue


            parsed = (
                parse_email(
                    uid,
                    raw_email,
                    include_body=True,
                )
            )


            parsed["body"] = (
                parsed["body"][:3000]
            )


            results.append(
                parsed
            )


        return results


    finally:
        close_gmail_connection(
            connection
        )