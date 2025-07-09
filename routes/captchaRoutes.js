import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';

const router = express.Router();

const pluginStealth = StealthPlugin();
pluginStealth.enabledEvasions.delete('chrome.app'); 

puppeteer.use(StealthPlugin());

// Config
const PAGE_URL = 'https://imigresen-online.imi.gov.my/mdac/register?viewRegistration';
const CAPTCHA_API_KEY = 'c0e6a672bc4d4a535a3dec1f0d5d07c3';
const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 180000;

// 2Captcha Helpers
async function request2CaptchaTask({ sitekey, url }) {
  const params = new URLSearchParams({
    key: CAPTCHA_API_KEY,
    method: 'userrecaptcha',
    googlekey: sitekey,
    pageurl: url,
    json: 1,
  });

  const { data } = await axios.get(`https://2captcha.com/in.php?${params}`);
  if (data.status !== 1) throw new Error(`2Captcha error: ${data.request}`);
  return data.request;
}

async function poll2CaptchaResult(id) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    const params = new URLSearchParams({
      key: CAPTCHA_API_KEY,
      action: 'get',
      id,
      json: 1,
    });
    const { data } = await axios.get(`https://2captcha.com/res.php?${params}`);
    if (data.status === 1) return data.request;
    if (data.request !== 'CAPCHA_NOT_READY') throw new Error(`2Captcha error: ${data.request}`);
    console.log('⏳ 2Captcha still solving...');
  }
  throw new Error('❌ 2Captcha timeout exceeded');
}

async function solveCaptcha({ sitekey, url }) {
  console.log('📨 Sending captcha to 2Captcha …');
  const taskId = await request2CaptchaTask({ sitekey, url });
  console.log(`🆔 Task ID: ${taskId}`);
  const token = await poll2CaptchaResult(taskId);
  console.log('✅ Captcha solved by 2Captcha');
  return token;
}

// Route Handler
router.post('/submit-form', async (req, res) => {
  const { passportNumber, nationality, pinKey } = req.body;

  if (!passportNumber || !nationality || !pinKey) {
    return res.status(400).json({ error: 'Missing input fields' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page = await browser.newPage();
    await page.goto(PAGE_URL, { waitUntil: 'networkidle2' });

    // Fill form
    await page.type('#passNo', passportNumber);
    await page.select('#nationality', nationality);
    await page.type('#pinKeyId', pinKey);
    console.log('📝 Form fields filled.');

    // Get sitekey
    const sitekey = await page.$eval('.g-recaptcha', el => el.getAttribute('data-sitekey'));
    console.log(`🔑 sitekey: ${sitekey}`);

    // Solve captcha
    const captchaToken = await solveCaptcha({ sitekey, url: PAGE_URL });

    // Inject token
    await page.evaluate(token => {
      let textarea = document.getElementById('g-recaptcha-response');
      if (!textarea) {
        textarea = document.createElement('textarea');
        textarea.id = 'g-recaptcha-response';
        textarea.name = 'g-recaptcha-response';
        textarea.style.display = 'none';
        document.body.appendChild(textarea);
      }
      textarea.value = token;
    }, captchaToken);
    console.log('📨 Token injected.');

    // Submit form
    await Promise.all([
      page.click('input[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    ]);
    console.log('🚀 Form submitted.');

    const screenshotPath = 'form_submission_result.png';
    await page.screenshot({ path: screenshotPath });
    console.log('📸 Screenshot saved.');

    res.status(200).json({
      message: 'Form submitted successfully',
      screenshot: screenshotPath,
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

export default router;
