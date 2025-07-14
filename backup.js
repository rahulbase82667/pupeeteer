import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { nationalityOptions, sexOptions, regionOptions, modeofTravelOptions, embarkOptions, accomoDationOptions, stateOptions, JOHOR, KEDAH, KELANTAN, MELAKA, NEGERI_SEMBILAN, PAHANG, PERAK, PULAU_PINANG, PERLIS, SELANGOR, TERENGGANU, SABAH, SARAWAK, WP_KUALA_LUMPUR, WP_LABUAN, WP_PUTRAJAYA } from '../dropdown.js';
import "dotenv/config.js";

puppeteer.use(StealthPlugin());

const PAGE_URL = 'https://imigresen-online.imi.gov.my/mdac/register?viewRegistration';
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY;
const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 180000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOWNLOAD_PATH = path.join(__dirname, 'downloads');

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


function getValueFromOption(mappingArray, label) {
  const found = mappingArray.find(item => item.option.toUpperCase() === label.toUpperCase());
  return found ? found.value : null;
}



export const Registeration = async (req, res) => {
  
  try {

     // const browser = await puppeteer.launch({ headless: false });

   const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ]
    });


    const page = await browser.newPage();

    await page.goto('https://imigresen-online.imi.gov.my/mdac/main?registerMain', {
      waitUntil: 'networkidle2',
    });

    const textInputs = {
      name: req.body.name,
      passNo: req.body.passNo,
      dob: req.body.dob,
      passExpDte: req.body.passExpDte,
      email: req.body.email,
      confirmEmail: req.body.confirmEmail,
      mobile: req.body.mobile,
      arrDt: req.body.arrDt,
      depDt: req.body.depDt,
      vesselNm: req.body.vesselNm,
      accommodationAddress1: req.body.accommodationAddress1,
      accommodationPostcode: req.body.accommodationPostcode,
    };


const cityOptionsMap = {
JOHOR, KEDAH, KELANTAN, MELAKA, NEGERI_SEMBILAN, PAHANG, PERAK, PULAU_PINANG, PERLIS, SELANGOR, TERENGGANU, SABAH, SARAWAK, WP_KUALA_LUMPUR, WP_LABUAN, WP_PUTRAJAYA
};

const cityArray = cityOptionsMap[req.body.accommodationState.toUpperCase()];
if (!cityArray) { return res.status(400).json({ success: false, message: `Invalid state` });}
const cityValue = getValueFromOption(cityArray, req.body.accommodationCity);
if (!cityValue) { return res.status(400).json({ success: false, message: `Invalid city` })}



    const selects = {
      nationality: getValueFromOption(nationalityOptions, req.body.nationality),
      sex: getValueFromOption(sexOptions, req.body.sex),
      region: getValueFromOption(regionOptions, req.body.region), 
      trvlMode: getValueFromOption(modeofTravelOptions, req.body.trvlMode), 
      embark: getValueFromOption(embarkOptions, req.body.embark), 
      accommodationStay: getValueFromOption(accomoDationOptions, req.body.accommodationStay), 
      accommodationState: getValueFromOption(stateOptions, req.body.accommodationState), 
      accommodationCity: cityValue,
    };


    // Fill text inputs and date fields safely
    for (const [id, value] of Object.entries(textInputs)) {
      try {
        await page.waitForSelector(`#${id}`, { visible: true, timeout: 5000 });

        await page.evaluate(({ id, value }) => {
          const el = document.getElementById(id);
          if (el) {
            el.removeAttribute('readonly');
            el.value = '';
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, { id, value });

        console.log(`✅ Set input: ${id}`);
      } catch (err) {
        console.log(`⚠️ Failed input: ${id} → ${err.message}`);
        await browser.close();
        return res.status(500).json({ success: false, message: 'Something went wrong', error: err.message });
      }
    }

    for (const [id, value] of Object.entries(selects)) {
      if (id === 'accommodationCity') continue;

      try {
        await page.waitForSelector(`#${id}`, { visible: true, timeout: 5000 });

        const selected = await page.select(`#${id}`, value);
        if (selected.length === 0) {
          console.log(`⚠️ No match for ${id} → ${value}`);
        } else {
          console.log(`✅ Selected: ${id} → ${value}`);
        }

        if (id === 'accommodationState') {
          await page.waitForFunction(() => {
            const el = document.getElementById('accommodationCity');
            return el && el.options.length > 1;
          }, { timeout: 5000 });
          console.log('✅ accommodationCity options loaded');
        }
      } catch (err) {
        console.log(`⚠️ Failed to select ${id} → ${err.message}`);
        await browser.close();
        return res.status(500).json({ success: false, message: 'Something went wrong', error: err.message });
      }
    }

    // Select city
    try {
      await page.waitForSelector('#accommodationCity', { visible: true, timeout: 5000 });
      const selected = await page.select('#accommodationCity', selects.accommodationCity);
      if (selected.length === 0) {
        console.log(`⚠️ accommodationCity selection failed`);
      } else {
        console.log(`✅ Selected: accommodationCity → ${selects.accommodationCity}`);
      }
    } catch (err) {
      console.log('⚠️ accommodationCity error →', err.message);
      await browser.close();
      return res.status(500).json({ success: false, message: 'Something went wrong', error: err.message });
    }

    await new Promise((r) => setTimeout(r, 1000));

    try {
      await page.click('#submit');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('🎉 Form submitted!');
      return res.status(200).json({ success: true, message: 'Form submitted successfully' });
    } catch (err) {
      console.error('❌ Submit failed:', err.message);
      await browser.close();
      throw new Error('Form submission failed');
    }

  } catch (err) {
    await browser.close();
    return res.status(500).json({ success: false, message: 'Something went wrong', error: err });
  }
};





























export const CheckRegisteration = async (req, res) => {
  const { passportNumber, nationality, pinKey } = req.body;

  if (!passportNumber || !nationality || !pinKey) {
    return res.status(400).json({ error: 'Missing input fields' });
  }

  let browser;
  try {
    if (!fs.existsSync(DOWNLOAD_PATH)) {
      fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
    }



    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ]
    });


    // const browser = await puppeteer.launch({ headless: false });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    // Set download behavior
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_PATH,
    });

    // Navigate to the page and fill form
    await page.goto(PAGE_URL, { waitUntil: 'networkidle2' });
    await page.type('#passNo', passportNumber);
    await page.select('#nationality', nationality);
    await page.type('#pinKeyId', pinKey);

    const sitekey = await page.$eval('.g-recaptcha', el => el.getAttribute('data-sitekey'));
    const captchaToken = await solveCaptcha({ sitekey, url: PAGE_URL });

    // Inject the reCAPTCHA token
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

    await Promise.all([
      page.click('input[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { }),
    ]);

    // Wait for PDF link to appear and trigger download
    await page.waitForSelector('a[onclick^="return printSlip("]', { timeout: 10000 });

    await page.evaluate(() => {
      const link = document.querySelector('a[onclick^="return printSlip("]');
      if (link) link.click();
    });

    // Wait for PDF to appear in the downloads directory
    let downloadedFile = null;
    for (let i = 0; i < 15; i++) {
      const files = fs.readdirSync(DOWNLOAD_PATH).filter(f => f.endsWith('.pdf'));
      if (files.length > 0) {
        downloadedFile = files[0];
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!downloadedFile) {
      throw new Error('PDF file not downloaded.');
    }

    const fullPath = path.join(DOWNLOAD_PATH, downloadedFile);
    const pdfBuffer = fs.readFileSync(fullPath);
    fs.unlinkSync(fullPath); // Optional: Clean up file after use

    // Send as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Registration_slip.pdf"');
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
};