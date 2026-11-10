# 🎬 BolKhata: 2-3 Minute Video Demo Script & Walkthrough

This guide provides a **second-by-second script**, **exact spoken words**, and **on-screen actions** to record a winning 2-3 minute demo video for BolKhata.

---

## 🛠️ Step 0: Pre-Recording Setup (Takes 60 seconds)

1. **Seed the database** with clean demo kirana data:
   ```bash
   cd backend
   python scripts/seed.py
   ```
2. **Start the unified server**:
   ```bash
   uvicorn app.main:app --port 8000
   ```
3. **Open browser**:
   - Go to `http://localhost:8000` in Google Chrome.
   - Press `F12` (DevTools) ➔ Toggle **Device Toolbar** (`Ctrl+Shift+M`) ➔ Select **iPhone 14 Pro** or **Pixel 7** (approx. 390 × 844 px) to showcase the native mobile Kirana experience.
   - *Alternative*: If presenting from a real smartphone, run `cloudflared tunnel --url http://localhost:8000` and open the HTTPS URL on your phone!

---

## ⏱️ Video Timeline & Script (Total: 2 min 45 sec)

### [0:00 - 0:25] The Hook & Problem (Dashboard Walkthrough)
* **What to Show on Screen**: The BolKhata dashboard with top cards (Total Outstanding ₹4,520, Collected Today ₹150, Overdue Customers 4), header with Hindi/EN switch and "आवाज़ क्लोन चालू" badge.
* **What to Say**:
  > *"Over 13 million Kirana store owners in India track customer credit on paper notebooks. When the shop gets crowded, writing down small credits is slow, notebook calculations have errors, and asking for money is socially awkward.*
  > 
  > *This is **BolKhata**—an ambient, voice-first ledger powered by Gnani Vachana AI and Google Gemini. The shopkeeper never types; they only talk."*

---

### [0:25 - 1:00] Loop A — Speak to Log (Zero Typing)
* **What to Do on Screen**:
  1. Tap the big orange **"बोलकर लिखें या पूछें" (Mic)** button at the bottom.
  2. Speak aloud into your mic (or tap the demo chip):
     **"शर्मा जी ने 450 का सामान लिया, शुक्रवार तक देगा"**
     *(English translation: "Sharma ji took goods worth 450, will pay by Friday")*
  3. Show the real-time transcription on screen.
  4. Point your cursor to the **Confirm Card** that instantly pops up:
     - Customer: **Sharma Ji**
     - Amount: **₹450**
     - Type: **उधार (+ Credit)**
     - Promise Date: **2026-11-13 (शुक्रवार)**
  5. Tap the **"बोलकर सुनाएं" (Read Back)** button to play the TTS read-back.
  6. Tap **"स्वीकार करें (Confirm & Save)"**.
* **What to Say**:
  > *"Let's record a credit entry. I tap the mic and simply say: 'Sharma ji ne 450 ka saaman liya, Friday tak dega'.*
  > 
  > *Gnani Prisma v3.0 STT transcribes this with domain-specific keyterm boosting. Google Gemini extracts the customer name, amount, items, and computes the upcoming Friday promise date.*
  > 
  > *Notice that adhering to Rule 6, nothing is saved to the ledger without human confirmation. I verify the Confirm Card, click confirm, and Sharma ji's balance is instantly updated in SQLite."*

---

### [1:00 - 1:20] P1 Feature — Instant Undo
* **What to Do on Screen**:
  1. Immediately tap the **Undo (↺)** button in the top navigation bar.
  2. Notice the green toast appear: *"Sharma ji की ₹450 की प्रविष्टि रद्द की गई"*.
  3. Show Sharma ji's balance instantly reverting back to ₹200.
* **What to Say**:
  > *"Made a mistake or customer paid cash on the spot? One tap on the Undo button immediately cancels the last entry and recalculates all ledger balances deterministically."*

---

### [1:20 - 1:55] Loop B — Ask by Voice (Voice Queries)
* **What to Do on Screen**:
  1. Tap the big orange Mic button again.
  2. Speak (or tap chip): **"वर्मा जी का कितना बाकी है?"**
     *(Or ask: "किसका पैसा पेंडिंग है?")*
  3. Show the **Query Answer Card** appear:
     *"वर्मा जी का कुल ₹1,550 बाकी है।"*
  4. The audio answer plays aloud automatically through Gnani Timbre TTS.
  5. Close the modal.
* **What to Say**:
  > *"Loop B is Ask by Voice. A shopkeeper doesn't need to scroll or search. They just ask: 'Verma ji ka kitna baaki hai?'.*
  > 
  > *Our backend calculates the exact balance in pure Python—the LLM is never allowed to do math—and Gnani Timbre TTS speaks the answer aloud in natural Hindi."*

---

### [1:55 - 2:35] Loop C — Remind in My Cloned Voice (WhatsApp Recovery)
* **What to Do on Screen**:
  1. Click on customer **"Verma ji"** (shows ₹1,550 Overdue) or tap the bell icon.
  2. Customer detail screen opens, showing transaction timeline.
  3. Tap **"रिमाइंडर भेजें (Send Reminder)"**.
  4. The **Reminder Studio** opens:
     - Show the auto-drafted polite reminder in Hindi script:
       *"नमस्ते वर्मा जी, गुप्ता किराना स्टोर से आपका ₹1550 का उधार बाकी है। कृपया समय निकाल कर भुगतान कर दें। धन्यवाद!"*
     - Show the language selector tabs (मराठी, ગુજરાતી, English) to show multi-lingual Kirana support.
     - Select **"मेरी क्लोन आवाज़ (My Cloned Voice)"**.
     - Press **Play (▶)** to listen to the synthesized audio note in the shopkeeper's own cloned voice (via Gnani VC-v1).
     - Tap **"WhatsApp पर भेजें"** (shows WhatsApp opening with pre-filled message + audio URL).
* **What to Say**:
  > *"Now for the most powerful loop: Loop C — Remind in my cloned voice.*
  > 
  > *Verma ji has an overdue balance of ₹1,550. Instead of an awkward phone call or a cold robotic SMS, BolKhata drafts a warm, culturally respectful reminder in the customer's language.*
  > 
  > *Using a 10-second reference sample enrolled via Gnani Vachana VC-v1, the app speaks the reminder in the **shopkeeper's own cloned voice**! When customers receive a warm voice note from the shopkeeper on WhatsApp, recovery rates skyrocket while keeping community trust intact."*

---

### [2:35 - 3:00] Architecture & Wrap-Up
* **What to Show on Screen**: Switch language toggle to **EN** (showing full dual-language UI), and click shop name to briefly show the Shop Settings modal.
* **What to Say**:
  > *"To summarize: BolKhata combines **Gnani Vachana AI** for speech recognition, text-to-speech, and zero-shot voice cloning, **Google Gemini** for high-speed entity extraction, and a deterministic Python ledger core.*
  > 
  > *It runs as a mobile-first PWA served from a single FastAPI process, making it fast, reliable, and ready for millions of Indian Kiranas. Thank you!"*

---

## 💡 Pro-Tips for Recording

1. **Noisy room or microphone trouble?**
   Inside the Voice Modal, there are 4 **1-click quick demo chips** (`🗣️ शर्मा जी...`, `🔍 वर्मा जी...`, `💵 रमेश...`, `⚠️ किसका पैसा...`). You can simply tap them during the demo—they trigger the exact same end-to-end NLU, Confirm Card, and TTS speech flows without recording jitter!
2. **Audio Output**: Make sure your screen recorder (e.g. OBS, Loom, QuickTime) captures **system audio** so the judges hear the Gnani TTS and cloned voice playback clearly!

