import puppeteer from 'puppeteer-core';
const URL = process.env.URL || 'http://localhost:8765/';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(URL, { waitUntil: 'networkidle2' });
await p.waitForSelector('.card');
await p.screenshot({ path: '/workspace/telugu-song-finder/screenshots/' + (process.env.TAG||'') + 'home.png' });
console.log('home cards', await p.$$eval('.card', x => x.length), await p.$eval('#ai', e => e.innerText));
// quick (keyword) search for the situation
await p.type('#q', "Kalyani is angry with me because I didn't take her to a movie"); await p.keyboard.press('Enter');
await p.waitForSelector('.note');
console.log('QUICK:', await p.$$eval('.card .title', x => x.slice(0, 5).map(e => e.innerText)));
// turn on smart search (mobile: manual opt-in)
await p.click('#ai-on');
await p.waitForFunction(() => document.querySelector('#ai').innerText.includes('Smart search on') || document.querySelector('#ai').innerText.includes("couldn't"), { timeout: 300000 });
console.log(await p.$eval('#ai', e => e.innerText));
await p.waitForFunction(() => document.querySelector('.mode')?.innerText.includes('smart'), { timeout: 60000 });
console.log('SMART:', await p.$$eval('.card', x => x.slice(0, 5).map(e => e.querySelector('.title').innerText + ' — ' + (e.querySelector('.why')?.innerText || ''))));
console.log('NOTE:', await p.$eval('.note', e => e.innerText));
await p.screenshot({ path: '/workspace/telugu-song-finder/screenshots/' + (process.env.TAG||'') + 'search-kalyani.png', fullPage: false });
await p.evaluate(() => window.scrollTo(0, 0));
await p.screenshot({ path: '/workspace/telugu-song-finder/screenshots/' + (process.env.TAG||'') + 'search-kalyani-full.png', fullPage: true, captureBeyondViewport: true });
// play embed
await p.click('.card [data-act=play]'); await p.waitForSelector('.embed iframe');
console.log('embed src', await p.$eval('.embed iframe', e => e.src));
// chip
await p.evaluate(() => { const c = [...document.querySelectorAll('.card')][1]; c.scrollIntoView(); });
await p.screenshot({ path: '/workspace/telugu-song-finder/screenshots/' + (process.env.TAG||'') + 'search-kalyani-results.png' });
await p.goto(URL + '?mood=wedding', { waitUntil: 'networkidle2' }); await p.waitForFunction(() => document.querySelector('#status').innerText.includes('Wedding'));
console.log('WEDDING:', await p.$$eval('.card .title', x => x.slice(0, 5).map(e => e.innerText)));
// Telugu query
await p.click('.chip[data-id=wedding]'); await p.waitForFunction(() => document.querySelector('#ai').innerText.includes('Smart search on'), { timeout: 120000 }); await p.type('#q', 'అమ్మ మీద పాట'); await p.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 2500));
console.log('TE:', await p.$$eval('.card .title', x => x.slice(0, 5).map(e => e.innerText)));
await b.close();
