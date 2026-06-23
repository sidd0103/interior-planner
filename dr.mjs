import puppeteer from "puppeteer-core";
const CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser=await puppeteer.launch({executablePath:CHROME,headless:false,args:["--no-sandbox","--window-size=1300,820"]});
const page=(await browser.pages())[0]; await page.setViewport({width:1300,height:820});
const email=`dr_${Date.now()}@example.com`;
await page.goto("http://localhost:3000/signup",{waitUntil:"networkidle2"});
await page.type('input[type=email]', email); await page.type('input[type=password]', "password123");
await page.click('button[type=submit]'); await new Promise(r=>setTimeout(r,2500));
await page.evaluate(()=>{[...document.querySelectorAll('main input')][0].focus();}); await page.keyboard.type("Apt");
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/create|add/i.test(b.textContent))?.click());
await new Promise(r=>setTimeout(r,1300));
await page.evaluate(()=>[...document.querySelectorAll('a')].find(x=>/Apt/.test(x.textContent))?.click());
await new Promise(r=>setTimeout(r,1400));
const projUrl=page.url();
// create 2 rooms
for(const n of ["Bedroom","Kitchen"]){
  await page.evaluate(()=>{const i=[...document.querySelectorAll('input')][0];i&&i.focus();}); await page.keyboard.type(n);
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/add room/i.test(b.textContent))?.click());
  await new Promise(r=>setTimeout(r,1100));
}
console.log("rooms before delete:", await page.evaluate(()=>[...document.querySelectorAll('.card a')].map(a=>a.textContent.trim().split('\n')[0]).filter(t=>/Bedroom|Kitchen/.test(t))));
// delete Kitchen via the trash icon on its row
page.on("dialog", d=>d.accept());
await page.evaluate(()=>{ const rows=[...document.querySelectorAll('.card.row')]; const k=rows.find(r=>/Kitchen/.test(r.innerText)); k?.querySelector('.icon-btn')?.click(); });
await new Promise(r=>setTimeout(r,1500));
console.log("rooms after delete Kitchen:", await page.evaluate(()=>[...document.querySelectorAll('.card a')].map(a=>a.textContent.trim().split('\n')[0]).filter(t=>/Bedroom|Kitchen/.test(t))));
// open Bedroom, import splat, then Clear scene
await page.evaluate(()=>[...document.querySelectorAll('a')].find(x=>/Bedroom/.test(x.textContent))?.click());
await new Promise(r=>setTimeout(r,3500));
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==="Import splat")?.click());
await new Promise(r=>setTimeout(r,400));
await (await page.$('input[type=file]')).uploadFile("public/demo/living-room.spz");
await new Promise(r=>setTimeout(r,400));
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==="Import")?.click());
await new Promise(r=>setTimeout(r,9000));
console.log("after import, 'Scene loaded' shown:", await page.evaluate(()=>document.body.innerText.includes("Scene loaded")));
// Clear scene
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/Clear scene/.test(b.textContent))?.click());
await new Promise(r=>setTimeout(r,2500));
console.log("after Clear scene -> 'Scene loaded' gone:", await page.evaluate(()=>!document.body.innerText.includes("Scene loaded")));
console.log("after Clear scene -> Import tab back:", await page.evaluate(()=>document.body.innerText.includes("Import splat")));
await browser.close();
