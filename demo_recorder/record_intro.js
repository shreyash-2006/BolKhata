const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = path.resolve(__dirname, '..');
const VIDEO_DIR = path.resolve(__dirname, 'intro_video_output');
const HTML_FILE = path.join(ROOT_DIR, 'intro_animation.html');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('--- STEP 1: Preparing Intro Recording (23 Seconds) ---');
  if (fs.existsSync(VIDEO_DIR)) {
    fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  console.log('--- STEP 2: Launching Chrome for 420x900 Mobile Recording ---');
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
  const fileUrl = 'file:///' + HTML_FILE.replace(/\\/g, '/');

  console.log(`Loading animation: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'load' });

  console.log('Recording 23.5 seconds of synchronized illustrative animation...');
  await sleep(23500);

  console.log('Closing browser to finalize WebM video stream...');
  await page.close();
  await context.close();
  await browser.close();

  // Copy output
  const files = fs.readdirSync(VIDEO_DIR);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    const src = path.join(VIDEO_DIR, videoFile);
    const dest = path.join(ROOT_DIR, 'BolKhata_Intro_23s.webm');
    fs.copyFileSync(src, dest);
    console.log(`\n🎉 SUCCESS! 23s Animated Intro Video saved to:\n${dest}`);
  } else {
    console.error('Video file was not found in ' + VIDEO_DIR);
  }
}

run().catch(err => {
  console.error('Error during intro recording:', err);
  process.exit(1);
});

