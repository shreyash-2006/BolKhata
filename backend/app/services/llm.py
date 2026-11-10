import json
import logging
import re
from typing import Any, Dict, Optional
from app.config import settings

logger = logging.getLogger(__name__)

def fallback_parse_utterance(transcript: str) -> Dict[str, Any]:
    """Robust rule-based parser when API key is not present or in fallback mode."""
    text = transcript.strip().lower()

    # Query checks
    if any(q in text for q in ["kitna baaki", "kitna baki", "balance", "baaki hai", "udhaar kitna", "कितना बाकी"]):
        # Extract customer name before 'ka' or 'ki' or 'ke'
        m = re.search(r'([a-zA-Z\u0900-\u097F\s]+?)\s*(?:ka|ki|ke|का|की|के)\s*kitna', text, re.IGNORECASE)
        name = m.group(1).strip() if m else "Verma ji"
        return {
            "intent": "query",
            "query": {
                "query_type": "customer_balance",
                "customer_name": name.title()
            }
        }

    if any(q in text for q in ["kiska paisa pending", "kiska udhaar", "overdue", "pending list", "kispe baaki", "kis kis ka"]):
        return {
            "intent": "query",
            "query": {
                "query_type": "overdue_list"
            }
        }

    if any(q in text for q in ["aaj kiska", "aaj kiska due", "today due", "aaj kon dega"]):
        return {
            "intent": "query",
            "query": {
                "query_type": "due_today"
            }
        }

    # Logging credit or payment
    is_payment = any(w in text for w in ["jama", "paisa diya", "diye", "paid", "mila", "payment", "जमा"])
    action = "payment" if is_payment else "credit"

    # Extract amount
    amount = 0.0
    amt_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', text)
    if amt_match:
        try:
            amount = float(amt_match.group(1))
        except Exception:
            amount = 0.0

    # Extract customer name
    name = "Grahak"
    name_match = re.search(r'^([a-zA-Z\u0900-\u097F\s]+?)\s*(?:ne|ko|se|ने|को|से|\d)', text)
    if name_match:
        name = name_match.group(1).strip().title()
    else:
        words = text.split()
        if len(words) > 0:
            name = words[0].title()

    # Due date hint
    due_date_hint = None
    for day in ["friday", "shukrawar", "somwar", "monday", "tuesday", "wednesday", "thursday", "saturday", "sunday", "kal", "parso", "next week"]:
        if day in text:
            due_date_hint = day
            break

    # Description
    desc = "saaman"
    for item in ["ration", "saaman", "doodh", "chawal", "atta", "daal", "tel", "biscuit", "सामान"]:
        if item in text:
            desc = item
            break

    return {
        "intent": "log_entry",
        "entries": [
            {
                "action": action,
                "customer_name": name,
                "amount": amount if amount > 0 else 100.0,
                "due_date_hint": due_date_hint,
                "description": desc
            }
        ]
    }

async def _parse_with_gemini(transcript: str, language_hint: str) -> Dict[str, Any]:
    """Calls Google Gemini model with structured JSON response."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    system_instruction = (
        "You are an NLU engine for BolKhata, an Indian Kirana shopkeeper credit ledger app.\n"
        "Your task is to parse shopkeeper speech into structured intents and entities.\n"
        "CRITICAL RULE: The LLM NEVER does arithmetic on money. Extract only numbers and entities mentioned.\n"
        "Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "intent": "log_entry" | "query" | "unknown",\n'
        '  "entries": [\n'
        "    {\n"
        '      "action": "credit" | "payment",\n'
        '      "customer_name": "string",\n'
        '      "amount": number,\n'
        '      "due_date_hint": "string or null",\n'
        '      "description": "string or null"\n'
        "    }\n"
        "  ],\n"
        '  "query": {\n'
        '    "query_type": "customer_balance" | "overdue_list" | "due_today" | "total_summary",\n'
        '    "customer_name": "string or null"\n'
        "  }\n"
        "}"
    )

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        temperature=0.1,
    )

    prompt = f"Language: {language_hint}\nTranscript: {transcript}"
    # Use specified model or default to gemini-2.5-flash
    model_name = settings.llm_model if "gemini" in settings.llm_model else "gemini-2.5-flash"

    # Async execute via client.aio
    response = await client.aio.models.generate_content(
        model=model_name,
        contents=prompt,
        config=config
    )

    result_text = response.text.strip()
    return json.loads(result_text)

async def _parse_with_anthropic(transcript: str, language_hint: str) -> Dict[str, Any]:
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    
    nlu_tools = [
        {
            "name": "parse_shopkeeper_speech",
            "description": "Parse shopkeeper voice utterances into structured ledger actions or queries. Do NOT perform arithmetic.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "intent": {"type": "string", "enum": ["log_entry", "query", "unknown"]},
                    "entries": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "action": {"type": "string", "enum": ["credit", "payment"]},
                                "customer_name": {"type": "string"},
                                "amount": {"type": "number"},
                                "due_date_hint": {"type": "string"},
                                "description": {"type": "string"}
                            },
                            "required": ["action", "customer_name", "amount"]
                        }
                    },
                    "query": {
                        "type": "object",
                        "properties": {
                            "query_type": {"type": "string", "enum": ["customer_balance", "overdue_list", "due_today", "total_summary"]},
                            "customer_name": {"type": "string"}
                        },
                        "required": ["query_type"]
                    }
                },
                "required": ["intent"]
            }
        }
    ]

    response = await client.messages.create(
        model=settings.llm_model,
        max_tokens=1000,
        system="Parse shopkeeper speech into structured intents and entities. Never do arithmetic.",
        messages=[{"role": "user", "content": f"Language: {language_hint}\nTranscript: {transcript}"}],
        tools=nlu_tools,
        tool_choice={"type": "tool", "name": "parse_shopkeeper_speech"}
    )

    for content in response.content:
        if content.type == "tool_use" and content.name == "parse_shopkeeper_speech":
            return content.input

    return fallback_parse_utterance(transcript)

async def parse_utterance(transcript: str, language_hint: str = "hi-IN") -> Dict[str, Any]:
    # 1. Try Gemini if key is provided
    if settings.gemini_api_key:
        try:
            return await _parse_with_gemini(transcript, language_hint)
        except Exception as e:
            logger.warning(f"Gemini API error: {e}, falling back to rule-based parser")
            return fallback_parse_utterance(transcript)

    # 2. Try Anthropic if key is provided
    if settings.anthropic_api_key:
        try:
            return await _parse_with_anthropic(transcript, language_hint)
        except Exception as e:
            logger.warning(f"Anthropic API error: {e}, falling back to rule-based parser")
            return fallback_parse_utterance(transcript)

    # 3. Fallback
    return fallback_parse_utterance(transcript)

async def draft_reminder_text(
    customer_name: str,
    shop_name: str,
    amount: float,
    days_overdue: int,
    language: str = "hi-IN"
) -> str:
    """Drafts a polite, culturally respectful reminder under 280 characters in native script."""
    amt_int = int(amount) if amount.is_integer() else amount

    prompt = (
        f"Write a warm, polite, culturally respectful payment reminder for a kirana shop.\n"
        f"Shop Name: {shop_name}\n"
        f"Customer Name: {customer_name}\n"
        f"Amount Due: ₹{amt_int}\n"
        f"Days Overdue: {days_overdue}\n"
        f"Target Language: {language}\n"
        f"Strict constraints:\n"
        f"1. Length MUST be under 250 characters.\n"
        f"2. Write in the native script of the language (e.g. Devanagari for Hindi/Marathi, Gujarati script for Gujarati).\n"
        f"3. Do not include quotes or metadata, output ONLY the plain text reminder message."
    )

    # 1. Try Gemini
    if settings.gemini_api_key:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=settings.gemini_api_key)
            model_name = settings.llm_model if "gemini" in settings.llm_model else "gemini-2.5-flash"
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=200,
                    temperature=0.3
                )
            )
            text = response.text.strip()
            if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
                text = text[1:-1].strip()
            return text
        except Exception as e:
            logger.warning(f"Gemini draft reminder error: {e}")

    # 2. Try Anthropic
    if settings.anthropic_api_key:
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            res = await client.messages.create(
                model=settings.llm_model,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}]
            )
            text = res.content[0].text.strip()
            if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
                text = text[1:-1].strip()
            return text
        except Exception as e:
            logger.warning(f"Anthropic draft reminder error: {e}")

    # 3. Fallback localized template
    if "mr" in language:
        return f"नमस्ते {customer_name}, {shop_name} कडून आपले ₹{amt_int} चे देणे बाकी आहे. कृपया लवकरात लवकर भरणा करावा. धन्यवाद!"
    elif "gu" in language:
        return f"નમસ્તે {customer_name}, {shop_name} તરફથી આપનું ₹{amt_int} બાકી છે. કૃપા કરીને અનુકૂળતા મુજબ ચૂકવણી કરી આપશો. આભાર!"
    elif "en" in language:
        return f"Hello {customer_name}, this is a gentle reminder from {shop_name} regarding your pending balance of ₹{amt_int}. Please clear it at your earliest convenience. Thank you!"
    else:
        return f"नमस्ते {customer_name}, {shop_name} से आपका ₹{amt_int} का उधार बाकी है। कृपया समय निकाल कर भुगतान कर दें। धन्यवाद!"

def format_query_answer(query_type: str, data: Dict[str, Any], language: str = "hi-IN") -> str:
    """Formats answer text for queries."""
    if query_type == "customer_balance":
        name = data.get("customer_name", "ग्राहक")
        balance = data.get("balance", 0.0)
        amt = int(balance) if balance.is_integer() else balance
        if balance > 0:
            return f"{name} का कुल ₹{amt} बाकी है।"
        elif balance < 0:
            return f"{name} का ₹{abs(amt)} जमा (एडवांस) है।"
        else:
            return f"{name} का पूरा हिसाब चुकता है, कोई बाकी नहीं है।"

    elif query_type == "overdue_list":
        count = data.get("overdue_count", 0)
        names = data.get("overdue_names", [])
        if count == 0:
            return "किसी भी ग्राहक का उधार ओवरड्यू नहीं है। सब ठीक है!"
        names_str = ", ".join(names[:3])
        return f"कुल {count} ग्राहकों का पैसा ओवरड्यू है, जिनमें {names_str} शामिल हैं।"

    elif query_type == "due_today":
        count = data.get("due_today_count", 0)
        names = data.get("due_today_names", [])
        if count == 0:
            return "आज किसी भी ग्राहक का वादा देय नहीं है।"
        names_str = ", ".join(names[:3])
        return f"आज {count} ग्राहकों का भुगतान आने का वादा है: {names_str}।"

    elif query_type == "total_summary":
        total = data.get("total_udhaar", 0.0)
        collected = data.get("collected_today", 0.0)
        return f"दुकान का कुल उधार ₹{int(total)} है, और आज ₹{int(collected)} जमा हुआ है।"

    return "माफ कीजिए, आपका सवाल समझ नहीं आया।"
