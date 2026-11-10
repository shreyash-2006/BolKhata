# BolKhata (बोलखाता) — Voice-First Udhaar Ledger
### *Kirana Credit on Autopilot: Speak to Log, Ask by Voice, Remind in Your Own Voice*

---

### The Problem
Over **13 million neighbourhood Kirana stores** power 90% of India’s grocery retail. More than 60% of their business runs on informal credit (*udhaar*), recorded on scraps of paper or dusty notebooks:
1. **Forgotten Money & Math Errors**: Busy shopkeepers forget to write down small transactions while managing crowds; manual notebook calculations frequently leak revenue.
2. **Typing Friction**: Small smartphone keyboards, English menus, and greasy or busy hands make conventional accounting apps unusable during peak store hours.
3. **Social Awkwardness**: Asking regular customers or elders for money strains community relationships, leading to delayed payments or bad debts.

---

### The Solution: 3 Voice Loops
**BolKhata** is an ambient, zero-typing, mobile-first progressive web app designed for shopkeepers aged 35–60. It replaces the notebook with natural speech in regional languages (Hindi, Marathi, Gujarati, Hinglish):

* **Loop A — Speak to Log (Zero Typing)**  
  Shopkeeper speaks: *"Sharma ji ne 450 ka saaman liya, Friday tak dega."*  
  **Action**: NLU extracts customer name, amount, items, and relative promise date into a structured **Confirm Card**. One tap confirms the entry. No arithmetic is ever left to the AI—all ledger calculations are deterministic and verified.

* **Loop B — Ask by Voice (Instant Ambient Intel)**  
  Shopkeeper asks: *"Verma ji ka kitna baaki hai?"* or *"Kiska paisa pending hai?"*  
  **Action**: The app computes net balances and overdue schedules in real time, displaying the breakdown and speaking the exact answer aloud in natural Indian speech.

* **Loop C — Remind in My Own Cloned Voice (Gentle Recovery)**  
  For overdue accounts, the app drafts a culturally respectful, polite reminder in the customer's native language. Using a 10-second reference sample of the shopkeeper, it synthesizes the message in the **shopkeeper's own cloned voice** and generates a 1-click **WhatsApp voice note**. Customers pay back faster because the reminder feels personal, warm, and respectful rather than algorithmic.

---

### Tech Stack & Innovation
* **Speech Intelligence (Gnani Vachana AI)**: 
  * **Prisma v3.0 STT** with customer and ledger keyterm boosting for high-accuracy Indian accents and mixed languages.
  * **Timbre v3.0 TTS** for warm, localized spoken read-backs.
  * **Vachana VC-v1 Voice Cloning** for instant shopkeeper voice replication.
* **Conversational Brain (Google Gemini)**: Fast intent and entity extraction with structured JSON schemas and respectful native-script phrasing.
* **Rock-Solid Core**: Deterministic Python ledger arithmetic, SQLModel/SQLite storage, and a single-port FastAPI server powering an offline-ready, responsive React PWA with in-browser 16 kHz WAV encoding.

---

### The 2-Minute Demo Impact
A complete Kirana ledger lifecycle demonstrated in seconds: **Seeded Dashboard ➔ Hindi Voice Log ➔ 1-Tap Confirm ➔ Marathi/Hindi Voice Query ➔ Overdue Customer ➔ Cloned Voice Synthesis ➔ WhatsApp Share.**

