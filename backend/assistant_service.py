import json
from typing import Any

from groq import Groq

from mcp_client import call_gmail_tool


# =========================================================
# CONFIGURATION
# =========================================================

MODEL = "openai/gpt-oss-120b"

MAX_TOOL_ROUNDS = 3


# =========================================================
# SYSTEM PROMPT
# =========================================================

SYSTEM_PROMPT = """
You are Thozhan, a personal AI email companion.

Your job is to help the user understand and manage their
email inbox.

You have access to Gmail tools.

Use the Gmail tools whenever the user's request requires
information from their actual inbox.

Examples:

- "What are my latest emails?"
  -> use list_emails

- "Do I have emails from my university?"
  -> use search_emails

- "Show me the full email with this message ID"
  -> use read_email

- "Which of my recent emails need attention?"
  -> use list_emails, then analyse the returned emails

- "Which emails need a reply?"
  -> use list_emails or search_emails as appropriate,
     then determine whether the sender clearly expects
     a response

Never claim that you checked the user's Gmail unless you
actually used a Gmail tool.

EMAIL INTELLIGENCE

When the user asks about priority, important emails,
actions, deadlines, meetings, or replies, analyse the
retrieved emails using the following rules.

1. PRIORITY

Classify an email as High, Normal, or Low priority.

High priority may include:
- a clearly stated deadline or time-sensitive request
- an explicit request for the user to take action
- an email that clearly requires a response
- a meeting, appointment, interview, class, assessment,
  payment, account, security, or work item requiring
  timely attention
- a clearly important message whose consequence of
  ignoring it is stated or strongly evident from the email

Normal priority may include:
- useful informational messages
- updates that matter but do not clearly require
  immediate action
- routine correspondence

Low priority may include:
- newsletters
- marketing
- promotions
- automated informational messages with no clear action
- non-urgent notifications

Do not classify something as High merely because the
subject sounds important. Base priority on the actual
retrieved email content.

2. ACTION REQUIRED

Identify the concrete action the user is being asked to
take.

Examples:
- reply to the sender
- submit a document
- complete a form
- attend a meeting
- confirm availability
- make a payment
- review information

If no action is clearly requested, say:
"None clearly stated."

Do not invent an action.

3. REPLY NEEDED

Use:
- Yes
- No
- Unclear

Use Yes only when the email clearly asks a question,
requests confirmation, asks for information, or otherwise
indicates that a response is expected.

Use No when the message is clearly informational or
automated and does not request a response.

Use Unclear when the email does not provide enough
evidence.

Do not infer that every important email needs a reply.

4. DEADLINES

Report a deadline only when a date, time, or clearly
defined time window is present in the retrieved email.

Preserve the wording of the deadline when useful.

If no deadline is clearly present, say:
"None stated."

Never invent or estimate a deadline.

5. MEETINGS

Identify a meeting request when the email clearly refers
to scheduling, attending, confirming, rescheduling, or
joining a meeting, appointment, interview, call, class,
or similar event.

When available, report:
- event or meeting name
- date
- time
- location or meeting method
- action required

If these details are absent, do not invent them.

6. SUMMARIES

Summaries should focus on:
- what happened
- why it matters to the user
- what the user needs to do next

Keep summaries concise unless the user requests detail.

7. EVIDENCE AND UNCERTAINTY

Distinguish facts stated in the email from your
interpretation.

If information is ambiguous, explicitly say:
"Unclear from the email."

Never invent:
- deadlines
- actions
- sender intentions
- meeting details
- urgency
- reply requirements
- facts not present in the retrieved message

8. PRIORITY / ACTION RESPONSE FORMAT

When the user asks which emails need attention, actions,
deadlines, priority, or replies, use a clear format for
each relevant email:

Email: <subject or useful identifier>
From: <sender>
Priority: High | Normal | Low
Summary: <short summary>
Action: <required action or "None clearly stated">
Deadline: <deadline or "None stated">
Reply needed: Yes | No | Unclear
Meeting: <meeting details or "No meeting identified">

When several emails are analysed, show the most
actionable/time-sensitive messages first. This ordering is
for inbox organisation only; do not manufacture urgency.

If none of the retrieved emails clearly need attention,
say so instead of forcing an email into the High-priority
category.

GENERAL BEHAVIOUR

When summarising emails:
- be concise
- identify important actions
- mention deadlines if clearly present
- distinguish facts from your interpretation
- do not invent missing information

When the user's request can be answered from the results
already retrieved in the current tool-call sequence, do
not call unnecessary additional tools.

Never reveal:
- Gmail App Passwords
- Groq API keys
- Supabase tokens
- encrypted credentials
- internal authentication information
""".strip()


# =========================================================
# GROQ TOOL DEFINITIONS
# =========================================================

GMAIL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_emails",
            "description": (
                "Retrieve the user's latest Gmail messages. "
                "Use this when the user asks about recent, "
                "latest, new, or current inbox messages."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": (
                            "Number of recent emails to retrieve."
                        ),
                        "minimum": 1,
                        "maximum": 20,
                        "default": 10,
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_email",
            "description": (
                "Read one Gmail message using its message ID. "
                "Use this when the full content of a specific "
                "email is needed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "message_id": {
                        "type": "string",
                        "description": (
                            "The Gmail message identifier returned "
                            "by another Gmail tool."
                        ),
                    },
                },
                "required": [
                    "message_id",
                ],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_emails",
            "description": (
                "Search the user's Gmail messages for text, "
                "a sender, subject, organisation, topic, or "
                "other keyword."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "Text or keyword to search for "
                            "in Gmail."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": (
                            "Maximum number of matching emails "
                            "to retrieve."
                        ),
                        "minimum": 1,
                        "maximum": 20,
                        "default": 10,
                    },
                },
                "required": [
                    "query",
                ],
            },
        },
    },
]


# =========================================================
# SERIALISE TOOL RESULTS
# =========================================================

def serialize_tool_result(
    result: Any,
) -> str:
    if isinstance(result, str):
        return result

    try:
        return json.dumps(
            result,
            ensure_ascii=False,
            default=str,
        )

    except Exception:
        return str(result)


# =========================================================
# EXECUTE MCP TOOL
# =========================================================

async def execute_gmail_tool(
    tool_name: str,
    arguments: dict,
    gmail_address: str,
    app_password: str,
) -> Any:

    allowed_tools = {
        "list_emails",
        "read_email",
        "search_emails",
    }

    if tool_name not in allowed_tools:
        raise ValueError(
            f"Unsupported Gmail tool: {tool_name}"
        )

    return await call_gmail_tool(
        tool_name=tool_name,
        arguments=arguments,
        gmail_address=gmail_address,
        app_password=app_password,
    )


# =========================================================
# RUN THOZHAN ASSISTANT
# =========================================================

async def run_assistant(
    *,
    user_message: str,
    groq_api_key: str,
    gmail_address: str,
    app_password: str,
) -> dict:

    user_message = user_message.strip()

    if not user_message:
        raise ValueError(
            "User message cannot be empty."
        )

    if not groq_api_key:
        raise ValueError(
            "Groq API key is missing."
        )

    if not gmail_address:
        raise ValueError(
            "Gmail address is missing."
        )

    if not app_password:
        raise ValueError(
            "Gmail credential is missing."
        )

    client = Groq(
        api_key=groq_api_key
    )

    messages: list[Any] = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": user_message,
        },
    ]

    tools_used: list[str] = []

    for _ in range(MAX_TOOL_ROUNDS):

        response = (
            client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=GMAIL_TOOLS,
                tool_choice="auto",
                temperature=0.2,
                max_completion_tokens=2048,
            )
        )

        assistant_message = (
            response
            .choices[0]
            .message
        )

        tool_calls = (
            assistant_message.tool_calls
            or []
        )

        # -------------------------------------------------
        # No tool needed: return Groq's answer
        # -------------------------------------------------

        if not tool_calls:

            content = (
                assistant_message.content
                or ""
            ).strip()

            return {
                "success": True,
                "answer": content,
                "tools_used": tools_used,
            }

        # -------------------------------------------------
        # Store assistant tool-call message
        # -------------------------------------------------

        messages.append(
            assistant_message
        )

        # -------------------------------------------------
        # Execute every requested MCP tool
        # -------------------------------------------------

        for tool_call in tool_calls:

            tool_name = (
                tool_call
                .function
                .name
            )

            raw_arguments = (
                tool_call
                .function
                .arguments
                or "{}"
            )

            try:
                arguments = json.loads(
                    raw_arguments
                )

            except json.JSONDecodeError:
                arguments = {}

            tools_used.append(
                tool_name
            )

            try:
                tool_result = (
                    await execute_gmail_tool(
                        tool_name=tool_name,
                        arguments=arguments,
                        gmail_address=gmail_address,
                        app_password=app_password,
                    )
                )

            except Exception as error:

                tool_result = {
                    "success": False,
                    "error": (
                        f"{type(error).__name__}: "
                        f"{str(error)}"
                    ),
                }

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id":
                        tool_call.id,
                    "name":
                        tool_name,
                    "content":
                        serialize_tool_result(
                            tool_result
                        ),
                }
            )

    # =====================================================
    # FINAL RESPONSE AFTER TOOL LIMIT
    # =====================================================

    final_response = (
        client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=GMAIL_TOOLS,
            tool_choice="none",
            temperature=0.2,
            max_completion_tokens=2048,
        )
    )

    final_content = (
        final_response
        .choices[0]
        .message
        .content
        or ""
    ).strip()

    return {
        "success": True,
        "answer": final_content,
        "tools_used": tools_used,
    }