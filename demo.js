// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const axios = require('axios');

// puppeteer.use(StealthPlugin());

// const CAPSOLVER_API_KEY = 'c0e6a672bc4d4a535a3dec1f0d5d07c3';

// // Recaptcha V2 Normal

// const PAGE_URL = 'https://imigresen-online.imi.gov.my/mdac/register?viewRegistration';

// async function solveCaptchaWithCapSolver(sitekey, url) {
//     const taskData = {
//         clientKey: CAPSOLVER_API_KEY,
//         task: {
//             type: 'RecaptchaV2TaskProxyless',
//             websiteURL: url,
//             websiteKey: sitekey
//         }
//     };

//     const { data: taskResponse } = await axios.post('https://api.capsolver.com/createTask', taskData);
//     const taskId = taskResponse.taskId;

//     console.log('🧠 Waiting for CapSolver to solve captcha...');

//     for (let i = 0; i < 30; i++) {
//         await new Promise(res => setTimeout(res, 5000));
//         const { data: resultResponse } = await axios.post('https://api.capsolver.com/getTaskResult', {
//             clientKey: CAPSOLVER_API_KEY,
//             taskId
//         });

//         if (resultResponse.status === 'ready') {
//             console.log('✅ Captcha Solved');
//             return resultResponse.solution.gRecaptchaResponse;
//         } else {
//             console.log('⏳ Still waiting...');
//         }
//     }

//     throw new Error('❌ Captcha not solved in time');
// }

// (async () => {
//     const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
//     const page = await browser.newPage();
//     await page.goto(PAGE_URL, { waitUntil: 'networkidle2' });

//     // Fill in the form
//     await page.type('#passNo', 'A1234567');
//     await page.select('#nationality', 'IND');
//     await page.type('#pinKeyId', '123456');
//     console.log('📝 Form fields filled.');

//     // Get the reCAPTCHA site key
//     const sitekey = await page.$eval('.g-recaptcha', el => el.getAttribute('data-sitekey'));

//     // Solve the reCAPTCHA using CapSolver
//     const token = await solveCaptchaWithCapSolver(sitekey, PAGE_URL);

//     // Inject token into the page
//     await page.evaluate((captchaToken) => {
//         let textarea = document.getElementById('g-recaptcha-response');
//         if (!textarea) {
//             textarea = document.createElement('textarea');
//             textarea.id = 'g-recaptcha-response';
//             textarea.name = 'g-recaptcha-response';
//             document.body.appendChild(textarea);
//         }
//         textarea.style.display = 'block';
//         textarea.value = captchaToken;

//         const event = new Event('change', { bubbles: true });
//         textarea.dispatchEvent(event);
//     }, token);

//     console.log('📨 Injected CAPTCHA token.');

//     // Click the submit button
//     await page.click('button[type="submit"]');
//     console.log('🚀 Form submitted.');

//     // Wait for navigation or confirmation
//     try {
//         await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
//         console.log('✅ Navigated after submit.');
//     } catch (e) {
//         console.log('⚠️ No navigation occurred, but form may still be submitted.');
//     }

//     await page.screenshot({ path: 'form_submission_result.png' });
//     console.log('📸 Screenshot saved: form_submission_result.png');

//     // await browser.close();
// })();



import dotenv from 'dotenv';
dotenv.config();
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';


puppeteer.use(StealthPlugin());

 
const PAGE_URL = 'https://imigresen-online.imi.gov.my/mdac/register?viewRegistration';
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY;
const POLL_INTERVAL = 5000;   
const POLL_TIMEOUT  = 180000;

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
  return data.request; // taskId
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
    if (data.status === 1) return data.request;          // token ready
    if (data.request !== 'CAPCHA_NOT_READY')             // any other error
      throw new Error(`2Captcha error: ${data.request}`);
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

(async () => {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2' });

  // 1️⃣  Fill form (adjust selectors if the site changes)
  await page.type('#passNo', 'YUJHY6869');
  await page.select('#nationality', 'AUT');
  await page.type('#pinKeyId', 'yhyTzU8F');
  console.log('📝 Form fields filled.');

  // 2️⃣  Grab reCAPTCHA site‑key from the page
  const sitekey = await page.$eval('.g-recaptcha', el => el.getAttribute('data-sitekey'));
  console.log(`🔑 sitekey: ${sitekey}`);

  // 3️⃣  Solve with 2Captcha
  const captchaToken = await solveCaptcha({ sitekey, url: PAGE_URL });

  console.log('token', captchaToken);

  // 4️⃣  Inject token into DOM
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

  // 5️⃣  Submit the form
  await Promise.all([
    page.click('input[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
  ]);
  console.log('🚀 Form submitted.');

  // 6️⃣ Optional proof
  await page.screenshot({ path: 'form_submission_result.png' });
  console.log('📸 Screenshot saved as form_submission_result.png');

  // await browser.close();
})();
