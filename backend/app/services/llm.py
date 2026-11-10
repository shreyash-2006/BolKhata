import json
import logging
import re
from typing import Any, Dict, List, Optional
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)

# Tools definition for structured parsing
NLU_TOOLS = [
    {
        "name": "parse_shopkeeper_speech",
        "description": "Parse shopkeeper voice utterances into structured ledger actions or queries. Do NOT perform arithmetic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "intent": {
                    "type": "string",
                    "enum": ["log_entry", "query", "unknown"],
                    "description": "Whether the speaker is logging credit/payment or asking a query."
                },
                "entries": {
                    "type": "array",
                    "description": "List of ledger entries mentioned (up to 5).",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["credit", "payment"],
                                "description": "credit if shop gave goods on udhaar, payment if customer paid money/jama."
                            },
                            "customer_name": {
                                "type": "string",
                                "description": "Name of the customer (e.g. Sharma ji, Verma ji, Ramesh)."
                            },
                            "amount": {
                                "type": "number",
                                "description": "The exact monetary amount mentioned in the speech in rupees."
                            },
                            "due_date_hint": {
                                "type": "string",
                                "description": "Any mentioned promise date or day (e.g. Friday, kal, parso, 10 din baad)."
                            },
                            "description": {
                                "type": "string",
                                "description": "Items or reason mentioned (e.g. saaman, ration, doodh)."
                            }
                        },
                        "required": ["action", "customer_name", "amount"]
                    }
                },
                "query": {
                    "type": "object",
                    "properties": {
                        "query_type": {
                            "type": "string",
                            "enum": ["customer_balance", "overdue_list", "due_today", "total_summary"],
                            "description": "The kind of query being asked."
                        },
                        "customer_name": {
                            "type": "string",
                            "description": "The customer name if asking for specific balance."
                        }
                    },
                    "required": ["query_type"]
                }
            },
            "required": ["intent"]
        }
    }
]

def fallback_parse_utterance(transcript: str) -> Dict[str, Any]:
    """Robust rule-based parser when Anthropic key is not present or in fallback mode."""
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

    if any(q in text for q in ["kiska paisa pending", "kiska udhaar", "overdue", "pending list", "kispe baaki"]):
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
    # Try ₹ symbol or numbers
    amt_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', text)
    if amt_match:
        try:
            amount = float(amt_match.group(1))
        except Exception:
            amount = 0.0

    # Extract customer name
    # e.g. "sharma ji ne 450 ka saaman..." -> "Sharma Ji"
    name = "Grahak"
    name_match = re.search(r'^([a-zA-Z\u0900-\u097F\s]+?)\s*(?:ne|ko|se|ने|को|से|\d)', text)
    if name_match:
        name = name_match.group(1).strip().title()
    else:
        # fallback words
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

async def parse_utterance(transcript: str, language_hint: str = "hi-IN") -> Dict[str, Any]:
    if not settings.anthropic_api_key:
        return fallback_parse_utterance(transcript)

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    system_prompt = (
        "You are an NLU engine for BolKhata, an Indian Kirana shopkeeper credit ledger app.\n"
        "Your task is to parse shopkeeper speech into structured intents and entities.\n"
        "CRITICAL RULE: The LLM NEVER does arithmetic on money. Extract only numbers mentioned.\n"
        "Always call the 'parse_shopkeeper_speech' tool."
    )

    try:
        response = await client.messages.create(
            model=settings.llm_model,
            max_tokens=1000,
            system=system_prompt,
            messages=[{"role": "user", "content": f"Language: {language_hint}\nTranscript: {transcript}"}],
            tools=NLU_TOOLS,
            tool_choice={"type": "tool", "name": "parse_shopkeeper_speech"}
        )

        for content in response.content:
            if content.type == "tool_use" and content.name == "parse_shopkeeper_speech":
                return content.input

        return fallback_parse_utterance(transcript)
    except Exception as e:
        logger.warning(f"Anthropic API error: {e}, falling back to rule-based parser")
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
    
    if not settings.anthropic_api_key:
        if "mr" in language:
            return f"नमस्ते {customer_name}, {shop_name} कडून आपले ₹{amt_int} चे देणे बाकी आहे. कृपया लवकरात लवकर भरणा करावा. धन्यवाद!"
        elif "gu" in language:
            return f"નમસ્તે {customer_name}, {shop_name} તરફથી આપનું ₹{amt_int} બાકી છે. કૃપા કરીને અનુકૂળતા મુજબ ચૂકવણી કરી આપશો. આભાર!"
        elif "en" in language:
            return f"Hello {customer_name}, this is a gentle reminder from {shop_name} regarding your pending balance of ₹{amt_int}. Please clear it at your earliest convenience. Thank you!"
        else:
            # Default Hindi in Devanagari
            return f"नमस्ते {customer_name}, {shop_name} से आपका ₹{amt_int} का उधार बाकी है। कृपया समय निकाल कर भुगतान कर दें। धन्यवाद!"

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = (
        f"Write a warm, polite, culturally respectful payment reminder for a kirana shop.\n"
        f"Shop Name: {shop_name}\n"
        f"Customer Name: {customer_name}\n"
        f"Amount Due: ₹{amt_int}\n"
        f"Days Overdue: {days_overdue}\n"
        f"Target Language: {language}\n"
        f"Strict constraints:\n"
        f"1. Length MUST be under 250 characters.\n"
        f"2. Write in the native script of the language (e.g. Devanagari for Hindi/Marathi).\n"
        f"3. Do not include quotes or metadata, output ONLY the text."
    )

    try:
        res = await client.messages.create(
            model=settings.llm_model,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        text = res.content[0].text.strip()
        # strip any wrapping quotes
        if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
            text = text[1:-1].strip()
        return text
    except Exception as e:
        logger.warning(f"Anthropic error in draft_reminder_text: {e}")
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
