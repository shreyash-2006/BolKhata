const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = path.resolve(__dirname, '..');
const VIDEO_DIR = path.resolve(__dirname, 'video_output');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) {
      // retry
    }
    await sleep(400);
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

async function run() {
  console.log('--- STEP 1: Seeding demo data ---');
  const pythonExe = path.join(ROOT_DIR, 'backend', '.venv', 'Scripts', 'python.exe');
  const seedScript = path.join(ROOT_DIR, 'backend', 'scripts', 'seed.py');

  const seedProc = spawn(pythonExe, [seedScript], { cwd: ROOT_DIR });
  await new Promise(res => seedProc.on('exit', res));
  console.log('Seed completed.');

  console.log('--- STEP 2: Starting FastAPI server ---');
  const serverProc = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--port', '8000'], {
    cwd: path.join(ROOT_DIR, 'backend'),
    env: { ...process.env, DEMO_FALLBACK: 'true' }
  });

  try {
    await waitForServer('http://127.0.0.1:8000/');
    console.log('FastAPI server is UP on http://127.0.0.1:8000');

    // Clean video dir
    if (fs.existsSync(VIDEO_DIR)) {
      fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(VIDEO_DIR, { recursive: true });

    console.log('--- STEP 3: Launching Headless Chrome with Video Recording ---');
    const browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const context = await browser.newContext({
      viewport: { width: 420, height: 900 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: {
        dir: VIDEO_DIR,
        size: { width: 420, height: 900 }
      }
    });

    const page = await context.newPage();

    console.log('Navigating to http://127.0.0.1:8000...');
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });
    await sleep(4000);

    // ==========================================
    // SCENE 1: THE HOOK & DASHBOARD (0:00 - 0:22)
    // ==========================================
    console.log('Scene 1: Dashboard overview (0:00 - 0:22)');
    await page.evaluate(() => window.scrollBy({ top: 180, behavior: 'smooth' }));
    await sleep(4000);
    await page.evaluate(() => window.scrollBy({ top: -180, behavior: 'smooth' }));
    await sleep(3500);

    // Overdue filter tab
    const overdueTab = page.locator('button:has-text("ओवरड्यू")').first();
    if (await overdueTab.isVisible()) {
      await overdueTab.click();
      await sleep(3500);
    }
    // All tab
    const allTab = page.locator('button:has-text("सभी")').first();
    if (await allTab.isVisible()) {
      await allTab.click();
      await sleep(3000);
    }

    // ==========================================
    // SCENE 2: LOOP A - SPEAK TO LOG (0:22 - 0:58)
    // ==========================================
    console.log('Scene 2: Loop A (Speak to Log) (0:22 - 0:58)');
    const micBtn = page.locator('button:has-text("बोलकर लिखें या पूछें")');
    await micBtn.click();
    await sleep(3500);

    // Click demo chip: "शर्मा जी ने 450 का सामान लिया, शुक्रवार तक देगा"
    const chipA = page.locator('button:has-text("शर्मा जी ने 450")');
    if (await chipA.isVisible()) {
      await chipA.click();
      console.log('Spoken input parsed into NLU Confirm Card...');
      await sleep(6000);
    }

    // Read back TTS button
    const readBackBtn = page.locator('button:has-text("बोलकर सुनाएं")');
    if (await readBackBtn.isVisible()) {
      await readBackBtn.click();
      await sleep(4000);
    }

    // Tap Confirm & Save
    const confirmBtn = page.locator('button:has-text("स्वीकार करें")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      console.log('Confirmed entry! Saved to SQLite.');
      await sleep(3500);
    }

    // Dismiss modal if still open
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click({ force: true }).catch(() => {});
      await sleep(1500);
    }
    await page.locator('.fixed.inset-0').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await sleep(1500);

    // ==========================================
    // SCENE 3: P1 - INSTANT UNDO (0:58 - 1:18)
    // ==========================================
    console.log('Scene 3: P1 Feature - Instant Undo (0:58 - 1:18)');
    const undoBtn = page.locator('button[title*="Undo"], button[title*="वापस"]');
    if (await undoBtn.isVisible()) {
      await undoBtn.click({ force: true });
      console.log('Clicked Undo button! Green toast active...');
      await sleep(6500);
    }

    // ==========================================
    // SCENE 4: LOOP B - ASK BY VOICE (1:18 - 1:44)
    // ==========================================
    console.log('Scene 4: Loop B (Ask by Voice) (1:18 - 1:44)');
    await micBtn.click();
    await sleep(3000);

    const chipB = page.locator('button:has-text("वर्मा जी का कितना")');
    if (await chipB.isVisible()) {
      await chipB.click();
      console.log('Spoken query answered aloud...');
      await sleep(7000);
    }

    // Close voice modal
    const closeVoice = page.locator('button:has(svg.lucide-x)').first();
    if (await closeVoice.isVisible()) {
      await closeVoice.click({ force: true }).catch(() => {});
      await sleep(1500);
    }
    await page.locator('.fixed.inset-0').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await sleep(1500);

    // ========================================================
    // SCENE 5: LOOP C - REMIND IN CLONED VOICE (1:44 - 2:22)
    // ========================================================
    console.log('Scene 5: Loop C (Remind in Cloned Voice) (1:44 - 2:22)');
    const vermaCard = page.locator('div:has-text("Verma ji")').first();
    if (await vermaCard.isVisible()) {
      await vermaCard.click();
      await sleep(4000);
    }

    // Click "रिमाइंडर भेजें"
    const reminderBtn = page.locator('button:has-text("रिमाइंडर भेजें")').first();
    if (await reminderBtn.isVisible()) {
      await reminderBtn.click();
      console.log('Reminder Studio opened!');
      await sleep(5000);
    }

    // Switch to Marathi language tab
    const mrBtn = page.locator('button:has-text("मराठी")');
    if (await mrBtn.isVisible()) {
      await mrBtn.click();
      await sleep(4000);
    }

    // Switch back to Hindi
    const hiBtn = page.locator('button:has-text("हिन्दी")');
    if (await hiBtn.isVisible()) {
      await hiBtn.click();
      await sleep(3500);
    }

    // Select My Cloned Voice
    const clonedVoiceBtn = page.locator('button:has-text("मेरी क्लोन आवाज़")');
    if (await clonedVoiceBtn.isVisible()) {
      await clonedVoiceBtn.click();
      await sleep(2500);
    }

    // Play Cloned Voice Preview
    const playBtn = page.locator('button:has(svg.lucide-play)');
    if (await playBtn.isVisible()) {
      await playBtn.click();
      console.log('Playing cloned voice synthesis...');
      await sleep(6500);
    }

    // Highlight WhatsApp share button
    const waBtn = page.locator('button:has-text("WhatsApp पर भेजें")');
    if (await waBtn.isVisible()) {
      await waBtn.scrollIntoViewIfNeeded();
      await sleep(4000);
    }

    // Close reminder modal
    const closeRem = page.locator('button:has(svg.lucide-x)').first();
    if (await closeRem.isVisible()) {
      await closeRem.click({ force: true }).catch(() => {});
      await sleep(1500);
    }
    await page.locator('.fixed.inset-0').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await sleep(1500);

    // Go back to dashboard
    const backBtn = page.locator('button:has-text("वापस")');
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await sleep(2500);
    }

    // ========================================================
    // SCENE 6: BILINGUAL ENGLISH & SHOP SETTINGS (2:22 - 2:40)
    // ========================================================
    console.log('Scene 6: Language toggle and Shop Settings (2:22 - 2:40)');
    const langSwitch = page.locator('header button:has-text("EN"), header button:has-text("हिं")').first();
    if (await langSwitch.isVisible()) {
      await langSwitch.click();
      await sleep(3500);
    }

    // Open Shop Settings
    const shopHeader = page.locator('header div[title*="shop settings"]');
    if (await shopHeader.isVisible()) {
      await shopHeader.click();
      await sleep(4000);
      const closeSettings = page.locator('button:has(svg.lucide-x)').first();
      if (await closeSettings.isVisible()) {
        await closeSettings.click({ force: true }).catch(() => {});
        await sleep(2000);
      }
      await page.locator('.fixed.inset-0').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    }

    await sleep(3000);

    console.log('Finishing 2.5-minute video recording...');
    await page.close();
    await context.close();
    await browser.close();

    // Find the recorded video file and copy to root
    const files = fs.readdirSync(VIDEO_DIR);
    const videoFile = files.find(f => f.endsWith('.webm'));
    if (videoFile) {
      const src = path.join(VIDEO_DIR, videoFile);
      const dest = path.join(ROOT_DIR, 'BolKhata_Demo_Video.webm');
      fs.copyFileSync(src, dest);
      console.log(`\n🎉 SUCCESS! Paced demo video saved to:\n${dest}`);
    } else {
      console.log('Video file not found in ' + VIDEO_DIR);
    }

  } finally {
    serverProc.kill();
    console.log('FastAPI server stopped.');
  }
}

run().catch(err => {
  console.error('Recording error:', err);
  process.exit(1);
});
