from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from cryptography.fernet import Fernet
from groq import Groq
from supabase import create_client, Client
from mcp_client import call_gmail_tool, call_calendar_tool
from assistant_service import run_assistant

from datetime import datetime, timezone
from email import message_from_bytes
from email.header import decode_header
from email.utils import parseaddr

import imaplib
import os


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:3000",
)

SUPABASE_URL = os.getenv(
    "SUPABASE_URL"
)

SUPABASE_PUBLISHABLE_KEY = os.getenv(
    "SUPABASE_PUBLISHABLE_KEY"
)

ENCRYPTION_KEY = os.getenv(
    "ENCRYPTION_KEY"
)


if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL is missing from backend/.env"
    )

if not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError(
        "SUPABASE_PUBLISHABLE_KEY is missing from backend/.env"
    )

if not ENCRYPTION_KEY:
    raise RuntimeError(
        "ENCRYPTION_KEY is missing from backend/.env"
    )


# =========================================================
# CLIENTS
# =========================================================

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
)

fernet = Fernet(
    ENCRYPTION_KEY.encode()
)


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    title="Thozhan API",
    description="Backend API for Thozhan AI Companion",
    version="0.4.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST MODELS
# =========================================================

class GroqKeyRequest(BaseModel):
    api_key: str


class GmailConnectRequest(BaseModel):
    email: str
    app_password: str


class AssistantChatRequest(BaseModel):
    message: str


# =========================================================
# AUTHENTICATION
# =========================================================

def get_access_token(
    authorization: str | None
) -> str:

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is missing.",
        )

    parts = authorization.split(" ")

    if (
        len(parts) != 2
        or parts[0].lower() != "bearer"
        or not parts[1]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header.",
        )

    return parts[1]


def get_authenticated_user(
    authorization: str | None
):
    token = get_access_token(
        authorization
    )

    try:
        response = supabase.auth.get_user(
            token
        )

        user = response.user

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid Supabase session.",
            )

        return user, token

    except HTTPException:
        raise

    except Exception as error:
        print(
            "Authentication failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=401,
            detail="Unable to authenticate user.",
        )


def get_user_supabase_client(
    access_token: str
) -> Client:

    user_client: Client = create_client(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
    )

    user_client.postgrest.auth(
        access_token
    )

    return user_client


# =========================================================
# ENCRYPTION
# =========================================================

def encrypt_secret(
    value: str
) -> str:

    return (
        fernet
        .encrypt(
            value.encode()
        )
        .decode()
    )


def decrypt_secret(
    value: str
) -> str:

    try:
        return (
            fernet
            .decrypt(
                value.encode()
            )
            .decode()
        )

    except Exception as error:
        print(
            "Secret decryption failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt stored credential.",
        )


# =========================================================
# EMAIL HELPERS
# =========================================================

def decode_email_header(
    value: str | None
) -> str:

    if not value:
        return ""

    decoded_parts = decode_header(
        value
    )

    result = ""

    for part, encoding in decoded_parts:

        if isinstance(
            part,
            bytes
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

    return result


def clean_app_password(
    password: str
) -> str:

    # Google often displays app passwords
    # grouped with spaces.
    #
    # Example:
    # abcd efgh ijkl mnop
    #
    # IMAP expects the actual password
    # without spaces.

    return "".join(
        password.split()
    )


def extract_plain_text(
    email_message
) -> str:

    body = ""

    if email_message.is_multipart():

        for part in email_message.walk():

            content_type = (
                part.get_content_type()
            )

            disposition = str(
                part.get(
                    "Content-Disposition"
                )
            )


            if (
                content_type ==
                "text/plain"
                and
                "attachment"
                not in disposition.lower()
            ):

                try:
                    payload = (
                        part.get_payload(
                            decode=True
                        )
                    )

                    if payload:
                        charset = (
                            part.get_content_charset()
                            or
                            "utf-8"
                        )

                        body += payload.decode(
                            charset,
                            errors="replace",
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

                    body = payload.decode(
                        charset,
                        errors="replace",
                    )

            except Exception:
                body = ""

    return body.strip()


def create_gmail_connection(
    gmail_address: str,
    app_password: str,
):

    try:
        connection = (
            imaplib.IMAP4_SSL(
                "imap.gmail.com",
                993,
            )
        )

        connection.login(
            gmail_address,
            app_password,
        )

        return connection

    except imaplib.IMAP4.error:
        raise HTTPException(
            status_code=400,
            detail=(
                "Gmail authentication failed. "
                "Check your Gmail address and App Password."
            ),
        )

    except Exception as error:
        print(
            "Gmail connection failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to connect to Gmail.",
        )


# =========================================================
# BASIC ROUTES
# =========================================================

@app.get("/")
async def root():

    return {
        "app": "Thozhan",
        "message":
            "Your AI companion backend is running.",
        "status": "online",
    }


@app.get("/health")
async def health():

    return {
        "status": "healthy",
        "service": "thozhan-api",
    }


# =========================================================
# GROQ CONNECT
# =========================================================

@app.post("/api/groq/connect")
async def connect_groq(
    request: GroqKeyRequest,
    authorization: str | None = Header(
        default=None
    ),
):

    user, access_token = (
        get_authenticated_user(
            authorization
        )
    )

    user_id = str(
        user.id
    )

    api_key = (
        request.api_key.strip()
    )


    if not api_key:

        raise HTTPException(
            status_code=400,
            detail="Groq API key is required.",
        )


    try:

        groq_client = Groq(
            api_key=api_key
        )

        groq_client.models.list()

    except Exception as error:

        print(
            "Groq validation failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=400,
            detail="Invalid Groq API key.",
        )


    encrypted_key = encrypt_secret(
        api_key
    )


    user_supabase = (
        get_user_supabase_client(
            access_token
        )
    )


    try:

        (
            user_supabase
            .table(
                "user_ai_settings"
            )
            .upsert(
                {
                    "user_id":
                        user_id,

                    "encrypted_groq_key":
                        encrypted_key,

                    "groq_connected":
                        True,

                    "updated_at":
                        datetime.now(
                            timezone.utc
                        ).isoformat(),
                },
                on_conflict="user_id",
            )
            .execute()
        )

    except Exception as error:

        print(
            "Groq database save failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save Groq configuration."
            ),
        )


    return {
        "connected": True,
        "message":
            "Groq connected successfully.",
    }


# =========================================================
# GROQ STATUS
# =========================================================

@app.get("/api/groq/status")
async def groq_status(
    authorization: str | None = Header(
        default=None
    ),
):

    user, access_token = (
        get_authenticated_user(
            authorization
        )
    )

    user_id = str(
        user.id
    )

    user_supabase = (
        get_user_supabase_client(
            access_token
        )
    )


    try:

        response = (
            user_supabase
            .table(
                "user_ai_settings"
            )
            .select(
                "groq_connected"
            )
            .eq(
                "user_id",
                user_id,
            )
            .maybe_single()
            .execute()
        )


        if not response.data:

            return {
                "connected": False
            }


        return {
            "connected":
                bool(
                    response.data.get(
                        "groq_connected",
                        False,
                    )
                )
        }

    except Exception as error:

        print(
            "Groq status failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve Groq status."
            ),
        )


# =========================================================
# GMAIL CONNECT
# =========================================================

@app.post("/api/gmail/connect")
async def connect_gmail(
    request: GmailConnectRequest,
    authorization: str | None = Header(
        default=None
    ),
):

    # -----------------------------------------
    # Authenticate Thozhan user
    # -----------------------------------------

    user, access_token = (
        get_authenticated_user(
            authorization
        )
    )

    user_id = str(
        user.id
    )


    # -----------------------------------------
    # Clean submitted values
    # -----------------------------------------

    gmail_address = (
        request.email
        .strip()
        .lower()
    )

    app_password = (
        clean_app_password(
            request.app_password
        )
    )


    if not gmail_address:

        raise HTTPException(
            status_code=400,
            detail="Gmail address is required.",
        )


    if not app_password:

        raise HTTPException(
            status_code=400,
            detail="Gmail App Password is required.",
        )


    # -----------------------------------------
    # Test Gmail login
    # -----------------------------------------

    connection = (
        create_gmail_connection(
            gmail_address,
            app_password,
        )
    )


    try:
        connection.logout()
    except Exception:
        pass


    # -----------------------------------------
    # Encrypt App Password
    # -----------------------------------------

    encrypted_password = (
        encrypt_secret(
            app_password
        )
    )


    # -----------------------------------------
    # Store connection
    # -----------------------------------------

    user_supabase = (
        get_user_supabase_client(
            access_token
        )
    )


    try:

        (
            user_supabase
            .table(
                "user_gmail_settings"
            )
            .upsert(
                {
                    "user_id":
                        user_id,

                    "gmail_address":
                        gmail_address,

                    "encrypted_app_password":
                        encrypted_password,

                    "gmail_connected":
                        True,

                    "updated_at":
                        datetime.now(
                            timezone.utc
                        ).isoformat(),
                },
                on_conflict="user_id",
            )
            .execute()
        )

    except Exception as error:

        print(
            "Gmail database save failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save Gmail configuration."
            ),
        )


    return {
        "connected": True,
        "email": gmail_address,
        "message":
            "Gmail connected successfully.",
    }


# =========================================================
# GMAIL STATUS
# =========================================================

@app.get("/api/gmail/status")
async def gmail_status(
    authorization: str | None = Header(
        default=None
    ),
):

    user, access_token = (
        get_authenticated_user(
            authorization
        )
    )

    user_id = str(
        user.id
    )

    user_supabase = (
        get_user_supabase_client(
            access_token
        )
    )


    try:

        response = (
            user_supabase
            .table(
                "user_gmail_settings"
            )
            .select(
                "gmail_address,gmail_connected"
            )
            .eq(
                "user_id",
                user_id,
            )
            .maybe_single()
            .execute()
        )


        if not response.data:

            return {
                "connected": False,
                "email": None,
            }


        return {
            "connected":
                bool(
                    response.data.get(
                        "gmail_connected",
                        False,
                    )
                ),

            "email":
                response.data.get(
                    "gmail_address"
                ),
        }

    except Exception as error:

        print(
            "Gmail status failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve Gmail status."
            ),
        )


# =========================================================
# GET LATEST EMAILS
# =========================================================

@app.get("/api/gmail/emails")
async def get_latest_emails(
    authorization: str | None = Header(
        default=None
    ),
):

    # -----------------------------------------
    # Authenticate Thozhan user
    # -----------------------------------------

    user, access_token = (
        get_authenticated_user(
            authorization
        )
    )

    user_id = str(
        user.id
    )


    user_supabase = (
        get_user_supabase_client(
            access_token
        )
    )


    # -----------------------------------------
    # Load stored Gmail credentials
    # -----------------------------------------

    try:

        response = (
            user_supabase
            .table(
                "user_gmail_settings"
            )
            .select(
                (
                    "gmail_address,"
                    "encrypted_app_password,"
                    "gmail_connected"
                )
            )
            .eq(
                "user_id",
                user_id,
            )
            .maybe_single()
            .execute()
        )

    except Exception as error:

        print(
            "Gmail credential lookup failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load Gmail configuration."
            ),
        )


    if not response.data:

        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )


    if not response.data.get(
        "gmail_connected"
    ):

        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )


    gmail_address = (
        response.data.get(
            "gmail_address"
        )
    )

    encrypted_password = (
        response.data.get(
            "encrypted_app_password"
        )
    )


    if not encrypted_password:

        raise HTTPException(
            status_code=500,
            detail=(
                "Stored Gmail credential is missing."
            ),
        )


    app_password = (
        decrypt_secret(
            encrypted_password
        )
    )


    # -----------------------------------------
    # Connect to Gmail
    # -----------------------------------------

    connection = (
        create_gmail_connection(
            gmail_address,
            app_password,
        )
    )


    emails = []


    try:

        # -------------------------------------
        # Open inbox in read-only mode
        # -------------------------------------

        status, _ = (
            connection.select(
                "INBOX",
                readonly=True,
            )
        )


        if status != "OK":

            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to open Gmail inbox."
                ),
            )


        # -------------------------------------
        # Find all message IDs
        # -------------------------------------

        status, data = (
            connection.search(
                None,
                "ALL",
            )
        )


        if status != "OK":

            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to search Gmail inbox."
                ),
            )


        message_ids = (
            data[0].split()
            if data and data[0]
            else []
        )


        # Latest 10 messages
        latest_ids = (
            message_ids[-10:]
        )


        # Newest first
        latest_ids.reverse()


        # -------------------------------------
        # Fetch each message
        # -------------------------------------

        for message_id in latest_ids:

            status, message_data = (
                connection.fetch(
                    message_id,
                    "(RFC822)",
                )
            )


            if (
                status != "OK"
                or
                not message_data
            ):
                continue


            raw_email = None


            for item in message_data:

                if (
                    isinstance(
                        item,
                        tuple
                    )
                    and
                    len(item) > 1
                ):
                    raw_email = item[1]
                    break


            if not raw_email:
                continue


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
                    ""
                )
            )


            body = (
                extract_plain_text(
                    email_message
                )
            )


            # MVP safety:
            # limit how much message content
            # we return to the browser.

            body_preview = (
                body[:3000]
            )


            emails.append(
                {
                    "id":
                        message_id.decode(
                            errors="replace"
                        ),

                    "subject":
                        subject
                        or
                        "(No subject)",

                    "sender_name":
                        sender_name,

                    "sender_email":
                        sender_email,

                    "date":
                        date,

                    "body":
                        body_preview,
                }
            )


    finally:

        try:
            connection.close()
        except Exception:
            pass

        try:
            connection.logout()
        except Exception:
            pass


    return {
        "count":
            len(emails),

        "emails":
            emails,
    }

# =========================================================
# MCP GMAIL TEST
# =========================================================

@app.get("/api/mcp/gmail/test")
async def test_gmail_mcp(
    authorization: str | None = Header(
        default=None
    ),
):

    # -----------------------------------------------------
    # Authenticate current Thozhan user
    # -----------------------------------------------------

    user, access_token = (
        get_authenticated_user(
            authorization
        )
    )

    user_id = str(
        user.id
    )


    # -----------------------------------------------------
    # Create authenticated Supabase client
    # -----------------------------------------------------

    user_supabase = (
        get_user_supabase_client(
            access_token
        )
    )


    # -----------------------------------------------------
    # Load this user's Gmail configuration
    # -----------------------------------------------------

    try:

        response = (
            user_supabase
            .table(
                "user_gmail_settings"
            )
            .select(
                (
                    "gmail_address,"
                    "encrypted_app_password,"
                    "gmail_connected"
                )
            )
            .eq(
                "user_id",
                user_id,
            )
            .maybe_single()
            .execute()
        )

    except Exception as error:

        print(
            "MCP Gmail credential lookup failed:",
            type(error).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load Gmail configuration."
            ),
        )


    # -----------------------------------------------------
    # Make sure Gmail is connected
    # -----------------------------------------------------

    if not response.data:

        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )


    if not response.data.get(
        "gmail_connected"
    ):

        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )


    gmail_address = (
        response.data.get(
            "gmail_address"
        )
    )

    encrypted_password = (
        response.data.get(
            "encrypted_app_password"
        )
    )


    if not gmail_address:

        raise HTTPException(
            status_code=500,
            detail=(
                "Stored Gmail address is missing."
            ),
        )


    if not encrypted_password:

        raise HTTPException(
            status_code=500,
            detail=(
                "Stored Gmail credential is missing."
            ),
        )


    # -----------------------------------------------------
    # Decrypt credential server-side
    # -----------------------------------------------------

    app_password = (
        decrypt_secret(
            encrypted_password
        )
    )


    # -----------------------------------------------------
    # CALL GMAIL THROUGH MCP
    #
    # FastAPI
    #    ↓
    # mcp_client.py
    #    ↓
    # gmail_mcp.py
    #    ↓
    # gmail_service.py
    #    ↓
    # Gmail
    # -----------------------------------------------------

    try:

        result = await call_gmail_tool(
            tool_name="list_emails",

            arguments={
                "limit": 3
            },

            gmail_address=
                gmail_address,

            app_password=
                app_password,
        )

    except Exception as error:

        print(
            "Gmail MCP test failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Gmail MCP test failed."
            ),
        )


    # -----------------------------------------------------
    # SUCCESS
    # -----------------------------------------------------

    return {
        "success": True,
        "transport": "mcp",
        "tool": "list_emails",
        "result": result,
    }

# =========================================================
# THOZHAN AI ASSISTANT
# =========================================================

@app.post("/api/assistant/chat")
async def assistant_chat(
    request: AssistantChatRequest,
    authorization: str | None = Header(default=None),
):
    # -----------------------------------------------------
    # Authenticate Thozhan user
    # -----------------------------------------------------

    user, access_token = get_authenticated_user(
        authorization
    )

    user_id = str(user.id)

    user_supabase = get_user_supabase_client(
        access_token
    )

    # -----------------------------------------------------
    # Validate message
    # -----------------------------------------------------

    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    # -----------------------------------------------------
    # Load Groq configuration
    # -----------------------------------------------------

    try:
        groq_response = (
            user_supabase
            .table("user_ai_settings")
            .select(
                "encrypted_groq_key,"
                "groq_connected"
            )
            .eq(
                "user_id",
                user_id,
            )
            .maybe_single()
            .execute()
        )

    except Exception as error:
        print(
            "Assistant Groq lookup failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load AI configuration.",
        )

    if not groq_response.data:
        raise HTTPException(
            status_code=400,
            detail="Groq is not connected.",
        )

    if not groq_response.data.get(
        "groq_connected"
    ):
        raise HTTPException(
            status_code=400,
            detail="Groq is not connected.",
        )

    encrypted_groq_key = (
        groq_response.data.get(
            "encrypted_groq_key"
        )
    )

    if not encrypted_groq_key:
        raise HTTPException(
            status_code=500,
            detail="Stored Groq credential is missing.",
        )

    # -----------------------------------------------------
    # Load Gmail configuration
    # -----------------------------------------------------

    try:
        gmail_response = (
            user_supabase
            .table("user_gmail_settings")
            .select(
                "gmail_address,"
                "encrypted_app_password,"
                "gmail_connected"
            )
            .eq(
                "user_id",
                user_id,
            )
            .maybe_single()
            .execute()
        )

    except Exception as error:
        print(
            "Assistant Gmail lookup failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load Gmail configuration.",
        )

    if not gmail_response.data:
        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )

    if not gmail_response.data.get(
        "gmail_connected"
    ):
        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )

    gmail_address = (
        gmail_response.data.get(
            "gmail_address"
        )
    )

    encrypted_app_password = (
        gmail_response.data.get(
            "encrypted_app_password"
        )
    )

    if not gmail_address:
        raise HTTPException(
            status_code=500,
            detail="Stored Gmail address is missing.",
        )

    if not encrypted_app_password:
        raise HTTPException(
            status_code=500,
            detail="Stored Gmail credential is missing.",
        )

    # -----------------------------------------------------
    # Decrypt credentials only in backend memory
    # -----------------------------------------------------

    try:
        groq_api_key = decrypt_secret(
            encrypted_groq_key
        )

        app_password = decrypt_secret(
            encrypted_app_password
        )

    except Exception as error:
        print(
            "Assistant credential decryption failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt assistant credentials.",
        )

    # -----------------------------------------------------
    # Run Thozhan
    # -----------------------------------------------------

    try:
        result = await run_assistant(
            user_message=message,
            groq_api_key=groq_api_key,
            gmail_address=gmail_address,
            app_password=app_password,
        )

    except Exception as error:
        print(
            "Assistant execution failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Thozhan was unable to process the request.",
        )

    # -----------------------------------------------------
    # Return safe result
    # -----------------------------------------------------

    return {
        "success": True,
        "answer": result.get(
            "answer",
            "",
        ),
        "tools_used": result.get(
            "tools_used",
            [],
        ),
    }

# =========================================================
# PRIORITY INBOX
# =========================================================

@app.get("/api/priority/live-legacy")
async def get_priority_inbox(
    authorization: str | None = Header(default=None),
):
    """
    Analyse the user's latest Gmail messages and return
    structured priority data for the Thozhan dashboard.

    This endpoint is read-only:
    - it does not send email
    - it does not delete email
    - it does not modify Gmail
    """

    # -----------------------------------------------------
    # Authenticate current Thozhan user
    # -----------------------------------------------------

    user, access_token = get_authenticated_user(
        authorization
    )

    user_id = str(user.id)

    user_supabase = get_user_supabase_client(
        access_token
    )

    # -----------------------------------------------------
    # Load Groq configuration
    # -----------------------------------------------------

    try:
        groq_response = (
            user_supabase
            .table("user_ai_settings")
            .select(
                "encrypted_groq_key,"
                "groq_connected"
            )
            .eq(
                "user_id",
                user_id,
            )
            .maybe_single()
            .execute()
        )

    except Exception as error:
        print(
            "Priority Groq lookup failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load AI configuration.",
        )

    if (
        not groq_response.data
        or not groq_response.data.get("groq_connected")
    ):
        raise HTTPException(
            status_code=400,
            detail="Groq is not connected.",
        )

    encrypted_groq_key = groq_response.data.get(
        "encrypted_groq_key"
    )

    if not encrypted_groq_key:
        raise HTTPException(
            status_code=500,
            detail="Stored Groq credential is missing.",
        )

    # -----------------------------------------------------
    # Load Gmail configuration
    # -----------------------------------------------------

    try:
        gmail_response = (
            user_supabase
            .table("user_gmail_settings")
            .select(
                "gmail_address,"
                "encrypted_app_password,"
                "gmail_connected"
            )
            .eq(
                "user_id",
                user_id,
            )
            .maybe_single()
            .execute()
        )

    except Exception as error:
        print(
            "Priority Gmail lookup failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to load Gmail configuration.",
        )

    if (
        not gmail_response.data
        or not gmail_response.data.get("gmail_connected")
    ):
        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )

    gmail_address = gmail_response.data.get(
        "gmail_address"
    )

    encrypted_app_password = gmail_response.data.get(
        "encrypted_app_password"
    )

    if not gmail_address:
        raise HTTPException(
            status_code=500,
            detail="Stored Gmail address is missing.",
        )

    if not encrypted_app_password:
        raise HTTPException(
            status_code=500,
            detail="Stored Gmail credential is missing.",
        )

    # -----------------------------------------------------
    # Decrypt credentials only in backend memory
    # -----------------------------------------------------

    groq_api_key = decrypt_secret(
        encrypted_groq_key
    )

    app_password = decrypt_secret(
        encrypted_app_password
    )

    # -----------------------------------------------------
    # Retrieve latest messages through Gmail MCP
    # -----------------------------------------------------

    try:
        gmail_result = await call_gmail_tool(
            tool_name="list_emails",
            arguments={
                "limit": 10,
            },
            gmail_address=gmail_address,
            app_password=app_password,
        )

    except Exception as error:
        print(
            "Priority Gmail MCP failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve Gmail messages.",
        )

    # MCP may return the list directly or wrap it in a dict.
    if isinstance(gmail_result, list):
        raw_emails = gmail_result

    elif isinstance(gmail_result, dict):
        raw_emails = (
            gmail_result.get("emails")
            or gmail_result.get("result")
            or []
        )

        if isinstance(raw_emails, dict):
            raw_emails = raw_emails.get(
                "emails",
                [],
            )

    else:
        raw_emails = []

    if not isinstance(raw_emails, list):
        raw_emails = []

    if not raw_emails:
        return {
            "success": True,
            "count": 0,
            "emails": [],
        }

    # -----------------------------------------------------
    # Prepare bounded email data for analysis
    # -----------------------------------------------------

    email_payload = []

    for email_item in raw_emails[:10]:
        if not isinstance(email_item, dict):
            continue

        email_payload.append(
            {
                "id": str(
                    email_item.get("id")
                    or email_item.get("uid")
                    or ""
                ),
                "subject": str(
                    email_item.get("subject")
                    or "(No subject)"
                )[:500],
                "sender_name": str(
                    email_item.get("sender_name")
                    or ""
                )[:300],
                "sender_email": str(
                    email_item.get("sender_email")
                    or ""
                )[:300],
                "date": str(
                    email_item.get("date")
                    or ""
                )[:300],
                "body": str(
                    email_item.get("body")
                    or ""
                )[:3000],
            }
        )

    if not email_payload:
        return {
            "success": True,
            "count": 0,
            "emails": [],
        }

    # -----------------------------------------------------
    # Ask Groq for STRUCTURED analysis only
    # -----------------------------------------------------

    priority_system_prompt = """
You are the email-intelligence component of Thozhan.

Analyse only the supplied email data.

Return ONLY valid JSON.
Do not return Markdown.
Do not wrap the JSON in code fences.
Do not add commentary before or after the JSON.

Return this exact top-level structure:

{
  "emails": [
    {
      "id": "string",
      "subject": "string",
      "sender": "string",
      "sender_email": "string",
      "date": "string",
      "priority": "high",
      "summary": "string",
      "action": "string",
      "deadline": null,
      "reply_needed": false,
      "reply_status": "no",
      "meeting": null,
      "reason": "string"
    }
  ]
}

Rules:

1. priority must be exactly:
   "high", "normal", or "low".

2. High priority requires evidence in the email, such as:
   - a clearly time-sensitive request
   - a stated deadline
   - an explicit action expected from the user
   - a clear request for a response or confirmation
   - an account/security issue that explicitly says the
     user should act if the activity was not theirs

3. Do not manufacture urgency.
   If an email has no stated deadline, deadline must be null.
   Never turn "None stated" into phrases such as
   "act immediately", "do soon", or an estimated date.

4. Security notifications are contextual.
   If an email says "if this wasn't you", describe that
   condition in the action/reason. Do not claim the account
   is compromised.

5. action:
   - state the concrete action explicitly requested
   - if none is clearly requested, use
     "None clearly stated"

6. reply_status must be exactly:
   "yes", "no", or "unclear".

7. reply_needed:
   - true only when reply_status is "yes"
   - false for "no" and "unclear"

8. Use reply_status "yes" only if the email clearly asks
   for a response, confirmation, answer, or information.

9. deadline:
   - use a string only when the email itself contains a
     date, time, or clearly defined time window
   - otherwise use null
   - do not calculate or infer a deadline

10. meeting:
    - null if no meeting/event is identified
    - otherwise return:
      {
        "title": "string",
        "date": "string or null",
        "time": "string or null",
        "location": "string or null",
        "action": "string"
      }

11. A live session, appointment, interview, scheduled call,
    class, or similar scheduled event may be represented as
    a meeting/event when supported by the email.

12. summary should be concise and factual.

13. reason should briefly explain why the priority was
    assigned, using evidence from the email.

14. Keep the original email id exactly as supplied.

15. Analyse every supplied email. Do not invent emails or
    facts that are absent from the supplied data.
""".strip()

    groq_client = Groq(
        api_key=groq_api_key
    )

    try:
        analysis_response = (
            groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {
                        "role": "system",
                        "content": priority_system_prompt,
                    },
                    {
                        "role": "user",
                        "content": (
                            "Analyse these latest Gmail "
                            "messages:\n\n"
                            + __import__("json").dumps(
                                email_payload,
                                ensure_ascii=False,
                            )
                        ),
                    },
                ],
                temperature=0.1,
                max_completion_tokens=4096,
            )
        )

        raw_analysis = (
            analysis_response
            .choices[0]
            .message
            .content
            or ""
        ).strip()

    except Exception as error:
        print(
            "Priority Groq analysis failed:",
            type(error).__name__,
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to analyse priority emails.",
        )

    # -----------------------------------------------------
    # Parse and validate Groq JSON
    # -----------------------------------------------------

    import json

    cleaned_analysis = raw_analysis

    if cleaned_analysis.startswith("```"):
        cleaned_analysis = cleaned_analysis.strip("`").strip()

        if cleaned_analysis.lower().startswith("json"):
            cleaned_analysis = cleaned_analysis[4:].strip()

    try:
        parsed = json.loads(
            cleaned_analysis
        )

    except json.JSONDecodeError as error:
        print(
            "Priority JSON parse failed:",
            str(error),
        )
        print(
            "Priority raw response:",
            raw_analysis[:1000],
        )

        raise HTTPException(
            status_code=500,
            detail="AI returned an invalid priority response.",
        )

    analysed_emails = parsed.get(
        "emails",
        []
    ) if isinstance(parsed, dict) else []

    if not isinstance(analysed_emails, list):
        analysed_emails = []

    # -----------------------------------------------------
    # Normalise values before sending them to React
    # -----------------------------------------------------

    source_ids = {
        item["id"]
        for item in email_payload
    }

    safe_emails = []

    priority_order = {
        "high": 0,
        "normal": 1,
        "low": 2,
    }

    for item in analysed_emails:
        if not isinstance(item, dict):
            continue

        email_id = str(
            item.get("id")
            or ""
        )

        # Do not allow the model to create new email IDs.
        if email_id not in source_ids:
            continue

        priority = str(
            item.get("priority")
            or "normal"
        ).lower()

        if priority not in {
            "high",
            "normal",
            "low",
        }:
            priority = "normal"

        reply_status = str(
            item.get("reply_status")
            or "unclear"
        ).lower()

        if reply_status not in {
            "yes",
            "no",
            "unclear",
        }:
            reply_status = "unclear"

        deadline = item.get("deadline")

        if not isinstance(deadline, str) or not deadline.strip():
            deadline = None
        else:
            deadline = deadline.strip()

        meeting = item.get("meeting")

        if not isinstance(meeting, dict):
            meeting = None
        else:
            meeting = {
                "title": str(
                    meeting.get("title")
                    or ""
                ),
                "date": (
                    str(meeting.get("date"))
                    if meeting.get("date")
                    else None
                ),
                "time": (
                    str(meeting.get("time"))
                    if meeting.get("time")
                    else None
                ),
                "location": (
                    str(meeting.get("location"))
                    if meeting.get("location")
                    else None
                ),
                "action": str(
                    meeting.get("action")
                    or ""
                ),
            }

        safe_emails.append(
            {
                "id": email_id,
                "subject": str(
                    item.get("subject")
                    or "(No subject)"
                ),
                "sender": str(
                    item.get("sender")
                    or ""
                ),
                "sender_email": str(
                    item.get("sender_email")
                    or ""
                ),
                "date": str(
                    item.get("date")
                    or ""
                ),
                "priority": priority,
                "summary": str(
                    item.get("summary")
                    or ""
                ),
                "action": str(
                    item.get("action")
                    or "None clearly stated"
                ),
                "deadline": deadline,
                "reply_needed": (
                    reply_status == "yes"
                ),
                "reply_status": reply_status,
                "meeting": meeting,
                "reason": str(
                    item.get("reason")
                    or ""
                ),
            }
        )

    safe_emails.sort(
        key=lambda item: priority_order.get(
            item["priority"],
            1,
        )
    )

    return {
        "success": True,
        "count": len(safe_emails),
        "emails": safe_emails,
    }

# =========================================================
# PERSISTENT TASKS
# =========================================================

class TaskStatusRequest(BaseModel):
    status: str


def _normalise_task_row(row: dict) -> dict:
    """Return the stable task shape expected by the frontend."""

    return {
        "task_id": str(row.get("id") or ""),
        "source_email_id": str(row.get("source_email_id") or ""),
        "title": str(row.get("title") or "Review email"),
        "description": str(row.get("description") or ""),
        "source_subject": str(row.get("source_subject") or ""),
        "source_sender": str(row.get("source_sender") or ""),
        "source_sender_email": str(row.get("source_sender_email") or ""),
        "source_date": str(row.get("source_date") or ""),
        "priority": str(row.get("priority") or "normal"),
        "deadline": row.get("deadline"),
        "requires_reply": row.get("requires_reply") is True,
        "status": str(row.get("status") or "pending"),
        "reason": str(row.get("reason") or ""),
        "completed_at": row.get("completed_at"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


@app.get("/api/tasks/live-legacy")
async def get_email_tasks(
    authorization: str | None = Header(default=None),
):
    """
    Analyse the latest Gmail messages, persist newly discovered tasks,
    preserve existing pending/completed state, and return the user's
    stored tasks.

    This endpoint never sends, deletes, or modifies Gmail messages.
    """

    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    # -----------------------------------------------------
    # Load Groq configuration
    # -----------------------------------------------------

    try:
        groq_response = (
            user_supabase
            .table("user_ai_settings")
            .select("encrypted_groq_key,groq_connected")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as error:
        print(
            "Tasks Groq lookup failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load AI configuration.",
        )

    if (
        not groq_response.data
        or not groq_response.data.get("groq_connected")
    ):
        raise HTTPException(
            status_code=400,
            detail="Groq is not connected.",
        )

    encrypted_groq_key = groq_response.data.get("encrypted_groq_key")

    if not encrypted_groq_key:
        raise HTTPException(
            status_code=500,
            detail="Stored Groq credential is missing.",
        )

    # -----------------------------------------------------
    # Load Gmail configuration
    # -----------------------------------------------------

    try:
        gmail_response = (
            user_supabase
            .table("user_gmail_settings")
            .select(
                "gmail_address,"
                "encrypted_app_password,"
                "gmail_connected"
            )
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as error:
        print(
            "Tasks Gmail lookup failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load Gmail configuration.",
        )

    if (
        not gmail_response.data
        or not gmail_response.data.get("gmail_connected")
    ):
        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )

    gmail_address = gmail_response.data.get("gmail_address")
    encrypted_app_password = gmail_response.data.get(
        "encrypted_app_password"
    )

    if not gmail_address:
        raise HTTPException(
            status_code=500,
            detail="Stored Gmail address is missing.",
        )

    if not encrypted_app_password:
        raise HTTPException(
            status_code=500,
            detail="Stored Gmail credential is missing.",
        )

    groq_api_key = decrypt_secret(encrypted_groq_key)
    app_password = decrypt_secret(encrypted_app_password)

    # -----------------------------------------------------
    # Read latest messages through Gmail MCP
    # -----------------------------------------------------

    try:
        gmail_result = await call_gmail_tool(
            tool_name="list_emails",
            arguments={"limit": 10},
            gmail_address=gmail_address,
            app_password=app_password,
        )
    except Exception as error:
        print(
            "Tasks Gmail MCP failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve Gmail messages.",
        )

    if isinstance(gmail_result, list):
        raw_emails = gmail_result
    elif isinstance(gmail_result, dict):
        raw_emails = (
            gmail_result.get("emails")
            or gmail_result.get("result")
            or []
        )

        if isinstance(raw_emails, dict):
            raw_emails = raw_emails.get("emails", [])
    else:
        raw_emails = []

    if not isinstance(raw_emails, list):
        raw_emails = []

    email_payload = []

    for email_item in raw_emails[:10]:
        if not isinstance(email_item, dict):
            continue

        email_payload.append(
            {
                "id": str(
                    email_item.get("id")
                    or email_item.get("uid")
                    or ""
                ),
                "subject": str(
                    email_item.get("subject")
                    or "(No subject)"
                )[:500],
                "sender_name": str(
                    email_item.get("sender_name")
                    or ""
                )[:300],
                "sender_email": str(
                    email_item.get("sender_email")
                    or ""
                )[:300],
                "date": str(
                    email_item.get("date")
                    or ""
                )[:300],
                "body": str(
                    email_item.get("body")
                    or ""
                )[:3000],
            }
        )

    # -----------------------------------------------------
    # Ask Groq to extract only concrete tasks
    # -----------------------------------------------------

    extracted_tasks = []

    if email_payload:
        tasks_system_prompt = """
You are the task-extraction component of Thozhan.

Analyse only the supplied emails and extract concrete tasks
that the user is expected to perform.

Return ONLY valid JSON.
Do not return Markdown.
Do not use code fences.
Do not add commentary outside the JSON.

Return exactly:

{
  "tasks": [
    {
      "id": "email-id",
      "title": "short actionable title",
      "description": "brief factual explanation",
      "source_subject": "email subject",
      "source_sender": "sender",
      "source_sender_email": "sender email",
      "source_date": "email date",
      "priority": "high",
      "deadline": null,
      "requires_reply": false,
      "reason": "evidence for creating the task"
    }
  ]
}

Rules:

1. Create a task only when the email contains a concrete
   action the user is expected or reasonably required to take.

2. Do NOT create tasks from:
   - newsletters
   - advertisements
   - general notifications
   - informational receipts/statements
   - job alerts that merely advertise opportunities
   - security notifications that explicitly require no action
     when the activity is recognized
   unless the email contains a concrete action for the user.

3. Do not manufacture actions.

4. title must begin with a clear action verb where possible,
   such as Reply, Confirm, Submit, Review, Pay, Complete,
   Attend, Schedule, Upload, Sign, Call, or Register.

5. priority must be exactly:
   "high", "normal", or "low".

6. Use high only when the task itself is clearly urgent,
   time-sensitive, security-critical, or has a near explicit
   deadline. Do not infer urgency merely because an email is
   important.

7. deadline:
   - preserve a deadline/date/time only when stated in the email
   - otherwise return null
   - never invent or calculate a deadline

8. requires_reply is true only when the email explicitly asks
   the user to reply, respond, answer, or provide information
   through a reply.

9. Clicking a confirmation link, filling a form, attending an
   event, or completing an external action is not an email reply.

10. reason must briefly state the evidence in the email that
    makes this a real task.

11. Keep the source email id exactly as supplied.

12. A single email may produce more than one task only when it
    clearly contains multiple independent required actions.

13. Do not invent facts absent from the supplied emails.
""".strip()

        import json

        groq_client = Groq(api_key=groq_api_key)

        try:
            analysis_response = groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {
                        "role": "system",
                        "content": tasks_system_prompt,
                    },
                    {
                        "role": "user",
                        "content": (
                            "Extract tasks from these latest "
                            "Gmail messages:\n\n"
                            + json.dumps(
                                email_payload,
                                ensure_ascii=False,
                            )
                        ),
                    },
                ],
                temperature=0.1,
                max_completion_tokens=4096,
            )

            raw_analysis = (
                analysis_response
                .choices[0]
                .message
                .content
                or ""
            ).strip()
        except Exception as error:
            print(
                "Tasks Groq analysis failed:",
                type(error).__name__,
                str(error),
            )
            raise HTTPException(
                status_code=500,
                detail="Unable to extract email tasks.",
            )

        cleaned_analysis = raw_analysis

        if cleaned_analysis.startswith("```"):
            cleaned_analysis = cleaned_analysis.strip("`").strip()

            if cleaned_analysis.lower().startswith("json"):
                cleaned_analysis = cleaned_analysis[4:].strip()

        try:
            parsed = json.loads(cleaned_analysis)
        except json.JSONDecodeError as error:
            print(
                "Tasks JSON parse failed:",
                str(error),
            )
            print(
                "Tasks raw response:",
                raw_analysis[:1000],
            )
            raise HTTPException(
                status_code=500,
                detail="AI returned an invalid tasks response.",
            )

        analysed_tasks = (
            parsed.get("tasks", [])
            if isinstance(parsed, dict)
            else []
        )

        if not isinstance(analysed_tasks, list):
            analysed_tasks = []

        source_ids = {
            item["id"]
            for item in email_payload
        }

        for item in analysed_tasks:
            if not isinstance(item, dict):
                continue

            source_id = str(item.get("id") or "")

            if source_id not in source_ids:
                continue

            title = str(item.get("title") or "").strip()

            if not title:
                continue

            priority = str(
                item.get("priority")
                or "normal"
            ).lower()

            if priority not in {"high", "normal", "low"}:
                priority = "normal"

            deadline = item.get("deadline")

            if (
                not isinstance(deadline, str)
                or not deadline.strip()
            ):
                deadline = None
            else:
                deadline = deadline.strip()

            extracted_tasks.append(
                {
                    "source_email_id": source_id,
                    "title": title[:500],
                    "description": str(
                        item.get("description")
                        or ""
                    )[:3000],
                    "source_subject": str(
                        item.get("source_subject")
                        or ""
                    )[:1000],
                    "source_sender": str(
                        item.get("source_sender")
                        or ""
                    )[:500],
                    "source_sender_email": str(
                        item.get("source_sender_email")
                        or ""
                    )[:500],
                    "source_date": str(
                        item.get("source_date")
                        or ""
                    )[:500],
                    "priority": priority,
                    "deadline": deadline,
                    "requires_reply":
                        item.get("requires_reply") is True,
                    "reason": str(
                        item.get("reason")
                        or ""
                    )[:3000],
                }
            )

    # -----------------------------------------------------
    # Persist only new tasks.
    #
    # The table has:
    # UNIQUE(user_id, source_email_id, title)
    #
    # We deliberately do not overwrite existing rows here.
    # This preserves a user's completed/pending state.
    # -----------------------------------------------------

    try:
        existing_response = (
            user_supabase
            .table("user_tasks")
            .select("id,source_email_id,title")
            .eq("user_id", user_id)
            .execute()
        )

        existing_rows = (
            existing_response.data
            if isinstance(existing_response.data, list)
            else []
        )

        existing_keys = {
            (
                str(row.get("source_email_id") or ""),
                str(row.get("title") or ""),
            )
            for row in existing_rows
            if isinstance(row, dict)
        }

        rows_to_insert = []

        for task in extracted_tasks:
            key = (
                task["source_email_id"],
                task["title"],
            )

            if key in existing_keys:
                continue

            rows_to_insert.append(
                {
                    "user_id": user_id,
                    **task,
                    "status": "pending",
                }
            )

            existing_keys.add(key)

        if rows_to_insert:
            (
                user_supabase
                .table("user_tasks")
                .insert(rows_to_insert)
                .execute()
            )

    except Exception as error:
        print(
            "Tasks persistence failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to save extracted tasks.",
        )

    # -----------------------------------------------------
    # Return all stored tasks for this user.
    # -----------------------------------------------------

    try:
        stored_response = (
            user_supabase
            .table("user_tasks")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        stored_rows = (
            stored_response.data
            if isinstance(stored_response.data, list)
            else []
        )

    except Exception as error:
        print(
            "Stored tasks lookup failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load saved tasks.",
        )

    priority_order = {
        "high": 0,
        "normal": 1,
        "low": 2,
    }

    status_order = {
        "pending": 0,
        "completed": 1,
    }

    tasks = [
        _normalise_task_row(row)
        for row in stored_rows
        if isinstance(row, dict)
    ]

    tasks.sort(
        key=lambda item: (
            status_order.get(item["status"], 0),
            priority_order.get(item["priority"], 1),
        )
    )

    return {
        "success": True,
        "count": len(tasks),
        "tasks": tasks,
    }


@app.patch("/api/tasks/{task_id}/status")
async def update_task_status(
    task_id: str,
    request: TaskStatusRequest,
    authorization: str | None = Header(default=None),
):
    """
    Change one stored task between pending and completed.
    RLS and user_id filtering prevent access to another user's task.
    """

    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    requested_status = request.status.strip().lower()

    if requested_status not in {"pending", "completed"}:
        raise HTTPException(
            status_code=400,
            detail="Task status must be pending or completed.",
        )

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()

    update_values = {
        "status": requested_status,
        "updated_at": now,
        "completed_at": (
            now
            if requested_status == "completed"
            else None
        ),
    }

    try:
        update_response = (
            user_supabase
            .table("user_tasks")
            .update(update_values)
            .eq("id", task_id)
            .eq("user_id", user_id)
            .execute()
        )

        updated_rows = (
            update_response.data
            if isinstance(update_response.data, list)
            else []
        )

    except Exception as error:
        print(
            "Task status update failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to update task status.",
        )

    if not updated_rows:
        raise HTTPException(
            status_code=404,
            detail="Task not found.",
        )

    return {
        "success": True,
        "task": _normalise_task_row(
            updated_rows[0]
        ),
    }


# =========================================================
# PROFILE / NOTIFICATION SETTINGS
# =========================================================

class UserSettingsRequest(BaseModel):
    full_name: str = ""
    time_zone: str = "Pacific/Auckland"
    notify_priority_email: bool = True
    notify_meeting_request: bool = True
    notify_task_deadline: bool = True
    notify_calendar_event: bool = True


def _default_user_settings(user) -> dict:
    metadata = getattr(user, "user_metadata", None) or {}
    email = getattr(user, "email", None)

    return {
        "full_name": (
            metadata.get("name")
            or metadata.get("full_name")
            or (email.split("@")[0] if email else "")
        ),
        "email": email,
        "time_zone": "Pacific/Auckland",
        "notify_priority_email": True,
        "notify_meeting_request": True,
        "notify_task_deadline": True,
        "notify_calendar_event": True,
    }


@app.get("/api/settings")
async def get_user_settings(
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    defaults = _default_user_settings(user)

    try:
        response = (
            user_supabase
            .table("user_preferences")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        row = (
            getattr(response, "data", None)
            if response is not None
            else None
        )

        if not isinstance(row, dict):
            return {
                "success": True,
                "settings": defaults,
            }

        return {
            "success": True,
            "settings": {
                **defaults,
                "full_name": row.get("full_name") or defaults["full_name"],
                "time_zone": row.get("time_zone") or "Pacific/Auckland",
                "notify_priority_email": bool(
                    row.get("notify_priority_email", True)
                ),
                "notify_meeting_request": bool(
                    row.get("notify_meeting_request", True)
                ),
                "notify_task_deadline": bool(
                    row.get("notify_task_deadline", True)
                ),
                "notify_calendar_event": bool(
                    row.get("notify_calendar_event", True)
                ),
            },
        }

    except Exception as error:
        print(
            "Settings lookup failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load profile settings.",
        )


@app.put("/api/settings")
async def update_user_settings(
    request: UserSettingsRequest,
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    full_name = request.full_name.strip()
    time_zone = request.time_zone.strip() or "Pacific/Auckland"

    if len(full_name) > 100:
        raise HTTPException(
            status_code=400,
            detail="Name is too long.",
        )

    values = {
        "user_id": user_id,
        "full_name": full_name,
        "time_zone": time_zone,
        "notify_priority_email": request.notify_priority_email,
        "notify_meeting_request": request.notify_meeting_request,
        "notify_task_deadline": request.notify_task_deadline,
        "notify_calendar_event": request.notify_calendar_event,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        (
            user_supabase
            .table("user_preferences")
            .upsert(
                values,
                on_conflict="user_id",
            )
            .execute()
        )

        # Keep Supabase Auth display metadata aligned with the profile name.
        if full_name:
            try:
                user_supabase.auth.update_user(
                    {
                        "data": {
                            "name": full_name,
                        }
                    }
                )
            except Exception as metadata_error:
                print(
                    "Auth display-name update skipped:",
                    type(metadata_error).__name__,
                )

    except Exception as error:
        print(
            "Settings save failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to save profile settings.",
        )

    return {
        "success": True,
        "message": "Settings saved.",
        "settings": {
            **values,
            "email": getattr(user, "email", None),
        },
    }


# =========================================================
# GOOGLE CALENDAR / MEETINGS
# =========================================================

class CalendarAvailabilityRequest(BaseModel):
    time_min: str
    time_max: str
    time_zone: str = "Pacific/Auckland"


class CalendarCreateEventRequest(BaseModel):
    summary: str
    start: str
    end: str
    time_zone: str = "Pacific/Auckland"
    description: str = ""
    location: str = ""
    attendees: list[str] = []


def _calendar_oauth_config():
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
    redirect_uri = os.getenv(
        "GOOGLE_OAUTH_REDIRECT_URI",
        "http://localhost:8000/api/calendar/oauth/callback",
    ).strip()

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=500,
            detail=(
                "Google Calendar OAuth is not configured. "
                "Add GOOGLE_OAUTH_CLIENT_ID and "
                "GOOGLE_OAUTH_CLIENT_SECRET to backend/.env."
            ),
        )

    return client_id, client_secret, redirect_uri


def _calendar_scopes() -> list[str]:
    return [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.freebusy",
    ]


def _make_calendar_state(access_token: str, user_id: str) -> str:
    import json
    import time

    payload = {
        "access_token": access_token,
        "user_id": user_id,
        "created_at": int(time.time()),
    }

    # Reuse the application's existing Fernet helper instead of
    # referencing a module-level `cipher` variable that does not exist.
    return encrypt_secret(
        json.dumps(payload)
    )


def _read_calendar_state(state: str) -> dict:
    import json
    import time

    try:
        # Decrypt with the same helper used for the rest of
        # Thozhan's encrypted secrets.
        raw = decrypt_secret(state)

        payload = json.loads(raw)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid Google OAuth state.",
        )

    created_at = int(payload.get("created_at") or 0)

    if int(time.time()) - created_at > 900:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth session expired. Please connect again.",
        )

    return payload


def _parse_google_expiry(expires_in: int | str | None) -> str:
    from datetime import datetime, timedelta, timezone

    seconds = int(expires_in or 3600)

    return (
        datetime.now(timezone.utc)
        + timedelta(seconds=max(60, seconds - 30))
    ).isoformat()


async def _get_calendar_access_token(
    user_id: str,
    user_supabase,
) -> str:
    import requests
    from datetime import datetime, timezone

    try:
        response = (
            user_supabase
            .table("user_calendar_settings")
            .select(
                "encrypted_access_token,"
                "encrypted_refresh_token,"
                "token_expires_at,"
                "calendar_connected"
            )
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as error:
        print(
            "Calendar settings lookup failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load Calendar configuration.",
        )

    row = response.data

    if not row or not row.get("calendar_connected"):
        raise HTTPException(
            status_code=400,
            detail="Google Calendar is not connected.",
        )

    encrypted_access = row.get("encrypted_access_token")
    encrypted_refresh = row.get("encrypted_refresh_token")
    expires_at = row.get("token_expires_at")

    if not encrypted_access:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar needs to be reconnected.",
        )

    access_token = decrypt_secret(encrypted_access)

    token_valid = False

    if expires_at:
        try:
            parsed_expiry = datetime.fromisoformat(
                str(expires_at).replace("Z", "+00:00")
            )
            token_valid = (
                parsed_expiry
                > datetime.now(timezone.utc)
            )
        except Exception:
            token_valid = False

    if token_valid:
        return access_token

    if not encrypted_refresh:
        raise HTTPException(
            status_code=401,
            detail="Google Calendar authorization expired. Reconnect Calendar.",
        )

    refresh_token = decrypt_secret(encrypted_refresh)
    client_id, client_secret, _ = _calendar_oauth_config()

    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )

    if not token_response.ok:
        print(
            "Google token refresh failed:",
            token_response.status_code,
            token_response.text[:500],
        )
        raise HTTPException(
            status_code=401,
            detail="Google Calendar authorization expired. Reconnect Calendar.",
        )

    token_data = token_response.json()
    new_access = token_data.get("access_token")

    if not new_access:
        raise HTTPException(
            status_code=500,
            detail="Google did not return a Calendar access token.",
        )

    update_values = {
        "encrypted_access_token": encrypt_secret(new_access),
        "token_expires_at": _parse_google_expiry(
            token_data.get("expires_in")
        ),
        "calendar_connected": True,
    }

    (
        user_supabase
        .table("user_calendar_settings")
        .update(update_values)
        .eq("user_id", user_id)
        .execute()
    )

    return new_access


@app.get("/api/calendar/status")
async def calendar_status(
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    try:
        response = (
            user_supabase
            .table("user_calendar_settings")
            .select(
                "calendar_connected,"
                "google_email,"
                "updated_at"
            )
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as error:
        print(
            "Calendar status failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to read Calendar status.",
        )

    # No row is normal before the user connects Google Calendar.
    row = {}

    if response is not None:
        response_data = getattr(response, "data", None)

        if isinstance(response_data, dict):
            row = response_data

    return {
        "connected": row.get("calendar_connected") is True,
        "google_email": row.get("google_email"),
        "updated_at": row.get("updated_at"),
    }


@app.get("/api/calendar/oauth/start")
async def calendar_oauth_start(
    authorization: str | None = Header(default=None),
):
    from urllib.parse import urlencode

    user, access_token = get_authenticated_user(authorization)
    client_id, _, redirect_uri = _calendar_oauth_config()

    state = _make_calendar_state(
        access_token=access_token,
        user_id=str(user.id),
    )

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(_calendar_scopes()),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }

    return {
        "authorization_url":
            "https://accounts.google.com/o/oauth2/v2/auth?"
            + urlencode(params)
    }


@app.get("/api/calendar/oauth/callback")
async def calendar_oauth_callback(
    code: str = "",
    state: str = "",
    error: str = "",
):
    import requests
    from fastapi.responses import RedirectResponse

    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:3000",
    ).rstrip("/")

    if error:
        return RedirectResponse(
            f"{frontend_url}/meetings?calendar=denied"
        )

    if not code or not state:
        return RedirectResponse(
            f"{frontend_url}/meetings?calendar=error"
        )

    payload = _read_calendar_state(state)
    access_token = payload.get("access_token", "")
    expected_user_id = str(payload.get("user_id") or "")

    user = get_authenticated_user(
        f"Bearer {access_token}"
    )[0]

    if str(user.id) != expected_user_id:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth user state mismatch.",
        )

    user_supabase = get_user_supabase_client(access_token)
    client_id, client_secret, redirect_uri = _calendar_oauth_config()

    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
        timeout=20,
    )

    if not token_response.ok:
        print(
            "Google OAuth exchange failed:",
            token_response.status_code,
            token_response.text[:500],
        )
        return RedirectResponse(
            f"{frontend_url}/meetings?calendar=error"
        )

    token_data = token_response.json()
    google_access = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")

    if not google_access:
        return RedirectResponse(
            f"{frontend_url}/meetings?calendar=error"
        )

    # We intentionally use the app user's known email as a display label.
    # Calendar OAuth may be connected to another Google account, so this is
    # only a label until an identity scope is added later.
    google_email = getattr(user, "email", None)

    values = {
        "user_id": expected_user_id,
        "google_email": google_email,
        "encrypted_access_token": encrypt_secret(google_access),
        "token_expires_at": _parse_google_expiry(
            token_data.get("expires_in")
        ),
        "calendar_connected": True,
    }

    if refresh_token:
        values["encrypted_refresh_token"] = encrypt_secret(
            refresh_token
        )

    existing = (
        user_supabase
        .table("user_calendar_settings")
        .select("id")
        .eq("user_id", expected_user_id)
        .maybe_single()
        .execute()
    )

    # A first-time Calendar connection has no existing settings row.
    # Supabase maybe_single() may return None in that case.
    existing_data = (
        getattr(existing, "data", None)
        if existing is not None
        else None
    )

    if existing_data:
        (
            user_supabase
            .table("user_calendar_settings")
            .update(values)
            .eq("user_id", expected_user_id)
            .execute()
        )
    else:
        (
            user_supabase
            .table("user_calendar_settings")
            .insert(values)
            .execute()
        )

    return RedirectResponse(
        f"{frontend_url}/meetings?calendar=connected"
    )


@app.get("/api/calendar/events")
async def calendar_events(
    authorization: str | None = Header(default=None),
):
    from datetime import datetime, timedelta, timezone

    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    google_access = await _get_calendar_access_token(
        user_id,
        user_supabase,
    )

    now = datetime.now(timezone.utc)
    time_max = now + timedelta(days=30)

    try:
        result = await call_calendar_tool(
            tool_name="list_events",
            arguments={
                "time_min": now.isoformat(),
                "time_max": time_max.isoformat(),
                "max_results": 20,
            },
            access_token=google_access,
        )
    except Exception as error:
        print(
            "Calendar MCP list events failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to load Calendar events.",
        )

    return {
        "success": True,
        **(result if isinstance(result, dict) else {"events": []}),
    }


@app.post("/api/calendar/availability")
async def calendar_availability(
    request: CalendarAvailabilityRequest,
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    google_access = await _get_calendar_access_token(
        user_id,
        user_supabase,
    )

    try:
        result = await call_calendar_tool(
            tool_name="check_availability",
            arguments={
                "time_min": request.time_min,
                "time_max": request.time_max,
                "time_zone": request.time_zone,
            },
            access_token=google_access,
        )
    except Exception as error:
        print(
            "Calendar MCP availability failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to check Calendar availability.",
        )

    return {
        "success": True,
        **(result if isinstance(result, dict) else {}),
    }


@app.post("/api/calendar/events")
async def calendar_create_event(
    request: CalendarCreateEventRequest,
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    google_access = await _get_calendar_access_token(
        user_id,
        user_supabase,
    )

    try:
        availability = await call_calendar_tool(
            tool_name="check_availability",
            arguments={
                "time_min": request.start,
                "time_max": request.end,
                "time_zone": request.time_zone,
            },
            access_token=google_access,
        )
    except Exception as error:
        print(
            "Calendar pre-create availability failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to verify Calendar availability.",
        )

    if (
        isinstance(availability, dict)
        and availability.get("is_free") is False
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "That time is busy on your calendar. "
                "Choose another time before creating the event."
            ),
        )

    try:
        result = await call_calendar_tool(
            tool_name="create_event",
            arguments={
                "summary": request.summary,
                "start": request.start,
                "end": request.end,
                "time_zone": request.time_zone,
                "description": request.description,
                "location": request.location,
                "attendees": request.attendees,
            },
            access_token=google_access,
        )
    except Exception as error:
        print(
            "Calendar MCP create event failed:",
            type(error).__name__,
            str(error),
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to create Calendar event.",
        )

    return {
        "success": True,
        "event": result,
    }


@app.get("/api/meetings/live-legacy")
async def detect_meetings(
    authorization: str | None = Header(default=None),
):
    import json

    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    groq_response = (
        user_supabase
        .table("user_ai_settings")
        .select("encrypted_groq_key,groq_connected")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    gmail_response = (
        user_supabase
        .table("user_gmail_settings")
        .select(
            "gmail_address,"
            "encrypted_app_password,"
            "gmail_connected"
        )
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if (
        not groq_response.data
        or not groq_response.data.get("groq_connected")
    ):
        raise HTTPException(
            status_code=400,
            detail="Groq is not connected.",
        )

    if (
        not gmail_response.data
        or not gmail_response.data.get("gmail_connected")
    ):
        raise HTTPException(
            status_code=400,
            detail="Gmail is not connected.",
        )

    groq_api_key = decrypt_secret(
        groq_response.data["encrypted_groq_key"]
    )

    gmail_address = gmail_response.data["gmail_address"]
    app_password = decrypt_secret(
        gmail_response.data["encrypted_app_password"]
    )

    gmail_result = await call_gmail_tool(
        tool_name="list_emails",
        arguments={"limit": 15},
        gmail_address=gmail_address,
        app_password=app_password,
    )

    if isinstance(gmail_result, list):
        raw_emails = gmail_result
    elif isinstance(gmail_result, dict):
        raw_emails = (
            gmail_result.get("emails")
            or gmail_result.get("result")
            or []
        )
        if isinstance(raw_emails, dict):
            raw_emails = raw_emails.get("emails", [])
    else:
        raw_emails = []

    email_payload = []

    for item in raw_emails[:15]:
        if not isinstance(item, dict):
            continue

        email_payload.append(
            {
                "id": str(
                    item.get("id")
                    or item.get("uid")
                    or ""
                ),
                "subject": str(
                    item.get("subject")
                    or "(No subject)"
                )[:500],
                "sender_name": str(
                    item.get("sender_name")
                    or ""
                )[:300],
                "sender_email": str(
                    item.get("sender_email")
                    or ""
                )[:300],
                "date": str(
                    item.get("date")
                    or ""
                )[:300],
                "body": str(
                    item.get("body")
                    or ""
                )[:3000],
            }
        )

    if not email_payload:
        return {
            "success": True,
            "count": 0,
            "meetings": [],
        }

    system_prompt = """
You are Thozhan's meeting-request detector.

Analyse only the supplied emails.

Return ONLY valid JSON:
{
  "meetings": [
    {
      "email_id": "source email id",
      "subject": "email subject",
      "sender": "sender name",
      "sender_email": "sender email",
      "purpose": "short meeting purpose",
      "requested": true,
      "proposed_start": null,
      "proposed_end": null,
      "duration_minutes": null,
      "location": null,
      "meeting_link": null,
      "needs_response": true,
      "confidence": "high",
      "reason": "brief evidence"
    }
  ]
}

Rules:
- Include only genuine meeting, call, interview, appointment,
  class/session, or scheduling requests.
- Exclude newsletters and event advertisements unless the
  sender specifically expects the user to attend/respond.
- Never invent a date or time.
- proposed_start/proposed_end must be null unless the email
  clearly states enough information to identify them.
- Preserve date/time wording faithfully; do not silently guess
  a year, timezone, or missing AM/PM.
- duration_minutes must be null unless explicit or directly
  derivable from explicit start/end times.
- needs_response is true when the sender asks for confirmation,
  availability, acceptance, scheduling, or a reply.
- confidence must be high, medium, or low.
- Keep the source email_id exactly as supplied.
""".strip()

    client = Groq(api_key=groq_api_key)

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": json.dumps(
                    email_payload,
                    ensure_ascii=False,
                ),
            },
        ],
        temperature=0.1,
        max_completion_tokens=4096,
    )

    raw = (
        response.choices[0].message.content
        or ""
    ).strip()

    if raw.startswith("```"):
        raw = raw.strip("`").strip()
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="AI returned an invalid meetings response.",
        )

    meetings = (
        parsed.get("meetings", [])
        if isinstance(parsed, dict)
        else []
    )

    if not isinstance(meetings, list):
        meetings = []

    source_ids = {
        item["id"]
        for item in email_payload
    }

    safe = []

    for item in meetings:
        if not isinstance(item, dict):
            continue

        email_id = str(
            item.get("email_id")
            or ""
        )

        if email_id not in source_ids:
            continue

        confidence = str(
            item.get("confidence")
            or "medium"
        ).lower()

        if confidence not in {
            "high",
            "medium",
            "low",
        }:
            confidence = "medium"

        safe.append(
            {
                "email_id": email_id,
                "subject": str(item.get("subject") or ""),
                "sender": str(item.get("sender") or ""),
                "sender_email": str(
                    item.get("sender_email")
                    or ""
                ),
                "purpose": str(item.get("purpose") or ""),
                "requested": item.get("requested") is True,
                "proposed_start": item.get("proposed_start"),
                "proposed_end": item.get("proposed_end"),
                "duration_minutes": item.get("duration_minutes"),
                "location": item.get("location"),
                "meeting_link": item.get("meeting_link"),
                "needs_response": item.get("needs_response") is True,
                "confidence": confidence,
                "reason": str(item.get("reason") or ""),
            }
        )

    return {
        "success": True,
        "count": len(safe),
        "meetings": safe,
    }



# =========================================================
# PERFORMANCE LAYER: CACHED EMAIL INTELLIGENCE
# =========================================================
#
# Normal page navigation now reads Supabase only.
# Expensive Gmail + Groq work happens only through POST /api/sync.
# Each Gmail message ID is analysed once and cached.

class SyncRequest(BaseModel):
    limit: int = 20


def _response_data(response):
    if response is None:
        return None
    return getattr(response, "data", None)


def _clean_json_content(raw: str) -> str:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`").strip()
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    return raw


@app.get("/api/sync/status")
async def sync_status(
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    try:
        response = (
            user_supabase
            .table("email_intelligence")
            .select("processed_at")
            .eq("user_id", user_id)
            .order("processed_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = _response_data(response)
        last_synced = (
            rows[0].get("processed_at")
            if isinstance(rows, list) and rows
            else None
        )
    except Exception as error:
        print("Sync status failed:", type(error).__name__, str(error))
        last_synced = None

    return {
        "success": True,
        "last_synced": last_synced,
    }


@app.post("/api/sync")
async def sync_email_intelligence(
    request: SyncRequest,
    authorization: str | None = Header(default=None),
):
    import json

    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    limit = max(1, min(int(request.limit or 20), 30))

    # Load credentials only when the user explicitly syncs.
    groq_response = (
        user_supabase
        .table("user_ai_settings")
        .select("encrypted_groq_key,groq_connected")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    gmail_response = (
        user_supabase
        .table("user_gmail_settings")
        .select("gmail_address,encrypted_app_password,gmail_connected")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    groq_row = _response_data(groq_response) or {}
    gmail_row = _response_data(gmail_response) or {}

    if not groq_row.get("groq_connected"):
        raise HTTPException(status_code=400, detail="Groq is not connected.")
    if not gmail_row.get("gmail_connected"):
        raise HTTPException(status_code=400, detail="Gmail is not connected.")

    groq_api_key = decrypt_secret(groq_row["encrypted_groq_key"])
    gmail_address = gmail_row["gmail_address"]
    app_password = decrypt_secret(gmail_row["encrypted_app_password"])

    # One Gmail MCP call.
    gmail_result = await call_gmail_tool(
        tool_name="list_emails",
        arguments={"limit": limit},
        gmail_address=gmail_address,
        app_password=app_password,
    )

    if isinstance(gmail_result, list):
        raw_emails = gmail_result
    elif isinstance(gmail_result, dict):
        raw_emails = gmail_result.get("emails") or gmail_result.get("result") or []
        if isinstance(raw_emails, dict):
            raw_emails = raw_emails.get("emails", [])
    else:
        raw_emails = []

    email_payload = []
    for item in raw_emails[:limit]:
        if not isinstance(item, dict):
            continue
        email_id = str(item.get("id") or item.get("uid") or "").strip()
        if not email_id:
            continue
        email_payload.append({
            "id": email_id,
            "subject": str(item.get("subject") or "(No subject)")[:500],
            "sender_name": str(item.get("sender_name") or "")[:300],
            "sender_email": str(item.get("sender_email") or "")[:300],
            "date": str(item.get("date") or "")[:300],
            "body": str(item.get("body") or "")[:4000],
        })

    if not email_payload:
        return {
            "success": True,
            "checked": 0,
            "new_emails": 0,
            "processed": 0,
            "message": "No emails found.",
        }

    ids = [item["id"] for item in email_payload]

    existing_response = (
        user_supabase
        .table("email_intelligence")
        .select("email_id")
        .eq("user_id", user_id)
        .in_("email_id", ids)
        .execute()
    )
    existing_rows = _response_data(existing_response) or []
    existing_ids = {
        str(row.get("email_id"))
        for row in existing_rows
        if isinstance(row, dict)
    }

    new_emails = [
        item for item in email_payload
        if item["id"] not in existing_ids
    ]

    if not new_emails:
        return {
            "success": True,
            "checked": len(email_payload),
            "new_emails": 0,
            "processed": 0,
            "message": "Inbox is already up to date.",
        }

    # Bound first-sync latency/cost. Remaining messages are picked up next sync.
    batch = new_emails[:10]

    system_prompt = """
You are Thozhan's email intelligence engine.

Analyse ONLY the supplied emails. Return ONLY valid JSON:
{
  "emails": [
    {
      "email_id": "exact source id",
      "priority": {
        "id": "exact source id",
        "subject": "subject",
        "sender": "sender display name",
        "sender_email": "sender email",
        "date": "source date",
        "priority": "high|normal|low",
        "summary": "one concise summary",
        "action": "specific user action or No action required",
        "deadline": null,
        "reply_needed": false,
        "reply_status": "yes|no|unclear",
        "meeting": null,
        "reason": "short priority reason"
      },
      "tasks": [
        {
          "title": "short concrete action",
          "description": "what the user needs to do",
          "priority": "high|normal|low",
          "deadline": null,
          "requires_reply": false,
          "reason": "brief evidence"
        }
      ],
      "meeting": null
    }
  ]
}

When an email genuinely contains a meeting/call/interview/appointment/class
or scheduling request, "meeting" may instead be:
{
  "email_id": "exact source id",
  "subject": "subject",
  "sender": "sender name",
  "sender_email": "sender email",
  "purpose": "short purpose",
  "requested": true,
  "proposed_start": null,
  "proposed_end": null,
  "duration_minutes": null,
  "location": null,
  "meeting_link": null,
  "needs_response": true,
  "confidence": "high|medium|low",
  "reason": "brief evidence"
}

Rules:
- Keep email_id exactly as supplied.
- Never invent dates, times, deadlines, people, links, or locations.
- proposed_start/proposed_end must be null unless the email gives enough
  information to identify them safely.
- A task must be a concrete action expected from the user; newsletters and
  FYI messages normally produce an empty tasks array.
- high priority requires real urgency, deadline, risk, or importance.
- reply_status is yes, no, or unclear.
- priority.meeting should be null unless useful meeting information is clearly
  present; the separate meeting object is the canonical meeting extraction.
- Keep output concise.
""".strip()

    client = Groq(api_key=groq_api_key)
    ai_response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(batch, ensure_ascii=False),
            },
        ],
        temperature=0.1,
        max_completion_tokens=6000,
    )

    raw = _clean_json_content(
        ai_response.choices[0].message.content or ""
    )

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="AI returned invalid sync data. Please try Sync again.",
        )

    analysed = parsed.get("emails", []) if isinstance(parsed, dict) else []
    if not isinstance(analysed, list):
        analysed = []

    source_by_id = {item["id"]: item for item in batch}
    now = datetime.now(timezone.utc).isoformat()
    cache_rows = []
    task_rows = []

    for result in analysed:
        if not isinstance(result, dict):
            continue

        email_id = str(result.get("email_id") or "")
        source = source_by_id.get(email_id)
        if not source:
            continue

        priority = result.get("priority")
        if not isinstance(priority, dict):
            priority = {}

        level = str(priority.get("priority") or "normal").lower()
        if level not in {"high", "normal", "low"}:
            level = "normal"

        reply_status = str(priority.get("reply_status") or "unclear").lower()
        if reply_status not in {"yes", "no", "unclear"}:
            reply_status = "unclear"

        priority_data = {
            "id": email_id,
            "subject": str(priority.get("subject") or source["subject"]),
            "sender": str(priority.get("sender") or source["sender_name"]),
            "sender_email": str(
                priority.get("sender_email") or source["sender_email"]
            ),
            "date": str(priority.get("date") or source["date"]),
            "priority": level,
            "summary": str(priority.get("summary") or ""),
            "action": str(priority.get("action") or "No action required"),
            "deadline": priority.get("deadline"),
            "reply_needed": priority.get("reply_needed") is True,
            "reply_status": reply_status,
            "meeting": (
                priority.get("meeting")
                if isinstance(priority.get("meeting"), dict)
                else None
            ),
            "reason": str(priority.get("reason") or ""),
        }

        meeting = result.get("meeting")
        meeting_data = meeting if isinstance(meeting, dict) else None

        cache_rows.append({
            "user_id": user_id,
            "email_id": email_id,
            "subject": source["subject"],
            "sender_name": source["sender_name"],
            "sender_email": source["sender_email"],
            "source_date": source["date"],
            "priority_data": priority_data,
            "meeting_data": meeting_data,
            "processed_at": now,
        })

        tasks = result.get("tasks")
        if not isinstance(tasks, list):
            tasks = []

        for task in tasks:
            if not isinstance(task, dict):
                continue
            title = str(task.get("title") or "").strip()
            if not title:
                continue
            task_priority = str(task.get("priority") or "normal").lower()
            if task_priority not in {"high", "normal", "low"}:
                task_priority = "normal"

            task_rows.append({
                "user_id": user_id,
                "source_email_id": email_id,
                "title": title[:500],
                "description": str(task.get("description") or "")[:3000],
                "source_subject": source["subject"],
                "source_sender": source["sender_name"],
                "source_sender_email": source["sender_email"],
                "source_date": source["date"],
                "priority": task_priority,
                "deadline": task.get("deadline"),
                "requires_reply": task.get("requires_reply") is True,
                "status": "pending",
                "reason": str(task.get("reason") or "")[:2000],
                "updated_at": now,
            })

    # Cache processed intelligence.
    if cache_rows:
        (
            user_supabase
            .table("email_intelligence")
            .upsert(
                cache_rows,
                on_conflict="user_id,email_id",
            )
            .execute()
        )

    # Preserve task completion state: only insert missing task keys.
    inserted_tasks = 0
    for task in task_rows:
        try:
            (
                user_supabase
                .table("user_tasks")
                .insert(task)
                .execute()
            )
            inserted_tasks += 1
        except Exception as error:
            # user_tasks already has unique(user_id, source_email_id, title).
            # Duplicate task = already known, so preserve its current status.
            error_text = str(error).lower()
            if "duplicate" not in error_text and "unique" not in error_text:
                print(
                    "Sync task insert skipped:",
                    type(error).__name__,
                    str(error)[:300],
                )

    return {
        "success": True,
        "checked": len(email_payload),
        "new_emails": len(new_emails),
        "processed": len(cache_rows),
        "tasks_added": inserted_tasks,
        "remaining_new": max(0, len(new_emails) - len(batch)),
        "message": (
            "Sync complete."
            if len(new_emails) <= len(batch)
            else "Sync complete. More new emails remain; press Sync again."
        ),
    }


@app.get("/api/priority")
async def get_cached_priority(
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    response = (
        user_supabase
        .table("email_intelligence")
        .select("priority_data,processed_at")
        .eq("user_id", user_id)
        .order("processed_at", desc=True)
        .limit(50)
        .execute()
    )

    rows = _response_data(response) or []
    emails = [
        row.get("priority_data")
        for row in rows
        if isinstance(row, dict)
        and isinstance(row.get("priority_data"), dict)
    ]

    order = {"high": 0, "normal": 1, "low": 2}
    emails.sort(key=lambda item: order.get(item.get("priority"), 1))

    return {
        "success": True,
        "count": len(emails),
        "emails": emails,
    }


@app.get("/api/tasks")
async def get_cached_tasks(
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    response = (
        user_supabase
        .table("user_tasks")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    rows = _response_data(response) or []
    priority_order = {"high": 0, "normal": 1, "low": 2}
    status_order = {"pending": 0, "completed": 1}

    tasks = [
        _normalise_task_row(row)
        for row in rows
        if isinstance(row, dict)
    ]
    tasks.sort(
        key=lambda item: (
            status_order.get(item["status"], 0),
            priority_order.get(item["priority"], 1),
        )
    )

    return {
        "success": True,
        "count": len(tasks),
        "tasks": tasks,
    }


@app.get("/api/meetings")
async def get_cached_meetings(
    authorization: str | None = Header(default=None),
):
    user, access_token = get_authenticated_user(authorization)
    user_id = str(user.id)
    user_supabase = get_user_supabase_client(access_token)

    response = (
        user_supabase
        .table("email_intelligence")
        .select("meeting_data,processed_at")
        .eq("user_id", user_id)
        .order("processed_at", desc=True)
        .limit(50)
        .execute()
    )

    rows = _response_data(response) or []
    meetings = [
        row.get("meeting_data")
        for row in rows
        if isinstance(row, dict)
        and isinstance(row.get("meeting_data"), dict)
    ]

    return {
        "success": True,
        "count": len(meetings),
        "meetings": meetings,
    }
