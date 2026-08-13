import { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updatePassword, updateProfile as fbUpdateProfile,
  deleteUser, EmailAuthProvider, reauthenticateWithCredential, onAuthStateChanged,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  sendEmailVerification, verifyBeforeUpdateEmail
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const API = "https://shoppailu-plus-backend-amber.vercel.app";
const eur = n => n != null ? n.toFixed(2).replace(".",",") + " €" : "—";
const today = () => new Date().toLocaleDateString("fi-FI");
const domOf = u => { try { return new URL(u).hostname.replace(/^www\./,""); } catch { return null; } };

const fbApp = initializeApp({
  apiKey: "AIzaSyC3yhTw0RI3DDTe5YDvWbdg-TNi3Rvm02I",
  authDomain: "shoppailu-plus.firebaseapp.com",
  projectId: "shoppailu-plus",
  storageBucket: "shoppailu-plus.firebasestorage.app",
  messagingSenderId: "786790261655",
  appId: "1:786790261655:web:1ca51e3ba315cebb2e1ad2"
});
const fbAuth = getAuth(fbApp);
const fbDb = getFirestore(fbApp);

/* ── Kategoriarajaus ── */
const OFF_TOPIC = /\b(televisio|plasma|oled|qled|laptop|kannettava tietokone|tabletti|puhelin|smartphone|iphone|ipad|android|samsung galaxy|huawei|xiaomi|sony xperia|kodinkone|pesukone|astianpesukone|jääkaappi|pakastin|uuni|liesi|mikroaaltouuni|ilmastointi|lämpöpumppu|sohva|nojatuoli|patja|sänky|lipasto|kaappi|hylly|pöytä|tuoli|tietokone|prosessori|näytönohjain|kovalevy|muistikortti|näyttö|kaiutin|vasara|pora|saha|ruuviväännin|maalausväline|tapetti|lattia|kaakeli|laatta|ruoka|elintarvike|maito|liha|kala|kasvikset|hedelmä|vilja|kahvi|olut|viini|siideri|lonkero|väkevä alkoholi|tee|teepussi|teelajike|mehu|limonadi|virvoitusjuoma|energiajuoma|kaakao|suklaa|keksi|karkit|sipsit|chips|pähkinät|muesli|mysli|puuro|kaura|pasta|riisi|juusto|jogurtti|muna|polkupyörä|sähköpyörä|skootteri|moottoripyörä|auton varaosat|rengas|moottoriöljy|dvd|bluray|playstation|xbox|nintendo|konsoli|kirja|lemmikki|koira|kissa|hamster|lintu|älykello|smartwatch|fitbit|garmin|polar kello|suunto race|gps.kello|gps kello|urheilukello|ravintolisä|hiusvitamiini|biotin kapseli|matkalaukku|trolley|lentolaukku|passilompakko|avaimenperä|silmälasikehys|silmälasinkehys|reseptilasit|piilolinssi|kuulokkeet|nappikuulokkeet|bluetooth kuulokkeet|koiran ruoka|kissanruoka|lemmikkiruoka|koiranruoka|eläintenruoka|vasikka|nauta|sika|lammas|kana|broileri|kalkkuna|ankka|poro|hirvi|karhu|hauki|lohi|kuha|ahven|tonnikala|sardiini|makrilli|eläin|pet food|dog food|cat food|koiran herkku|kissanhiekka|akvaario|terrarium|lintuhäkki)\b/i;

/* ── Elintarviketulokset — suodatetaan pois hakutuloksista ── */
const FOOD_RESULT = /\b(Earl Grey|english breakfast|rooibos|oolong|matcha tee|herbal tea|teepussi|teelajike|teeseos|inkivääri-sitruuna|kastepisara|energiajuoma|virvoitusjuoma|limonadi|karkit|suklaa|keksi|chips|sipsit|muesli|puuro|kaura|pasta|riisi|kala|lohi|tonnikala|nauta|broileri|juusto|jogurtti|maito|kuiva-aine|elintarvike|koiranruoka|koiran ruoka|kissanruoka|lemmikkiruoka|pet food|dog food|cat food|koiran täysravinto|kissanpurkki|märkäruoka|kuivaruoka koira|kuivaruoka kissa|koiran herkku|kissanherkku|vasikanliha|naudanliha|possunliha|lammasta|kanaa|broileria|kalkkuna|ankka|poro|wild|grain.free|adult dog|adult cat|puppy|kitten|senior dog|senior cat)\b/i;

/* ── Tulosten sisältösuodatin — poistetaan vaikka haku menisi läpi ── */
const PRODUCT_BLOCK = /\b(smartwatch|apple watch|galaxy watch|fitbit|garmin fenix|garmin venu|suunto race|polar grit|polar vantage|ravintolisä|hiusvitamiini|biotin tabletti|omega.3|silmälasinkehys|kehyssilmälasi|piilolinssi|matkalaukku|trolley|matkakassi|passilompakko|avaimenperä)\b/i;

const isOffTopic = q => OFF_TOPIC.test(q);
const isFoodResult = item => FOOD_RESULT.test(item.title || "");
const isBlockedProduct = item => PRODUCT_BLOCK.test(item.title || "");

/* ── AI-suunnittelija: kategoriapohjainen haku ── */
const CAT_ANCHORS={
  hiuksetTags:{
    bases:["shampoo hiusten hoitoaine","hiusnaamio hiusöljy","hiusmuotoilutuote"],
    tagMap:{
      "suorat hiukset":"shampoo suorille hiuksille","loivasti laineikkaat hiukset":"shampoo laineikkaille hiuksille",
      "kiharat hiukset":"shampoo kiharoille hiuksille curl","erittäin kiharat hiukset":"curl shampoo tiukat kiharat",
      "ohuet / hennot hiukset":"shampoo ohuille hiuksille volyymiä","paksut hiukset":"shampoo paksut hiukset",
      "normaali hiuspohja":"shampoo normaali hiuspohja","kuiva hiuspohja":"kosteuttava shampoo kuiva hiuspohja",
      "rasvoittuva hiuspohja":"shampoo rasvoittuva hiuspohja","herkkä hiuspohja":"herkkä hiuspohja shampoo",
      "hilseilevä hiuspohja":"hilseshampoo anti-dandruff","kutiseva hiuspohja":"rauhoittava hiuspohja shampoo",
      "kuivat hiukset":"kosteuttava shampoo kuivat hiukset","vaurioituneet hiukset":"korjaava hoitoaine vaurioituneille",
      "katkeilevat hiukset":"vahvistava shampoo katkeilevat","haaroittuvat latvat":"hoitoaine latvat",
      "pörröiset hiukset":"anti-frizz shampoo pörröisyys","takkuuntuvat hiukset":"helppokampainen hoitoaine",
      "elottomat / kiillottomat hiukset":"kiiltovoide hiukset","huokoiset hiukset":"proteiinihoito hiukset",
      "värjätyt hiukset":"shampoo värjätyille hiuksille suoja","vaaleat / blondatut hiukset":"shampoo blonde vaaleille",
      "valkaistut hiukset":"hoitoaine valkaistut hiukset","raidoitetut hiukset":"shampoo raidoitetut hiukset",
      "kemiallisesti käsitellyt hiukset":"hoitoaine käsitellyt hiukset","permanentatut hiukset":"permanentti hiukset hoitoaine",
      "kosteutusta kaipaavat hiukset":"kosteuttava hiusnaamio hydraatio","korjausta kaipaavat hiukset":"korjaava tehohoito hiukset",
      "kiharien korostaminen":"curl enhancer kiharoille","pörröisyyden hallinta":"anti-frizz hiustuote",
      "värin ylläpito":"väriä suojaava shampoo","lämpösuojan tarve":"lämpösuoja hiukset",
      "auringolta suojaaminen":"aurinkosuoja hiukset uv","tuuheutta kaipaavat hiukset":"volyymiä lisäävä shampoo",
    },
    validate:/shampoo|hoitoaine|hiusnaamio|hiusöljy|hiusseerumi|hiusvaha|hiuslakka|muotovaahto|hiusvesi|hiuskuorinta|hiusväri|sävyteshampoo|kiharrin|suoristusrauta|hiustenkuivaaja|conditioner|hair\s?mask|hair\s?oil|scalp|curl/i,
  },
  kosmetiikkaTags:{
    bases:["kasvovoide seerumi ihonhoito","meikkivoide kosmetiikka ripsiväri","ihonhoito puhdistus kosteuttava"],
    tagMap:{
      "normaali iho":"kasvovoide normaali iho","kuiva iho":"kosteuttava kasvovoide kuiva iho",
      "rasvoittuva iho":"kevyt kasvovoide rasvoittuva iho","yhdistelmäiho":"kasvovoide yhdistelmäiho",
      "herkkä iho":"kasvovoide herkkä iho hajusteeton","akneen taipuvainen iho":"akne ihonhoito salicylihappo",
      "epäpuhtauksiin taipuvainen iho":"puhdistava ihonhoito epäpuhtaudet","mustapäät":"puhdistava kasvovesi mustapäät",
      "laajentuneet ihohuokoset":"huokosia supistava kasvovoide","pintakuivuus":"kosteuttava seerumi pintakuivuus",
      "samea iho":"kirkastavaa valovoide iho","epätasainen ihonsävy":"kirkastavaa seerumi ihonsävy",
      "pigmenttiläiskät":"pigmenttiläiskät valovoide","tummat läiskät":"kirkastavaa voide tummat läiskät",
      "punoitus":"rauhoittava kasvovoide punoitus","epätasainen ihon rakenne":"ihon tekstuuri tasaava",
      "hienot juonteet":"anti-aging seerumi juonteet","rypyt":"anti-aging voide rypyt retinol",
      "ihon kimmoisuuden väheneminen":"kiinteyttävä kasvovoide","ikääntyvä / kypsyvä iho":"anti-aging kypsä iho voide",
      "kosteutuksen tarve":"intensiivisesti kosteuttava seerumi","heleyden tarve":"glow valovoide kirkas iho",
      "ihon suojabarrierin vahvistaminen":"barrieri vahvistava kasvovoide","erittäin herkkä iho":"ultra-herkkä hajusteeton kasvovoide",
      "hajusteherkkyys":"hajusteeton ihonhoito tuote","rosacea-/couperosa-taipumus":"rauhoittava rosacea kasvovoide",
    },
    validate:/kasvovoide|seerumi|meikkivoide|foundation|ripsiväri|luomiväri|huulipuna|puuteri|primer|ihonhoito|puhdistus|toner|kasvovesi|naamio|kuorinta|kosteuttava|aurinkosuoja|cleanser|moisturizer|eye\s?cream|face\s?mask|kynsilakka|deodorantti|suihkugeeli|saippua|parfyymi|hajuvesi/i,
  },
  tyyliTags:{
    bases:["naisten vaatteet muoti","naisten kengät","naisten laukku koru asusteeet"],
    tagMap:{
      "klassinen":"naisten klassinen vaate","minimalistinen":"naisten minimalistinen vaate",
      "rento / casual":"naisten casual arki vaate","elegantti":"naisten elegantti mekko",
      "juhlava":"naisten juhla mekko","sporttinen":"naisten sporttinen vaate athleisure",
      "athleisure":"naisten athleisure treeni vaate","boheemi / boho":"naisten boho mekko pusero",
      "romanttinen":"naisten romanttinen pusero mekko","naisellinen":"naisten naisellinen vaate",
      "streetwear":"naisten streetwear vaate","trendikäs":"naisten trendikäs vaate",
      "vintage":"naisten vintage tyyli vaate","retro":"naisten retro tyyli vaate",
      "preppy":"naisten preppy vaate","edgy / rock":"naisten edgy vaate nahka",
      "business / office":"naisten toimistovaate bleiseri","scandi / skandinaavinen":"naisten skandinaavinen vaate",
      "y2k":"naisten Y2K muoti","arkeen":"naisten arki vaate casual paita",
      "töihin":"naisten toimistovaate","toimistolle":"naisten bleiseri toimisto",
      "vapaa-ajalle":"naisten vapaa-ajan vaate","treeneihin":"naisten treenivaate",
      "ulkoiluun":"naisten ulkoiluvaate takki","treffeille":"naisten treffe mekko",
      "juhliin":"naisten juhla mekko","häihin":"naisten juhlamekko häävieras",
      "lomalle":"naisten kesävaate loma","matkustamiseen":"naisten matkailu vaate",
      "ilta-/ravintolakäyttöön":"naisten illallisvaate mekko",
      "istuvat vaatteet":"naisten istuvat vaatteet","väljä / oversize":"naisten oversized vaate",
      "korostettu vyötärö":"naisten vyötäröä korostava mekko",
    },
    validate:/vaate|mekko|pusero|paita|takki|housut|hame|farkut|kenkä|laukku|koru|rannekoru|kaulakoru|korvakorut|vyö|huivi|hattu|asukokonaisuus|bikini|uima-asu|neuletakki|leggings|jumpsuit|bleiseri|jakku|neule|toppi|t-paita|shortsit|huppari|college|sandaali|saapas|nilkkuri|tennarit|sneaker/i,
  },
};

/* ── Kyselyjen laajentaminen — yleiset termit → tarkemmat hakusanat ── */
const QUERY_EXPAND = {
  "hius":"shampoo hiusten hoitoaine",
  "hiukset":"shampoo hiusten hoitoaine",
  "hiustenhoito":"shampoo hoitoaine hiusnaamio",
  "meikki":"meikkivoide foundation luomiväri",
  "kosmetiikka":"meikkivoide ripsiväri luomiväri",
  "iho":"kasvovoide ihonhoito seerumi",
  "ihonhoito":"kasvovoide seerumi päivävoide",
  "ihonhoitotuotteet":"kasvovoide seerumi toner",
  "kasvot":"kasvovoide päivävoide seerumi",
  "kasvojenhoito":"kasvovoide puhdistus seerumi",
  "hygienia":"suihkugeeli deodorantti saippua",
  "hajuvesi":"naisten hajuvesi eau de parfum",
  "tuoksu":"naisten hajuvesi parfyymi",
  "parfyymi":"naisten eau de parfum edp",
  "vaate":"naisten mekko pusero paita",
  "vaatteet":"naisten mekko pusero paita",
  "kengät":"naisten tennarit sneakers",
  "kengat":"naisten tennarit kengät",
  "kenkä":"naisten kenkä tennarit",
  "laukku":"naisten käsilaukku olkalaukku",
  "laukut":"naisten käsilaukku olkalaukku",
  "koru":"naisten kaulakoru korvakorut",
  "korut":"naisten kaulakoru korvakorut",
  "kello":"naisten rannekello",
  "kellot":"naisten rannekello kello",
  "asuste":"naisten aurinkolasit huivi",
  "asusteet":"naisten aurinkolasit huivi vyö",
  "meikkivoide":"meikkivoide foundation",
  "seerumi":"kasvoseerumi ihonhoito",
};
const expandQuery = q => {
  const trimmed = q.trim();
  const words = trimmed.split(/\s+/);
  if(words.length > 2) return trimmed;
  return QUERY_EXPAND[trimmed.toLowerCase()] || trimmed;
};

/* ── Onko tuotteella avattava linkki ── */
const hasUsableLink = item => {
  const link = item.link || '';
  if(!link) return false;
  if(!isGoogleUrl(link)) return true;
  if(isGoogleShoppingUrl(link)) return !!storeDomain((item.store||''));
  return false;
};

/* ── Tuotenimivertailu ── */
function titleMatch(query, title) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const t = title.toLowerCase();
  if (!words.length) return 1;
  return words.filter(w => t.includes(w)).length / words.length;
}

const BLOCKED = new RegExp([
  "ebay\\.", "amazon\\.(com|de|co\\.|fr|se|no|dk)", "alibaba\\.", "aliexpress\\.",
  "wish\\.com", "joom\\.", "fruugo\\.", "onbuy\\.", "bol\\.com", "coolblue\\.",
  "tise\\.com", "vinted\\.", "tori\\.fi", "huuto\\.net", "depop\\.", "poshmark\\.", "selpy\\.", "cdon\\.fi",
  "shein\\.", "zaful\\.", "dhgate\\.", "banggood\\.", "lightinthebox\\.", "gearbest\\.",
  "tomtop\\.", "romwe\\.", "dresslily\\.", "sammydress\\.", "rosegal\\.", "jollychic\\.",
  "asos\\.", "boohoo\\.", "prettylittlething\\.", "missguided\\.", "nastygal\\.",
  "farfetch\\.", "net-a-porter\\.", "matchesfashion\\.",
  "currys\\.", "argos\\.", "very\\.co", "johnlewis\\.", "boots\\.com", "superdrug\\.",
  "otto\\.de", "alternate\\.", "notebooksbilliger\\.", "cyberport\\.", "saturn\\.de",
  "manomano\\.", "cdiscount\\.", "tradeinn\\.",
  "outnorth\\.", "addnature\\.", "bikester\\.", "cdon\\.com",
  "pricerunner\\.", "idealo\\.", "kelkoo\\.", "shopzilla\\.", "pricespy\\.",
  "hintavertailu\\.fi", "hinta\\.fi", "vertaa\\.fi",
  "etsy\\.", "wish\\.", "walmart\\.", "target\\.com",
].join("|"), "i");

const isGoogleUrl = url => {
  if (!url) return true;
  try { return new URL(url).hostname.includes('google.'); } catch { return true; }
};

const isGoogleShoppingUrl = url => {
  if (!url) return false;
  try { const u = new URL(url); return u.hostname.includes('google.') && u.searchParams.get('ibp')==='oshop'; } catch { return false; }
};

const isFinnish = item => {
  const link = item.link || '';
  const domain = domOf(link) || '';
  const store = (item.store || '').toLowerCase();
  // Viro/Latvia/Liettua yritysmuodot — ei suomalaisia
  if (/\s+(o[üu]|uab|sia|llc|ltd|gmbh|sro|d\.o\.o\.)$/i.test(item.store || '')) return false;
  // Tarkempi Vitateka-suodatus ja muut tunnetut baltialaiset kaupat
  if (/vitateka|kaup24|pigu\.|220\.(lv|ee|lt)|1a\.(lv|lt)|varle\.|msrv\./i.test(store+domain)) return false;
  // Google Shopping proxy-linkit (ibp=oshop) ovat kelvollisia — tarkista vain kaupan nimi
  if (isGoogleShoppingUrl(link)) return store.length > 0 && !BLOCKED.test(store);
  // Muut google-linkit (orgaaniset hakutulokset tms.) hylätään
  if (isGoogleUrl(link)) return false;
  // Suorat kauppalinkit: tarkista sekä domain että kaupan nimi
  return !BLOCKED.test(domain) && !BLOCKED.test(store);
};

const cleanUrl = (url) => {
  if (!url) return null;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('google.com')) {
      const direct = u.searchParams.get('url') || u.searchParams.get('adurl');
      if (direct && (direct.startsWith('http://') || direct.startsWith('https://'))) return direct;
      return url;
    }
    return url;
  } catch { return null; }
};

// Jäsentää toimituskulun tekstistä → {cost: numero|null, free: bool, text: string}
const parseDelivery = (str) => {
  if(!str) return {cost:null,free:false,text:""};
  const s = String(str).toLowerCase();
  if(/free|ilmainen|gratis|0[\s,.]?[e€]|maksuton/i.test(s)) return {cost:0,free:true,text:str};
  const m = s.match(/[\+\s]?([\d]+[,.][\d]{1,2})\s*[€e]/) || s.match(/[€e]\s*([\d]+[,.][\d]{1,2})/);
  if(m) return {cost:parseFloat(m[1].replace(",",".")),free:false,text:str};
  const m2 = s.match(/[\+\s]?([\d]+)\s*[€e]/);
  if(m2) return {cost:parseFloat(m2[1]),free:false,text:str};
  return {cost:null,free:false,text:str};
};

// Tuotemerkit kategorioittain hakua varten
const BRANDS = {
  meikit:      ["Lumene","Maybelline","L'Oréal Paris","NYX","MAC","Clinique","Estée Lauder","Rimmel","Essence","Catrice","Barry M","NARS","Charlotte Tilbury","Urban Decay","Too Faced","e.l.f.","Makeup Revolution","Bourjois","Max Factor","Inglot"],
  ihonhoito:   ["Lumene","La Roche-Posay","Bioderma","CeraVe","The Ordinary","Paula's Choice","Neutrogena","Vichy","Eucerin","Clarins","Kiehl's","Dermalogica","Avène","ISDIN","NIVEA","Garnier","Olay"],
  hiukset:     ["Schwarzkopf","Wella","Garnier","L'Oréal Paris","Redken","Pantene","Elvital","Syoss","Aussie","Tigi","Moroccanoil","Kérastase","Olaplex","Paul Mitchell","Joico","ghd","BaByliss","Braun"],
  parranhoito: ["Gillette","Braun","Philips","Nivea Men","L'Oréal Men Expert","Wilkinson","Proraso","The Art of Shaving","Bulldog","Baxter of California"],
  hygienia:    ["NIVEA","Dove","Rexona","Axe","Garnier","Head & Shoulders","Oral-B","Colgate","Signal","Durex","Always","Tampax","Libresse"],
  tuoksut:     ["Chanel","Dior","YSL","Lancôme","Armani","Hugo Boss","Paco Rabanne","Calvin Klein","Versace","Dolce & Gabbana","Jimmy Choo","Gucci","Burberry","Marc Jacobs","Valentino","Givenchy"],
  vaatteet:    ["H&M","Zara","Mango","Gina Tricot","Vila","Only","Selected","Vero Moda","Lindex","Cubus","Weekday","Arket","COS","Jack & Jones","Pieces","Levi's","Tommy Hilfiger"],
  kengat:      ["Nike","Adidas","New Balance","Vans","Converse","Birkenstock","Steve Madden","Vagabond","Tamaris","Rieker","UGG","Skechers","Puma","ALDO","Ecco","Clarks"],
  laukut:      ["Zara","H&M","Mango","Michael Kors","Coach","Kate Spade","Furla","Coccinelle","Longchamp","Gina Tricot","HVISK","Nunoo","Valentino Garavani","Gucci"],
  korut:       ["Pilgrim","Edblad","Pernille Corydon","Maria Black","Pandora","Thomas Sabo","Swarovski","Julie Sandlau","Maanesten","Georg Jensen","Monica Vinader"],
  kellot:      ["Casio","Fossil","Michael Kors","Daniel Wellington","Garmin","Suunto","Tissot","Citizen","CLUSE","Rosefield"],
  asusteet:    ["H&M","Zara","Mango","Gina Tricot","Lindex","Ray-Ban","Oakley","Carhartt","New Era"],
};

// Kaikki brändit yhdistettynä autocomplete-ehdotuksia varten
const ALL_BRANDS=[...new Set(Object.values(BRANDS).flat())].sort();

// Suodattaa autocomplete-ehdotukset kirjoitetun tekstin perusteella (brändit + historia)
function getAutoSugg(q,history){
  if(!q||q.length<2)return[];
  const lq=q.toLowerCase();
  const brandMatches=ALL_BRANDS.filter(b=>b.toLowerCase().startsWith(lq)).slice(0,4);
  const histMatches=(history||[]).filter(h=>h.toLowerCase().includes(lq)&&!brandMatches.includes(h)).slice(0,3);
  return[...brandMatches,...histMatches].slice(0,6);
}

/* ── Kategoriakohtainen tulosvalidointi — käytetään yhteisessä hakumoottorissa ── */
const CAT_VALIDATE = {
  meikit:      /meikkivoide|foundation|ripsiväri|mascara|luomiväri|eyeshadow|huulipuna|lipstick|puuteri|powder|primer|meikki|makeup|rouge|kajal|silmämeikki|huuliöljy|lip\s?oil|kynsilakka|nail\s?polish|geelilakka|gel\s?nail|concealer|peitevoide|highlighter|korostustuote|bronzer|aurinkopuuteri|poskipuna|blush|setting\s?spray|meikkipohja|meikkisivelin|meikkisieni|eyeliner|kulmakynä|kulmaväri|tekoripset|huulikiilto|lip\s?gloss|ripsentaivutin|meikkilaukku|meikkipeili|puuterivippa|ripsiliima|huultenrajaus|huulenkiilto|luomiväri|meikki/i,
  ihonhoito:   /kasvovoide|päivävoide|yövoide|seerumi|ihonhoito|toner|kasvovesi|kasvonaamio|face\s?mask|kasvokuorinta|kosteuttava|cleanser|moisturizer|silmänympärys|eye\s?cream|aurinkosuoja|spf|puhdistus|retinol|hyaluronihappo|niasinamidi|c-vitamiini|happohoito|peeling|kasvoöljy|misellivesi|vartalovoide|vartaloöljy|vartalokuorinta|käsivoide|jalkavoide|itseruskettava|after\s?sun|aftersun|body\s?lotion|body\s?oil/i,
  hiukset:     /shampoo|hoitoaine|hiusnaamio|hiusöljy|hiusseerumi|hiusvaha|hiuslakka|muotovaahto|hiusvesi|hiuskuorinta|hiusväri|sävyteshampoo|kiharrin|suoristusrauta|hiustenkuivaaja|conditioner|hair\s?mask|hair\s?oil|hair\s?cream|blow\s?dry|argan|hiuslenkki|scrunchie|hiussolki|hiuspanta|ilmakiharrin|palsami|balsami|muotoilugeeli|lämpösuoja|suolasuihke|hiustuote/i,
  parranhoito: /partavaahto|parranajogeeli|partaöljy|partabalsami|partavaha|parranajokone|trimmeri|partaveitsi|aftershave|parranhoito|beard\s?oil|beard\s?balm|shaving|razor|partaharja|partaterä/i,
  hygienia:    /suihkugeeli|shower\s?gel|saippua|soap|deodorantti|deodorant|antiperspirantti|hammastahna|toothpaste|suuvesi|mouthwash|intiimipesu|intim|kylpyöljy|kylpysuola|karvanpoisto|epilaattori|tamponi|terveysside|kuukautiskuppi|kuukautisalushousut|jalkojenhoito|kosteuspyyhe|käsisaippua|hand\s?soap/i,
  tuoksut:     /hajuvesi|parfyymi|eau\s?de\s?parfum|eau\s?de\s?toilette|eau\s?de\s?cologne|body\s?mist|tuoksusuihke|tuoksukynttil|diffuusori|huonetuoksu|fragrance|perfume|niche\s?parfyymi/i,
  vaatteet:    /paita|t-paita|pusero|mekko|hame|farkut|housut|leggings|huppari|neuletakki|neule|takki|bleiseri|trenssi|puffer|alusvaatteet|rintaliivi|pyjama|uima-asu|bikini|toppi|bodysuit|treenivaate|urheiluvaate|college|jumpsuit|haalari|shortsit|liivi|collegehousut/i,
  kengat:      /kengät|tennarit|sneaker|saappaat|nilkkurit|sandaalit|avokkaat|loaferit|balerinakengät|ballerina|espadrillit|tohvelit|pumps|korko|juoksukengät|treeni.*kengät|vaelluskengät|tenniskengät|kumisaappaat|talvikengät|oxford|derby|mokkasiinit/i,
  laukut:      /laukku|käsilaukku|olkalaukku|crossbody|tote\s?bag|clutch|reppu|backpack|vyölaukku|fanny\s?pack|weekender|lompakko|korttikotelo|matkakassi/i,
  korut:       /kaulakoru|korvakorut|rannekoru|sormus|ring|necklace|earring|bracelet|riipus|pendant|nilkkakoru|lävistyskorut|korusetti|hopeasorut|kultakorut|teräskoru|muotikorut/i,
  kellot:      /rannekello|watch|analoginen|digitaalinen.*kello|muotikello|korukello/i,
  asusteet:    /hattu|pipo|lippis|baskeri|olkihattu|huivi|kaulahuivi|bandana|käsineet|hanskat|vyö\b|belt|aurinkolasit|sunglasses|sateenvarjo|muotisukat|rintaneula|solki/i,
};

/* ── Globaali valkolistattu suodatin ─────────────────────────────────────────
   Kaikki hakutulokset käyvät tämän läpi riippumatta siitä, onko kategoria valittu.
   Tuote pääsee läpi JOS sen nimi tai kuvaus osuu johonkin sovelluksen kategoriaan.
   Näin koiran ruoka, vasikka, elektroniikka jne. suodattuvat automaattisesti.
─────────────────────────────────────────────────────────────────────────── */
const APP_ALLOWLIST = new RegExp(
  Object.values(CAT_VALIDATE).map(r => r.source).join("|"),
  "i"
);

// Blokeeraa onAuthStateChanged koko rekisteröintivirran ajan — estää profiilivilahduksen
let _suppressAuthChange = false;

// ── Muuta tähän ilmaisversion kuukausittainen hakuraja ──
const FREE_MONTHLY_LIMIT = 10;
// ── Plus-tilauksen kuukausihinta — muuta vain tästä ──
const PLUS_PRICE = "4,99 €/kk";
const PLUS_PRICE_SHORT = "4,99 €";
// ── iOS standalone-tila (kotivalikko) — lasketaan kerran käynnistyksessä ──
const IS_STANDALONE = !!window.navigator.standalone || window.matchMedia('(display-mode:standalone)').matches;

/* ── Styles ── */
const S = {
  bg:"#FFF8F3",ink:"#2B1B2E",rose:"#E8447F",rd:"#C22E68",rs:"#FFE0EE",
  yel:"#FFC940",ys:"#FFF3D1",at:"#92720B",grn:"#1FA463",gs:"#DFF7E9",
  mut:"#8A7A86",brd:"#F0DCE6",wh:"#FFFFFF"
};
const FF = "'Inter', system-ui, sans-serif";
const card = (bg,bc) => ({background:bg||S.wh,border:"1.5px solid "+(bc||S.brd),borderRadius:18,padding:13,marginBottom:10,fontFamily:FF});
const btn = (bg,c) => ({background:bg,color:c||S.wh,border:"none",borderRadius:12,padding:"9px 18px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:FF,letterSpacing:"0.01em"});
const inp = {flex:1,padding:"13px 15px",borderRadius:14,border:"1.5px solid "+S.brd,fontSize:14,outline:"none",background:S.wh,fontFamily:FF};
const chip = (active) => ({background:active?S.ink:S.wh,color:active?S.wh:S.ink,border:"1px solid "+(active?S.ink:S.brd),borderRadius:20,padding:"7px 15px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:FF});

/* ── API ── */
async function liveSearch(q) {
  try {
    const r = await fetch(API+"/api/search?q="+encodeURIComponent(q)+"&gl=fi&hl=fi");
    return await r.json();
  } catch(e) { return {ok:false,error:"Yhteys epäonnistui: "+e.message,results:[]}; }
}

/* ── YHTEINEN HAKUMOOTTORI ──────────────────────────────────────────────────
   Kaikki hakutoiminnot (Haku, AI-Vertaa, AI-Löydä sopiva) käyttävät tätä.
   Korjaukset kategoria- tai tuotesuodatukseen riittää tehdä yhteen paikkaan.
   opts: { catMain, catSub, brand, validate, gender, titleThreshold }
─────────────────────────────────────────────────────────────────────────── */
async function searchProducts(query, opts={}) {
  const {catMain, brand, validate, gender, titleThreshold=0} = opts;
  const d = await liveSearch(query);
  if (!d.ok || !Array.isArray(d.results)) return d;

  let results = d.results;

  // 1. Perussuodatus: suomalainen kauppa, ei ruokaa, ei estettyä tuotetta
  results = results.filter(r => isFinnish(r) && !isFoodResult(r) && !isBlockedProduct(r));

  // 2. Globaali valkolistattu suodatin — tuote pitää kuulua johonkin sovelluksen kategoriaan.
  //    Jos tuote ei osu hiuksiin, kosmetiikkaan, vaatteisiin, kenkiin jne., se hylätään.
  //    Näin koiran ruoka, elektroniikka, vasikka jne. katoavat automaattisesti.
  results = results.filter(r =>
    APP_ALLOWLIST.test(r.title || "") || APP_ALLOWLIST.test(r.description || "")
  );

  // 3. Kategoriavalidointi — tarkennetaan valittuun pääkategoriaan jos sellainen on
  //    Prioriteetti: eksplisiittinen validate-regex > CAT_VALIDATE[catMain]
  const catRegex = validate || (catMain ? CAT_VALIDATE[catMain] : null);
  if (catRegex) {
    results = results.filter(r =>
      catRegex.test(r.title || "") || catRegex.test(r.description || "")
    );
  }

  // 3. Tuotemerkki — tuotteen nimessä tai kaupan nimessä pitää esiintyä valittu merkki
  if (brand) {
    const bl = brand.toLowerCase();
    results = results.filter(r =>
      (r.title||"").toLowerCase().includes(bl) ||
      (r.store||"").toLowerCase().includes(bl)
    );
  }

  // 4. Sukupuolisuodatus
  if (gender === "Nainen") {
    const MALE_RE = /\bmiesten?\b|\bherrojen\b|\bmiehille\b|\bmen'?s?\b|\bman'?s?\b/i;
    results = results.filter(r => !MALE_RE.test(r.title||""));
  } else if (gender === "Mies") {
    const FEMALE_RE = /\bnaisten?\b|\bnaisille\b|\bwomen'?s?\b|\bwoman'?s?\b|\bladies\b/i;
    results = results.filter(r => !FEMALE_RE.test(r.title||""));
  }

  // 5. Tuotenimiosuma — jos kynnys asetettu (esim. Skannaa-työkalu)
  if (titleThreshold > 0) {
    const exact = results.filter(r => titleMatch(query, r.title||"") >= titleThreshold);
    if (exact.length > 0) results = exact;
  }

  // 6. Käytettävä linkki
  results = results.filter(r => hasUsableLink(r));

  // 7. Järjestys kokonaishinnan mukaan (tuote + toimitus) — lasketaan kerran per tuote
  results = results.map(r => {
    const del = parseDelivery(r.delivery);
    return {...r, _total: (r.price ?? 9999) + (del.free ? 0 : (del.cost ?? 0))};
  }).sort((a, b) => a._total - b._total);

  return {...d, results};
}
async function liveCodes(domain) {
  try {
    const r = await fetch(API+"/api/codes?domain="+encodeURIComponent(domain));
    return await r.json();
  } catch(e) { return {ok:false,error:e.message,results:[]}; }
}

/* ── Ingredients ── */
const INGREDIENTS = {
  "arganöljy":"Antaa kiiltoa ja pehmentää kuivaa tai vaurioitunutta hiusta. Sisältää E-vitamiinia.",
  "kookosöljy":"Pehmentää ja kosteuttaa hiusta syvältä, sopii karkeaan tai paksuun hiukseen.",
  "sheavoi":"Voimakkaan kosteuttava, sopii erittäin kuiville hiuksille ja iholle.",
  "keratiini":"Vahvistaa hiuksen rakennetta ja täyttää vaurioituneita kohtia.",
  "biotiini":"B-vitamiini, tukee hiuksen ja hiuspohjan hyvinvointia.",
  "hyaluronihappo":"Sitoo runsaasti kosteutta ihoon tai hiukseen.",
  "niacinamide":"B3-vitamiini. Tasoittaa ihon pintaa, vähentää huokosia.",
  "ceramidit":"Vahvistavat ihon suojarasvakerrosta.",
  "retinoli":"A-vitamiinijohdannainen, nopeuttaa ihon uudistumista.",
  "salisyylihappo":"BHA-happo, kuorii huokosia sisältä.",
  "glykolihappo":"AHA-happo, kuorii ihon pintakerrosta.",
  "panthenoli":"Provitamiini B5, kosteuttaa ja lisää joustavuutta.",
  "squalaani":"Kevyt kosteuttaja, sopii lähes kaikille ihotyypeille.",
  "teatreeöljy":"Antibakteerinen, sopii epäpuhtaalle iholle.",
  "glyseriini":"Kosteuttaja, sitoo vettä ihon pintaan.",
  "c-vitamiini":"Antioksidantti, kirkastaa ihoa.",
  "e-vitamiini":"Antioksidantti, suojaa hapettumiselta.",
  "kollageeni":"Tukee ihon kimmoisuutta.",
  "peptidit":"Lyhyitä proteiiniketjuja, tukevat ihon uudistumista.",
  "aloevera":"Rauhoittava, sopii herkälle iholle.",
  "urea":"Pehmentää paksuuntunutta tai kuivaa ihoa.",
  "silikonit":"Sileyttävät hiusta, voivat kertyä pitkäaikaisessa käytössä.",
  "sulfaatit":"Voimakkaita pesuaineita, voivat kuivattaa.",
  "parabeenit":"Säilöntäaineita, estävät bakteerikasvua.",
};
const ING_ALIAS = {"argan öljy":"arganöljy","argan oil":"arganöljy","shea butter":"sheavoi","tea tree":"teatreeöljy","bha":"salisyylihappo","aha":"glykolihappo","provitamiini b5":"panthenoli"};
function findIng(q) {
  const l = q.trim().toLowerCase();
  if (ING_ALIAS[l]) return ING_ALIAS[l];
  return Object.keys(INGREDIENTS).find(k => k.includes(l) || l.includes(k)) || null;
}

/* ── Store domains ── */
const STORE_DOMAINS = {
  "minimani":"minimani.fi","lyko":"lyko.com","kicks":"kicks.fi","sokos":"sokos.fi",
  "prisma":"prisma.fi","verkkokauppa":"verkkokauppa.com","verkkokauppa.com":"verkkokauppa.com",
  "gigantti":"gigantti.fi","clas ohlson":"clasohlson.com","stadium":"stadium.fi",
  "intersport":"intersport.fi","kärkkäinen":"karkkainen.com","citymarket":"citymarket.fi",
  "k-citymarket":"citymarket.fi","stockmann":"stockmann.com","zalando":"zalando.fi",
  "h&m":"hm.com","zara":"zara.com","ikea":"ikea.com","musti ja mirri":"musti.fi",
  "musti":"musti.fi","partioaitta":"partioaitta.fi","aleksi 13":"aleksi13.fi",
  "power":"power.fi","expert":"expert.fi","elgiganten":"elgiganten.fi",
  "apple":"apple.com","adidas":"adidas.fi","nike":"nike.com","bubbleroom":"bubbleroom.fi",
  "nelly":"nelly.com","boozt":"boozt.com","sportamore":"sportamore.com",
  "top-toy":"top-toy.fi","lekmer":"lekmer.fi",
  "eleven":"eleven.fi","cocopanda":"cocopanda.fi","apotea":"apotea.fi",
  "apotek":"apotek.fi","yliopiston apteekki":"yliopistonapteekki.fi",
  "life":"lifestore.fi","biltema":"biltema.fi","motonet":"motonet.fi",
  "k-rauta":"k-rauta.fi","byggmax":"byggmax.fi","rusta":"rusta.fi",
  "jula":"jula.fi","tokmanni":"tokmanni.fi","euronics":"euronics.fi",
  "s-kaupat":"s-kaupat.com","s kaupat":"s-kaupat.com","s-market":"s-kaupat.com",
  "foodie":"foodie.fi","alepa":"alepa.fi",
  "k-market":"k-ruoka.fi","k-supermarket":"k-ruoka.fi","k-extra":"k-ruoka.fi",
  "novo":"novoshop.fi","netrauta":"netrauta.fi","jimms":"jimms.fi","jimm's":"jimms.fi",
  "nettimarkkina":"nettimarkkina.fi","hifi-mani":"hifi-mani.fi",
  "br-lelut":"br-lelut.fi","br lelut":"br-lelut.fi",
  "scandinavian outdoor":"scandinavianoutdoor.fi","race fashion":"racefashion.fi",
  "marimekko":"marimekko.com","makia":"makia.com","reima":"reima.com",
  "luhta":"luhta.fi","nanso":"nanso.fi","halonen":"halonen.fi",
  "finlayson":"finlayson.fi","pentik":"pentik.com","globe hope":"globehope.fi",
  "seppälä":"seppala.fi","seppala":"seppala.fi",
  "lindex":"lindex.com","kappahl":"kappahl.com","gina tricot":"ginatricot.com",
  "vero moda":"veromoda.com","jack & jones":"jackjones.com","jack and jones":"jackjones.com",
  "only":"only.com","cubus":"cubus.com","dressmann":"dressmann.com",
  "vila":"vila.com","indiska":"indiska.com","björn borg":"bjornborg.com",
  "bjorn borg":"bjornborg.com","name it":"nameit.com","pieces":"pieces.com",
  "selected":"selected.com","selected femme":"selected.com",
  "notino":"notino.fi","douglas":"douglas.fi","parfumdreams":"parfumdreams.fi",
  "lookfantastic":"lookfantastic.fi","flaconi":"flaconi.fi",
  "parfyymi":"parfyymi.fi","dermoshop":"dermoshop.com",
  "lumene":"lumene.com","lumene shop":"lumene.com",
  "beautik":"beautik.fi","nettiapotek":"nettiapotek.fi",
  "hairstore":"hairstore.fi","hiusmaailma":"hiusmaailma.fi",
  "kampaamotuotteet":"kampaamotuotteet.fi","hiustarvike":"hiustarvike.fi",
  "hius":"hius.fi","hairlust":"hairlust.fi","beautycos":"beautycos.fi",
  "schwarzkopf":"schwarzkopf.fi","wella":"wella.com",
  "kerastase":"kerastase.fi","kérastase":"kerastase.fi",
  "redken":"redken.fi","davines":"davines.com","olaplex":"olaplex.com",
  "goldwell":"goldwell.fi","ghd":"ghdhair.com","moroccanoil":"moroccanoil.com",
  "paul mitchell":"paulmitchell.com","joico":"joico.com",
  "babyliss":"babyliss.fi","remington":"remington.com",
  "under armour":"underarmour.com","puma":"puma.com","reebok":"reebok.com",
  "new balance":"newbalance.com","columbia":"columbia.com",
  "the north face":"thenorthface.com","fjällräven":"fjallraven.com",
  "fjallraven":"fjallraven.com","haglöfs":"haglofs.com","haglofs":"haglofs.com",
  "keskinen":"keskinen.com","keskisen kauppa":"keskinen.com","keskisen":"keskinen.com",
  "puuilo":"puuilo.com","xxl":"xxl.fi","xxl sport":"xxl.fi",
  "bangerhead":"bangerhead.fi","nordicfeel":"nordicfeel.fi","nordicfeel.fi":"nordicfeel.fi",
  "ellos":"ellos.fi","carlings":"carlings.com",
  "face stockholm":"facestockholm.com","cult beauty":"cultbeauty.com",
  "beautystore":"beautystore.fi","hagel":"hagel.fi","volt":"voltfashion.com",
};
const storeDomain = store => {
  if (!store) return null;
  const key = store.toLowerCase().trim();
  if (/^[\w.-]+\.(fi|com|eu)$/.test(key)) return key;
  if (STORE_DOMAINS[key]) return STORE_DOMAINS[key];
  const match = Object.keys(STORE_DOMAINS).find(k => key.includes(k) || k.includes(key));
  return match ? STORE_DOMAINS[match] : null;
};

/* ── Small components ── */
function Spinner({label}) { return <div style={{textAlign:"center",padding:40,color:S.rose}}>⏳ {label||"Haetaan oikeita hintoja internetistä…"}</div>; }
function Err({msg}) { return <div style={{background:S.ys,color:S.at,padding:12,borderRadius:14,fontSize:13,marginBottom:12}}>⚠️ {msg}</div>; }

function PlusGate({onClose,onGo}) {
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:S.wh,borderRadius:20,padding:24,maxWidth:340,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.2)",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>👑</div>
        <div style={{fontWeight:700,fontSize:16,color:S.ink,marginBottom:8}}>Plus-ominaisuus</div>
        <p style={{fontSize:13,color:S.mut,marginBottom:16}}>Alennuskoodien tarkistus on saatavilla Plus-käyttäjille. Aktivoi Plus ja tarkista viralliset alennuskoodit kaupan omilta sivuilta.</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{...btn(S.brd,S.mut),flex:1,padding:"10px 0"}}>Ei nyt</button>
          <button onClick={onGo} style={{...btn(S.rose),flex:1,padding:"10px 0"}}>Aktivoi Plus</button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({item,rank,toggleFav,addList,isFav,isPlus,goPlus,maxPrice}) {
  const[codesOpen,setCodesOpen]=useState(false);
  const[codes,setCodes]=useState(null);
  const[codesLoading,setCodesLoading]=useState(false);
  const[linkLoading,setLinkLoading]=useState(false);
  const[showPlusGate,setShowPlusGate]=useState(false);
  const[linkErr,setLinkErr]=useState(false);
  const[resolvedUrl,setResolvedUrl]=useState(null);
  const domain=domOf(item.link);
  const directUrl=cleanUrl(item.link);

  const navigate=(url)=>{
    if(!url)return;
    if(IS_STANDALONE){window.location.href=url;}  // iOS standalone → avautuu Safarissa
    else{window.open(url,'_blank','noopener,noreferrer');}  // muu → uusi välilehti
  };

  const openProduct=async()=>{
    setLinkErr(false);setResolvedUrl(null);
    if(!item.title&&!directUrl)return;

    // Suora ei-Google-linkki → navigoi heti
    if(directUrl&&!isGoogleUrl(directUrl)){navigate(directUrl);return;}

    // Haetaan oikea tuotesivu API:sta
    const sd=storeDomain(item.store);
    if(sd){
      setLinkLoading(true);
      try{
        const r=await fetch(`${API}/api/link?${new URLSearchParams({q:item.title,domain:sd})}`);
        const d=await r.json();
        if(d.ok&&d.url){
          if(IS_STANDALONE){navigate(d.url);}  // iOS: navigoi heti (window.location.href sallittu await:n jälkeen)
          else{setResolvedUrl(d.url);}         // muu: näytä naputettava linkki
          setLinkLoading(false);return;
        }
      }catch{}
      setLinkLoading(false);
    }
    // Varasuunnitelma: käytä suoraa linkkiä
    if(directUrl){
      if(IS_STANDALONE){navigate(directUrl);}
      else{setResolvedUrl(directUrl);}
      return;
    }
    setLinkErr(true);
  };

  const loadCodes=async()=>{
    if(!isPlus){setShowPlusGate(true);return;}
    setCodesOpen(true);if(codes)return;
    setCodesLoading(true);setCodes(await liveCodes(domain));setCodesLoading(false);
  };
  const bg=rank===0?S.gs:rank===1?S.ys:S.wh;
  const bc=rank===0?S.grn:rank===1?S.yel:S.brd;
  const badge=rank===0?"🏷️ Halvin":rank===1?"🏷️ Toiseksi halvin":null;
  const savedAmount=maxPrice&&item.price!=null&&maxPrice>item.price?maxPrice-item.price:0;

  return(
    <div style={card(bg,bc)}>
      {showPlusGate&&<PlusGate onClose={()=>setShowPlusGate(false)} onGo={()=>{setShowPlusGate(false);goPlus();}}/>}
      <div style={{display:"flex",gap:10}}>
        {item.image&&<img src={item.image} alt="" style={{width:56,height:56,borderRadius:12,objectFit:"cover",background:S.rs}} onError={e=>{e.target.style.display="none"}}/>}
        <div style={{flex:1,minWidth:0}}>
          {badge&&<span style={{background:rank===0?S.grn:S.at,color:S.wh,fontSize:10,fontWeight:700,borderRadius:10,padding:"2px 8px",display:"inline-block",marginBottom:4}}>{badge}</span>}
          {savedAmount>0.01&&<span style={{background:S.rose,color:S.wh,fontSize:10,fontWeight:700,borderRadius:10,padding:"2px 8px",display:"inline-block",marginBottom:4,marginLeft:4}}>Säästät {eur(savedAmount)}</span>}
          <div style={{fontSize:13,fontWeight:600,color:S.ink,lineHeight:1.3}}>{item.title}</div>
          {item.store&&<div style={{fontSize:11,color:S.mut,marginTop:2}}>🏪 {item.store}</div>}
          {item.delivery&&<div style={{fontSize:10.5,color:S.mut}}>🚚 {item.delivery}</div>}
          {item.rating&&<div style={{fontSize:10.5,color:S.mut}}>⭐ {item.rating}{item.ratingCount?" ("+item.ratingCount+")":""}</div>}
        </div>
        <div style={{textAlign:"right",flexShrink:0,minWidth:80}}>
          {item.price!=null?(
            <div>
              <div style={{fontSize:16,fontWeight:700,color:S.ink,fontFamily:"monospace"}}>{eur(item.price)}</div>
              {(()=>{const del=parseDelivery(item.delivery);
                if(del.free) return <div style={{fontSize:10,color:S.grn,fontWeight:700,marginTop:1}}>+ toimitus 0 €</div>;
                if(del.cost!=null) return(
                  <div style={{marginTop:2}}>
                    <div style={{fontSize:10,color:S.mut}}>+ toimitus {eur(del.cost)}</div>
                    <div style={{fontSize:11,fontWeight:700,color:S.rd,fontFamily:"monospace"}}>{eur(item.price+del.cost)} yht.</div>
                  </div>
                );
                if(item.delivery) return <div style={{fontSize:10,color:S.mut,marginTop:1}}>toimitus: ?</div>;
                return null;
              })()}
            </div>
          ):<div style={{fontSize:11,color:S.mut}}>Hinta ei saatavilla</div>}
        </div>
      </div>
      {linkErr&&<div style={{fontSize:11,color:S.mut,marginTop:6,background:S.rs,borderRadius:8,padding:"5px 8px"}}>Tuotesivua ei löytynyt automaattisesti. Hae tuote kaupan omilta sivuilta.</div>}
      <div style={{display:"flex",gap:6,marginTop:10}}>
        {resolvedUrl
          /* Ratkaistu URL: näytetään oikeana <a>-linkkipainikkeen — toimii aina mobiilissa */
          ?<a href={resolvedUrl} target="_blank" rel="noopener noreferrer"
              style={{...btn(S.grn),flex:1,textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              ↗ Napauta avataksesi tuotesivun
            </a>
          :(directUrl||item.title)
            ?<button onClick={openProduct} disabled={linkLoading} style={{...btn(S.ink),flex:1,textAlign:"center",opacity:linkLoading?0.7:1}}>
               {linkLoading?"⏳ Haetaan linkkiä…":"🔗 Tuotesivulle"}
             </button>
            :<span style={{...btn(S.brd,S.mut),flex:1,textAlign:"center"}}>Ei linkkiä</span>
        }
        <button onClick={()=>addList({...item,savedAmount})} style={btn(S.rs,S.rd)} title="Ostoslistalle">📋</button>
        <button onClick={()=>toggleFav(item)} style={btn(isFav?S.rd:S.rs,isFav?S.wh:S.rd)} title="Suosikkeihin">{isFav?"💗":"🤍"}</button>
      </div>
      {domain&&(
        <button onClick={loadCodes} style={{width:"100%",marginTop:8,background:S.wh,border:"1px solid "+S.brd,borderRadius:10,padding:"6px 0",fontSize:11,color:isPlus?S.rd:S.mut,fontWeight:600,cursor:"pointer",fontFamily:FF}}>
          {isPlus?"🏷️ Tarkista voimassa olevat alennuskoodit":"🏷️ Tarkista alennuskoodit 🔒"}
        </button>
      )}
      {codesOpen&&isPlus&&(
        <div style={{marginTop:8,background:S.bg,borderRadius:10,padding:10}}>
          {codesLoading&&<Spinner label="Haetaan kaupan sivulta…"/>}
          {!codesLoading&&(!codes?.results?.length)&&(
            <p style={{fontSize:11,color:S.mut,margin:0}}>Valitettavasti tällä hetkellä ei löytynyt voimassa olevia virallisia alennuskoodeja tälle kaupalle.</p>
          )}
          {!codesLoading&&codes?.results?.map((c,i)=>(
            <div key={i} style={{background:S.wh,borderRadius:10,padding:10,marginBottom:8,border:"1px solid "+S.brd}}>
              {/* Koodi/koodit kopiointipainikkeella */}
              {c.codes&&c.codes.length>0?(
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:7}}>
                  {c.codes.map((code,j)=>(
                    <button key={j} onClick={()=>{
                      navigator.clipboard.writeText(code).then(()=>{
                        const el=document.getElementById(`code-copied-${i}-${j}`);
                        if(el){el.textContent="✓ Kopioitu";setTimeout(()=>{el.textContent=code+" 📋";},2000);}
                      }).catch(()=>{});
                    }}
                      id={`code-copied-${i}-${j}`}
                      style={{background:S.ink,color:S.wh,border:"none",borderRadius:8,padding:"5px 12px",fontSize:13,fontWeight:700,fontFamily:"monospace",cursor:"pointer",letterSpacing:"0.06em"}}>
                      {code} 📋
                    </button>
                  ))}
                </div>
              ):(
                <div style={{fontSize:11,color:S.mut,marginBottom:6}}>Kaupan omalta kampanjasivulta löydetty tarjous — koodi ei tunnistettu tekstistä.</div>
              )}
              {/* Alennuksen määrä */}
              {c.discount&&(
                <div style={{fontSize:14,fontWeight:700,color:S.grn,marginBottom:5}}>{c.discount} alennus</div>
              )}
              {/* Voimassaoloaika */}
              {c.validUntil&&c.validityStatus!=="no_end_date"&&(
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                  <span style={{fontSize:11,color:c.validityStatus==="valid"||c.validityStatus==="today_only"?S.grn:S.mut}}>
                    📅 {c.validityStatus==="valid"?"Voimassa":"Ajanjakso"}: {c.validUntil}
                  </span>
                </div>
              )}
              {c.validityStatus==="no_end_date"&&(
                <div style={{fontSize:10.5,color:S.mut,marginBottom:5}}>
                  📅 Voimassaoloaikaa ei ilmoitettu kaupan sivulla
                </div>
              )}
              {/* Ehdot */}
              {c.conditions&&c.conditions.length>0&&(
                <div style={{fontSize:11,color:S.mut,marginBottom:5,lineHeight:1.4}}>
                  ℹ️ {c.conditions.join(' · ')}
                </div>
              )}
              {/* Alkuperäinen snippet */}
              <div style={{fontSize:10.5,color:S.mut,lineHeight:1.45,marginBottom:6,fontStyle:"italic"}}>"{c.snippet}"</div>
              {/* Linkki kaupan sivulle */}
              <a href={c.link} target="_blank" rel="noreferrer"
                style={{fontSize:10.5,color:S.rd,textDecoration:"none",fontWeight:600}}>
                Siirry kaupan kampanjasivulle →
              </a>
            </div>
          ))}
          {!codesLoading&&codes?.results?.length>0&&(
            <p style={{fontSize:9.5,color:S.mut,marginTop:4,lineHeight:1.4}}>
              Haettu kaupan omilta sivuilta. Tarkista aina voimassaolo ja ehdot kaupan sivulta ennen kassalle menoa.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tuotematching: ryhmittää saman tuotteen eri kaupoista ── */
const MATCH_STOPWORDS=/\b(the|and|with|for|by|in|of|fi|se|en|sv|kpl|pcs|pack|set|uusi|new|original|ml|g|l|kg|cl|oz)\b/gi;
function normalizeForMatch(title){
  return (title||"").toLowerCase()
    .replace(/(\d+)\s*(ml|g|l|kg|cl|oz)/gi,"$1$2")
    .replace(MATCH_STOPWORDS," ")
    .replace(/[^\w\d\s]/g," ")
    .replace(/\s+/g," ").trim();
}
function titleSimilarity(a,b){
  const wa=new Set(normalizeForMatch(a).split(" ").filter(w=>w.length>2));
  const wb=new Set(normalizeForMatch(b).split(" ").filter(w=>w.length>2));
  const inter=[...wa].filter(w=>wb.has(w)).length;
  const union=new Set([...wa,...wb]).size;
  return union>0?inter/union:0;
}
function groupProducts(items){
  const groups=[];const used=new Set();
  for(let i=0;i<items.length;i++){
    if(used.has(i))continue;
    const g=[items[i]];used.add(i);
    for(let j=i+1;j<items.length;j++){
      if(used.has(j))continue;
      if(titleSimilarity(items[i].title,items[j].title)>=0.65){g.push(items[j]);used.add(j);}
    }
    g.sort((a,b)=>(a._total??9999)-(b._total??9999));
    groups.push(g);
  }
  groups.sort((a,b)=>(a[0]._total??9999)-(b[0]._total??9999));
  return groups;
}

/* ── GroupedResultCard: näyttää yhden tuotteen kaikki kaupat ── */
function GroupedResultCard({group,toggleFav,addList,favs,isPlus,goPlus,maxPrice}){
  const[expanded,setExpanded]=useState(false);
  const best=group[0];
  const others=group.slice(1);
  if(group.length===1)return <ResultCard item={best} rank={null} maxPrice={maxPrice} toggleFav={toggleFav} addList={addList} isFav={favs.some(f=>f.link===best.link)} isPlus={isPlus} goPlus={goPlus}/>;
  return(
    <div style={{marginBottom:10}}>
      <ResultCard item={best} rank={null} maxPrice={maxPrice} toggleFav={toggleFav} addList={addList} isFav={favs.some(f=>f.link===best.link)} isPlus={isPlus} goPlus={goPlus}/>
      <button onClick={()=>setExpanded(!expanded)}
        style={{width:"100%",background:S.rs,border:"none",borderRadius:"0 0 14px 14px",padding:"6px 0",fontSize:12,color:S.mut,cursor:"pointer",fontFamily:FF,marginTop:-4}}>
        {expanded?`▲ Piilota muut kaupat`:`▼ ${others.length} muuta kauppaa halvimmillaan ${eur(others[0]._total??others[0].price)}`}
      </button>
      {expanded&&others.map((item,i)=>(
        <div key={i} style={{borderLeft:"3px solid "+S.brd,marginLeft:8,paddingLeft:4}}>
          <ResultCard item={item} rank={null} maxPrice={maxPrice} toggleFav={toggleFav} addList={addList} isFav={favs.some(f=>f.link===item.link)} isPlus={isPlus} goPlus={goPlus}/>
        </div>
      ))}
    </div>
  );
}

function Results({data,loading,isPlus,goPlus,favs,toggleFav,addList,grouped=true}) {
  if(loading)return <Spinner/>;
  if(!data)return null;
  if(!data.ok)return <Err msg={data.error}/>;
  const items=(data.results||[]).filter(r=>isFinnish(r)&&hasUsableLink(r));
  if(items.length===0)return <p style={{color:S.mut,fontSize:13,marginTop:12}}>Ei tuloksia suomalaisista verkkokaupoista. Kokeile toista hakusanaa tai poista jokin suodatin.</p>;
  const maxP=items.reduce((m,x)=>x.price!=null&&x.price>m?x.price:m,0);
  const groups=grouped?groupProducts(items):items.map(i=>[i]);
  const uniqueStores=new Set(items.map(i=>i.store).filter(Boolean)).size;
  return(
    <div style={{marginTop:8}}>
      <p style={{fontSize:12,color:S.mut,marginBottom:8,fontFamily:FF}}>
        {groups.length} tuotetta · {items.length} tulosta · {uniqueStores} kauppaa
      </p>
      {groups.map((g,i)=><GroupedResultCard key={i} group={g} maxPrice={maxP} toggleFav={toggleFav} addList={addList} favs={favs} isPlus={isPlus} goPlus={goPlus}/>)}
    </div>
  );
}

/* ── Kategoriapuu ── */
const CAT_TREE=[
  {k:"meikit",i:"💄",l:"Meikit",s:"meikki kosmetiikka",groups:[
    {l:"Silmämeikit",items:[
      {k:"ripsivari",l:"Ripsivärit",s:"ripsivari mascara"},
      {k:"ripsipohjustus",l:"Ripsien pohjustajat",s:"ripsipohjustus mascara primer"},
      {k:"ripsiseerumi",l:"Ripsi- ja kulmaseerumit",s:"ripsiseerumi lash serum brow serum"},
      {k:"luomivarit",l:"Luomivärit",s:"luomiväri eyeshadow"},
      {k:"luomipaletti",l:"Luomiväripaletit",s:"luomiväripaletti eyeshadow palette"},
      {k:"eyeliner",l:"Eyelinerit",s:"eyeliner silmärajaus"},
      {k:"kajaali",l:"Kajaalit",s:"kajaali kohl"},
      {k:"muu-silmarajaus",l:"Muut silmien rajaukseen",s:"silmämeikki rajaus"},
      {k:"kulmakynat",l:"Kulmakynät",s:"kulmakynä eyebrow pencil"},
      {k:"kulmageelit",l:"Kulmageelit",s:"kulmaGeelie brow gel"},
      {k:"kulmakolorit",l:"Kulmavärit",s:"kulmaväri eyebrow colour"},
      {k:"muu-kulma",l:"Muut kulmameikit",s:"kulmameikki pomade brow"},
      {k:"tekoripset",l:"Tekoripset",s:"tekoripset false lashes"},
      {k:"ripsitupsut",l:"Ripsitupsut",s:"ripsitupsut individual lashes"},
      {k:"ripsiliimat",l:"Ripsiliimat",s:"ripsiliima lash glue"},
      {k:"muu-silma",l:"Muut silmämeikit",s:"silmämeikki"},
    ]},
    {l:"Huulimeikit",items:[
      {k:"huulipunat",l:"Huulipunat",s:"huulipuna lipstick"},
      {k:"huulikiillot",l:"Huulikiillot",s:"huulikiilto lip gloss"},
      {k:"huulirajaus",l:"Huultenrajauskynät",s:"huulikynä lip liner"},
      {k:"huulioljyt",l:"Huuliöljyt",s:"huuliöljy lip oil"},
      {k:"huulipohjustus",l:"Huulten pohjustustuotteet",s:"huulipohja lip primer"},
      {k:"huulivoiteet",l:"Huulivoiteet ja -balmit",s:"huulivoide lip balm"},
      {k:"muu-huuli",l:"Muut huulimeikit",s:"huulihoito"},
    ]},
    {l:"Kasvomeikit",items:[
      {k:"meikkivoide",l:"Meikkivoiteet",s:"meikkivoide foundation"},
      {k:"bb-voide",l:"BB-voiteet",s:"BB-voide BB cream"},
      {k:"cc-voide",l:"CC-voiteet",s:"CC-voide CC cream"},
      {k:"savyttava-paivavoide",l:"Sävyttävät päivävoiteet",s:"sävyttävä päivävoide tinted moisturizer"},
      {k:"peiteaine",l:"Peitevoiteet",s:"peitevoide concealer"},
      {k:"puuterit",l:"Puuterit",s:"meikkipuuteri pressed powder"},
      {k:"irtopuuteri",l:"Irtopuuterit",s:"irtopuuteri loose powder"},
      {k:"meikkipohja",l:"Meikinpohjustustuotteet",s:"meikkipohja primer"},
      {k:"meikinkiinnitys",l:"Meikinkiinnitystuotteet",s:"meikinkiinnitys setting spray"},
      {k:"poskipuna",l:"Poskipunat",s:"poskipuna blush"},
      {k:"aurinkopuuteri",l:"Aurinkopuuterit",s:"aurinkopuuteri bronzer"},
      {k:"korostus",l:"Korostustuotteet",s:"korostustuote highlighter"},
      {k:"varjostus",l:"Varjostustuotteet",s:"varjostustuote contour"},
      {k:"monikaytt-kasvo",l:"Monikäyttöiset kasvomeikit",s:"monikäyttömeikki blush bronzer"},
      {k:"muu-kasvo",l:"Muut kasvomeikit",s:"kasvomeikki"},
    ]},
    {l:"Kynsimeikit ja kynsienhoito",items:[
      {k:"kynsilakka",l:"Kynsilakat",s:"kynsilakka nail polish"},
      {k:"geelilakka",l:"Geelilakat",s:"geelilakka gel nail polish"},
      {k:"uv-geeli",l:"UV-geelilakat ja -tarvikkeet",s:"UV-geeli gel nail"},
      {k:"kynsilakkapoisto",l:"Kynsilakanpoistoaineet",s:"kynsilakanpoistoaine aseton"},
      {k:"tekokynnet",l:"Tekokynnet",s:"tekokynnet press-on nails"},
      {k:"kynsitarrat",l:"Kynsitarrat ja -koristeet",s:"kynsitarrat nail art stickers"},
      {k:"kynsihoito",l:"Kynsienhoitotuotteet",s:"kynsihoito base coat top coat"},
      {k:"kynsioljy",l:"Kynsiöljyt",s:"kynsiöljy cuticle oil"},
      {k:"kynsiviila",l:"Kynsiviilat",s:"kynsiviila nail file"},
      {k:"kynsisakset",l:"Kynsisakset ja -leikkurit",s:"kynsisakset kynsileikkuri"},
      {k:"kynsikiillotus",l:"Kynsien kiillotusvälineet",s:"kynsi kiillotus buffer"},
      {k:"muu-kynsi",l:"Muut kynsituotteet",s:"kynsituote"},
    ]},
    {l:"Meikkipussit ja toilettilaukut",items:[
      {k:"meikkipussi",l:"Meikkipussit",s:"meikkipussi"},
      {k:"meikkilaukku",l:"Meikkilaukut",s:"meikkilaukku makeup bag"},
      {k:"toilettilaukku",l:"Toilettilaukut",s:"toilettilaukku toiletry bag"},
      {k:"kosmetiikkalaukku",l:"Kosmetiikkalaukut",s:"kosmetiikkalaukku beauty case"},
      {k:"matkakosm-laukku",l:"Matkakosmetiikkalaukut",s:"matkakosmetiikkalaukku travel bag"},
      {k:"muu-kosm-laukku",l:"Muut kosmetiikan säilytyslaukut",s:"kosmetiikan säilytys organizer"},
    ]},
    {l:"Meikkisiveltimet ja -välineet",items:[
      {k:"meikkisivelin",l:"Meikkisiveltimet",s:"meikkisivelin makeup brush"},
      {k:"sivellinsetti",l:"Meikkisivellinsetit",s:"meikkisivelinsetti brush set"},
      {k:"voide-sivelin",l:"Meikkivoidesiveltimet",s:"meikkivoidesivelin foundation brush"},
      {k:"puuteri-sivelin",l:"Puuterisiveltimet",s:"puuterisivelin powder brush"},
      {k:"poskipuna-sivelin",l:"Poskipunasiveltimet",s:"poskipunasivelin blush brush"},
      {k:"aurinkopuuteri-sivelin",l:"Aurinkopuuterisiveltimet",s:"aurinkopuuterisivelin bronzer brush"},
      {k:"luomi-sivelin",l:"Luomivärisiveltimet",s:"luomivärisivellin eyeshadow brush"},
      {k:"rajaus-sivelin",l:"Rajaus- ja eyeliner-siveltimet",s:"eyeliner brush rajaussivelin"},
      {k:"kulma-sivelin",l:"Kulmasiveltimet",s:"kulmasivelin brow brush"},
      {k:"meikkisieni",l:"Meikkisienet",s:"meikkisieni beauty blender sponge"},
      {k:"meikkivippa",l:"Meikkivipat",s:"meikkivippa powder puff"},
      {k:"puuterivippa",l:"Puuterivipat",s:"puuterivippa"},
      {k:"meikkipeili",l:"Meikkipeilit",s:"meikkipeili suurennuspeili"},
      {k:"ripsentaivutin",l:"Ripsentaivuttimet",s:"ripsentaivutin eyelash curler"},
      {k:"kulmavalinen",l:"Kulmavälineet",s:"kulmaväline brow tool"},
      {k:"pinsetit",l:"Pinsetit",s:"pinsetit tweezers"},
      {k:"muu-meikkaustarvike",l:"Muut meikkausvälineet",s:"meikkaustarvike"},
    ]},
  ]},
  {k:"ihonhoito",i:"🧖",l:"Ihonhoito",s:"ihonhoito kasvotuotteet",groups:[
    {l:"Kasvojenhoito",items:[
      {k:"kasvovoide",l:"Kasvovoiteet",s:"kasvovoide moisturizer"},
      {k:"paivavoide",l:"Päivävoiteet",s:"päivävoide SPF kasvot"},
      {k:"yovoide",l:"Yövoiteet",s:"yövoide night cream"},
      {k:"kasvoseerumi",l:"Seerumit",s:"kasvoseerumi serum"},
      {k:"kasvooljy",l:"Kasvoöljyt",s:"kasvoöljy facial oil"},
      {k:"kasvovesi",l:"Kasvovedet ja tonerit",s:"kasvovesi toner essence"},
      {k:"kasvonaamio",l:"Kasvonaamiot",s:"kasvonaamio face mask"},
      {k:"kasvokuorinta",l:"Kasvokuorinnat",s:"kasvokuorinta peeling exfoliant"},
      {k:"kasvojenpesu",l:"Kasvojen puhdistustuotteet",s:"kasvojenpesu cleanser misellivesi"},
    ]},
    {l:"Silmänympäryshoito",items:[
      {k:"silmanymparys",l:"Silmänympärysvoiteet",s:"silmänympärysvoide eye cream"},
      {k:"silmaseerumi",l:"Silmäseerumit",s:"silmäseerumi eye serum"},
      {k:"silmanaamio",l:"Silmälaput ja -naamiot",s:"silmälappu eye patch"},
    ]},
    {l:"Erityisihonhoito",items:[
      {k:"retinol",l:"Retinol-tuotteet",s:"retinol kasvot"},
      {k:"vitamiini-c",l:"Vitamiini C -seerumit",s:"vitamiini C seerumi"},
      {k:"hyaluronihappo",l:"Hyaluronihappo",s:"hyaluronihappo seerumi"},
      {k:"niasiiniamidi",l:"Niasiiniamidi",s:"niasiiniamidi kasvot"},
      {k:"happohoito",l:"Happohoidot",s:"AHA BHA happohoito"},
    ]},
    {l:"Aurinkosuoja ja rusketus",items:[
      {k:"aurinkosuoja-kasvot",l:"Kasvojen aurinkosuoja",s:"aurinkosuoja kasvot SPF"},
      {k:"aurinkosuoja-vartalo",l:"Vartalon aurinkosuoja",s:"aurinkosuoja vartalo SPF"},
      {k:"aftersun",l:"Jälkiaurinkohoito",s:"after sun jälkiaurinkohoito"},
      {k:"itseruskettava",l:"Itseruskettavat",s:"itseruskettava self tanner"},
    ]},
    {l:"Vartalonhoito",items:[
      {k:"vartalovoide",l:"Vartalovoiteet",s:"vartalovoide body lotion"},
      {k:"vartalooljy",l:"Vartaloöljyt",s:"vartaloöljy body oil"},
      {k:"vartalokuorinta",l:"Vartalokuorinnat",s:"vartalokuorinta body scrub"},
      {k:"kasivoide",l:"Käsivoiteet",s:"käsivoide hand cream"},
      {k:"jalkavoide",l:"Jalkavoiteet",s:"jalkavoide foot cream"},
      {k:"kiinteyttava",l:"Kiinteyttävät vartalotuotteet",s:"kiinteyttävä vartalotuote firming"},
      {k:"raskausajan-hoito",l:"Raskausajan hoitotuotteet",s:"raskausarvet vartalovoide"},
    ]},
  ]},
  {k:"hiukset",i:"💇",l:"Hiukset",s:"hiustuotteet hiukset",groups:[
    {l:"Hiustenhoito",items:[
      {k:"shampoo",l:"Shampoot",s:"shampoo hiukset"},
      {k:"hoitoaine",l:"Hoitoaineet ja palsami",s:"hiusten hoitoaine palsami conditioner"},
      {k:"hiusnaamio",l:"Hiusnaamiot",s:"hiusnaamio hair mask"},
      {k:"hiustehohoito",l:"Tehohoidot",s:"hiusten tehohoito seerumi"},
      {k:"hiusoljy",l:"Hiusöljyt",s:"hiusöljy argan hair oil"},
      {k:"hiusseerumi",l:"Hiusseerumit",s:"hiusseerumi hair serum"},
      {k:"hiusvesi",l:"Hiusvedet",s:"hiusvesi leave-in"},
      {k:"hiuskuorinta",l:"Hiuskuorinnat",s:"hiusten kuorinta scalp scrub"},
      {k:"hiustenlahtoon",l:"Hiustenlähtöön",s:"hiustenlähtö kasvua edistävä"},
    ]},
    {l:"Hiustenmuotoilu",items:[
      {k:"muotoilugeeli",l:"Muotoilugeelit",s:"hiusten muotoilugeeli"},
      {k:"hiusvaha",l:"Hiusvahat ja -pastat",s:"hiusvaha muotoilupasta wax"},
      {k:"hiuslakka",l:"Hiuslakat",s:"hiuslakka hair spray"},
      {k:"lamposuoja",l:"Lämpösuojat",s:"lämpösuojasuihke heat protect"},
      {k:"muotovaahto",l:"Muotovaahto",s:"muotovaahto hair mousse"},
      {k:"suolasuihke",l:"Suola- ja tekstuurisuihkeet",s:"suolasuihke tekstuurisuihke"},
      {k:"kiiltotuote",l:"Kiiltotuotteet",s:"kiiltosuihke hiukset"},
    ]},
    {l:"Hiusten värjäys",items:[
      {k:"hiusvari",l:"Hiusvärit",s:"hiusväri kotivärjäys"},
      {k:"savyteshampoo",l:"Sävyteshampoot ja -hoitoaineet",s:"sävyteshampoo colour shampoo"},
      {k:"vaalennustuote",l:"Vaalennustuotteet",s:"hiusten vaalentaminen"},
      {k:"tyvenvari",l:"Tyvikasvun peitto",s:"tyvikasvun peitto root touch-up"},
    ]},
    {l:"Hiusten työkalut",items:[
      {k:"hiustenkuivaaja",l:"Hiustenkuivaajat",s:"hiustenkuivaaja hair dryer"},
      {k:"suoristusrauta",l:"Suoristusraudat",s:"suoristusrauta straightener"},
      {k:"kiharrin",l:"Kihartimet",s:"kiharrin curling iron"},
      {k:"ilmakiharrin",l:"Ilmakihartimet",s:"ilmakiharrin airwrap"},
      {k:"hiusharja",l:"Hiusharjat ja kammat",s:"hiusharja kamma"},
    ]},
    {l:"Hiusasusteet",items:[
      {k:"hiuslenkki",l:"Hiuslenkit ja scrunchiet",s:"hiuslenkki scrunchie"},
      {k:"hiussolki",l:"Hiussoljet ja -pinnit",s:"hiussolki clip pinna"},
      {k:"panta",l:"Pannat",s:"hiuspanta headband"},
    ]},
  ]},
  {k:"parranhoito",i:"🧔",l:"Parranhoito",s:"parranhoito parta parranajo",groups:[
    {l:"Partahoidon tuotteet",items:[
      {k:"partavaahto",l:"Partavaahto ja -geelit",s:"partavaahto parranajogeeli"},
      {k:"partaoljy",l:"Partaöljyt",s:"partaöljy beard oil"},
      {k:"partabalsami",l:"Partabalsami ja -vaha",s:"partabalsami partavaha beard balm"},
      {k:"aftershave",l:"Aftershave-tuotteet",s:"aftershave balm lotion"},
      {k:"partavoide",l:"Partavoiteet ja -seerumit",s:"parran kosteuttaja beard moisturizer"},
    ]},
    {l:"Parranajo",items:[
      {k:"parranajokone",l:"Parranajokone",s:"parranajokone electric shaver"},
      {k:"trimmeri",l:"Trimmerit",s:"trimmeri beard trimmer"},
      {k:"partaveitsi",l:"Partaveitset ja partaterät",s:"partaveitsi safety razor partaterä"},
    ]},
    {l:"Parran muotoilu",items:[
      {k:"partaharja",l:"Partaharjat",s:"partaharja shaving brush"},
      {k:"partapomade",l:"Parran muotoilutuotteet",s:"parran muotoilu beard wax"},
    ]},
  ]},
  {k:"hygienia",i:"🛁",l:"Hygienia",s:"hygieniatuotteet peseytyminen",groups:[
    {l:"Peseytyminen",items:[
      {k:"suihkugeeli",l:"Suihkugeelit ja -vaahdot",s:"suihkugeeli shower gel"},
      {k:"saippua",l:"Saippuat ja pesugeelit",s:"saippua body wash"},
      {k:"kasipesugeli",l:"Käsisaippuat ja -geelit",s:"käsisaippua hand soap"},
      {k:"kylpytuotteet",l:"Kylpyöljyt ja -suolat",s:"kylpyöljy kylpysuola bath"},
    ]},
    {l:"Deodorantit",items:[
      {k:"deodorantti",l:"Deodorantit",s:"deodorantti antiperspirantti"},
      {k:"luonnon-deo",l:"Luonnonmukaiset deodorantit",s:"luonnonmukainen deodorantti natural"},
    ]},
    {l:"Hammashygienia",items:[
      {k:"hammastahna",l:"Hammastahnat",s:"hammastahna toothpaste"},
      {k:"hammasharja",l:"Hammasharjat",s:"sähköhammasharja hammasharja"},
      {k:"suuvesi",l:"Suuvedet",s:"suuvesi mouthwash"},
      {k:"hammasvalipuhdistus",l:"Hammasvälien puhdistus",s:"hammasväli floss hammaslanka"},
      {k:"hammasvalkaisu",l:"Hampaidenvalkaisu",s:"hampaidenvalkaisu whitening"},
    ]},
    {l:"Karvanpoisto",items:[
      {k:"karvanpoisto",l:"Karvanpoistotuotteet",s:"karvanpoisto wax strips"},
      {k:"epilaattori",l:"Epilaattorit",s:"epilaattori"},
    ]},
    {l:"Kuukautishygienia",items:[
      {k:"tamponi",l:"Tamponit",s:"tamponi"},
      {k:"terveysside",l:"Terveyssiteet",s:"terveysside"},
      {k:"pikkuhousunsuoja",l:"Pikkuhousunsuojat",s:"pikkuhousunsuoja"},
      {k:"kuukautiskuppi",l:"Kuukautiskupit",s:"kuukautiskuppi menstrual cup"},
      {k:"kuukautisalushousut",l:"Kuukautisalushousut",s:"kuukautisalushousut period underwear"},
    ]},
    {l:"Muut hygieniatuotteet",items:[
      {k:"intiimihygienia",l:"Intiimihygienia",s:"intiimihygienia intimate wash"},
      {k:"jalkojenhoito",l:"Jalkojenhoito",s:"jalkojenhoito jalkakylpy"},
      {k:"puhdistuspyyhe",l:"Kosteuspyyhkeet",s:"kosteuspyyhe puhdistuspyyhe"},
    ]},
  ]},
  {k:"tuoksut",i:"🌸",l:"Tuoksut",s:"hajuvesi tuoksu parfyymi",groups:[
    {l:"Hajuvedet",items:[
      {k:"edp",l:"Eau de Parfum",s:"eau de parfum hajuvesi"},
      {k:"edt",l:"Eau de Toilette",s:"eau de toilette"},
      {k:"edc",l:"Eau de Cologne",s:"eau de cologne"},
      {k:"body-mist",l:"Body mistit ja tuoksusuihkeet",s:"body mist tuoksusuihke"},
      {k:"hiustuoksu",l:"Hiustuoksut",s:"hiustuoksu hair perfume"},
    ]},
    {l:"Erikoistuoksut",items:[
      {k:"unisex-hv",l:"Unisex-hajuvedet",s:"unisex hajuvesi"},
      {k:"niche",l:"Niche-hajuvedet",s:"niche parfyymi"},
      {k:"tuoksusetti",l:"Tuoksusetit ja lahjasettit",s:"tuoksusetti hajuvesisetti"},
    ]},
    {l:"Kodin tuoksut",items:[
      {k:"tuoksukyntila",l:"Tuoksukynttilät",s:"tuoksukynttilä scented candle"},
      {k:"diffuusori",l:"Tuoksudiffuuserit",s:"tuoksudiffuusori reed diffuser"},
      {k:"huonetuoksu",l:"Huonetuoksusuihkeet",s:"huonetuoksusuihke room spray"},
    ]},
  ]},
  {k:"vaatteet",i:"👗",l:"Vaatteet",s:"vaatteet muoti",groups:[
    {l:"Yläosat",items:[
      {k:"paidat",l:"Paidat ja puserot",s:"paita pusero"},
      {k:"t-paidat",l:"T-paidat",s:"t-paita"},
      {k:"topit",l:"Topit ja bodyt",s:"toppi body"},
      {k:"neuleet",l:"Neuleet",s:"neule knitwear"},
      {k:"hupparit",l:"Hupparit ja collegepaidat",s:"huppari college sweatshirt"},
      {k:"liivit",l:"Liivit",s:"liivi vest"},
    ]},
    {l:"Alaosat",items:[
      {k:"mekot",l:"Mekot",s:"mekko dress"},
      {k:"hameet",l:"Hameet",s:"hame skirt"},
      {k:"farkut",l:"Farkut",s:"farkut jeans"},
      {k:"housut",l:"Housut",s:"housut trousers"},
      {k:"leggingsit",l:"Leggingsit ja trikoot",s:"leggings trikoot"},
      {k:"shortsit",l:"Shortsit",s:"shortsit"},
      {k:"jumpsuitit",l:"Jumpsuitit ja haalarit",s:"jumpsuit haalari"},
    ]},
    {l:"Päällysvaatteet",items:[
      {k:"takit",l:"Takit",s:"takki coat"},
      {k:"bleiserit",l:"Bleiserit ja jakut",s:"bleiseri jakku blazer"},
      {k:"puffer-takit",l:"Puffer-takit",s:"toppatakki puffer"},
      {k:"trenssit",l:"Trenssitakit",s:"trenssi trench coat"},
      {k:"nahkatakit",l:"Nahkatakit",s:"nahkatakki leather jacket"},
    ]},
    {l:"Alusvaatteet ja yöasut",items:[
      {k:"alusvaatteet",l:"Alusvaatteet",s:"alusvaatteet underwear"},
      {k:"rintaliivit",l:"Rintaliivit",s:"rintaliivi bra"},
      {k:"yoasut",l:"Yöasut ja pyjama",s:"yöasu pyjama"},
      {k:"uima-asut",l:"Uima-asut ja bikinit",s:"uima-asu bikini"},
    ]},
    {l:"Urheiluvaatteet",items:[
      {k:"treenivaatteet",l:"Treenivaatteet",s:"treenivaate gym"},
      {k:"urheiluleggings",l:"Urheiluleggingsit",s:"urheiluleggings sport leggings"},
      {k:"urheilupaidat",l:"Urheilupaidat",s:"urheilupaita sport"},
      {k:"juoksuvaatteet",l:"Juoksuvaatteet",s:"juoksuvaate running"},
      {k:"yoga",l:"Yoga- ja pilatesvaatteet",s:"yoga pilates vaate"},
    ]},
  ]},
  {k:"kengat",i:"👟",l:"Kengät",s:"kengät jalkineet",groups:[
    {l:"Vapaa-ajan kengät",items:[
      {k:"tennarit",l:"Tennarit ja sneakerit",s:"tennarit sneakers"},
      {k:"loaferit",l:"Loaferit",s:"loaferit loafers"},
      {k:"balleriinat",l:"Balleriinat",s:"balerinakengät flats"},
      {k:"espadrillit",l:"Espadrillit",s:"espadrillit"},
      {k:"sandaalit",l:"Sandaalit",s:"sandaalit sandals"},
    ]},
    {l:"Juhlakengät",items:[
      {k:"korolliset",l:"Korolliset kengät",s:"korolliset kengät heels"},
      {k:"avokkaat",l:"Avokkaat",s:"avokkaat pumps"},
      {k:"oxford",l:"Oxford- ja Derby-kengät",s:"oxford derby"},
    ]},
    {l:"Saappaat",items:[
      {k:"saappaat",l:"Saappaat",s:"saappaat boots"},
      {k:"nilkkurit",l:"Nilkkurit",s:"nilkkurit ankle boots"},
      {k:"kumisaappaat",l:"Kumisaappaat",s:"kumisaappaat rain boots"},
      {k:"talvikengat",l:"Talvikengät",s:"talvikengät winter boots"},
    ]},
    {l:"Urheilukengät",items:[
      {k:"juoksukengat",l:"Juoksukengät",s:"juoksukengät running"},
      {k:"treeni-kengat",l:"Treeni- ja salokengät",s:"treeni sali kengät"},
      {k:"ulkoilukengat",l:"Vaellus- ja ulkoilukengät",s:"vaelluskengät outdoor"},
      {k:"tenniskengat",l:"Tenniskengät",s:"tenniskengät"},
    ]},
    {l:"Kotikengät",items:[
      {k:"tohvelit",l:"Tohvelit ja lestit",s:"tohvelit slippers"},
    ]},
  ]},
  {k:"laukut",i:"👜",l:"Laukut",s:"laukku käsilaukku",groups:[
    {l:"Käsilaukut",items:[
      {k:"kasilaukku",l:"Käsilaukut",s:"käsilaukku handbag"},
      {k:"olkalaukku",l:"Olkalaukut",s:"olkalaukku shoulder bag"},
      {k:"crossbody",l:"Crossbody-laukut",s:"crossbody laukku"},
      {k:"tote",l:"Tote-laukut",s:"tote bag"},
      {k:"clutch",l:"Clutch ja juhlapussit",s:"clutch juhlapussi"},
      {k:"minilaukku",l:"Minilaukut",s:"minilaukku mini bag"},
    ]},
    {l:"Reput ja muut",items:[
      {k:"reppu",l:"Reput",s:"reppu backpack"},
      {k:"vyolaukku",l:"Vyölaukut",s:"vyölaukku fanny pack"},
      {k:"weekender",l:"Weekender-laukut",s:"weekender matkakassi"},
    ]},
    {l:"Pienet nahkatavarat",items:[
      {k:"lompakko",l:"Lompakot",s:"lompakko wallet"},
      {k:"korttikotelo",l:"Korttikotelo",s:"korttikotelo card holder"},
    ]},
  ]},
  {k:"korut",i:"💎",l:"Korut",s:"korut koru",groups:[
    {l:"Korutyypit",items:[
      {k:"kaulakorut",l:"Kaulakorut",s:"kaulakoru necklace"},
      {k:"korvakorut",l:"Korvakorut",s:"korvakorut earrings"},
      {k:"rannekorut",l:"Rannekorut",s:"rannekoru bracelet"},
      {k:"sormukset",l:"Sormukset",s:"sormus ring"},
      {k:"riipukset",l:"Riipukset",s:"riipus pendant"},
      {k:"nilkkakorut",l:"Nilkkakorut",s:"nilkkakoru ankle bracelet"},
      {k:"lavistyskorut",l:"Lävistyskorut",s:"lävistyskorut piercing"},
    ]},
    {l:"Korusetit ja materiaalit",items:[
      {k:"korusetit",l:"Korusetit",s:"korusetti jewelry set"},
      {k:"hopeakorut",l:"Hopeasorut",s:"hopeasorut sterling silver"},
      {k:"kultakorut",l:"Kultakorut",s:"kultakorut gold"},
      {k:"teraskorut",l:"Ruostumattomasta teräksestä",s:"teräskoru stainless steel"},
      {k:"muotikorut",l:"Muotikorut",s:"muotikorut fashion jewelry"},
    ]},
  ]},
  {k:"kellot",i:"⌚",l:"Kellot",s:"rannekello muotikello",groups:[
    {l:"Kellot",items:[
      {k:"korukello",l:"Korukellot",s:"korukello fashion watch"},
      {k:"unisex-kello",l:"Unisex-kellot",s:"unisex rannekello"},
    ]},
  ]},
  {k:"asusteet",i:"🕶️",l:"Asusteet",s:"asusteet accessories",groups:[
    {l:"Päähineet",items:[
      {k:"hatut",l:"Hatut",s:"hattu bucket hat"},
      {k:"pipot",l:"Pipot ja beaniet",s:"pipo beanie"},
      {k:"lippikset",l:"Lippikset",s:"lippis baseball cap"},
      {k:"baskeri",l:"Baskerihatut",s:"baskeri beret"},
      {k:"olkihattu",l:"Olkihatut",s:"olkihattu straw hat"},
    ]},
    {l:"Kaulaliinat ja huivit",items:[
      {k:"huivit",l:"Huivit",s:"huivi scarf"},
      {k:"kaulaliinat",l:"Kaulaliinat",s:"kaulahuivi neckerchief"},
      {k:"bandanat",l:"Bandanat",s:"bandana"},
    ]},
    {l:"Käsineet",items:[
      {k:"hanskat",l:"Käsineet",s:"käsineet hanskat gloves"},
      {k:"nahkahanskat",l:"Nahkahanskat",s:"nahkahanskat leather gloves"},
    ]},
    {l:"Muut asusteet",items:[
      {k:"vyot",l:"Vyöt",s:"vyö belt"},
      {k:"aurinkolasit",l:"Aurinkolasit",s:"aurinkolasit sunglasses"},
      {k:"sateenvarjot",l:"Sateenvarjot",s:"sateenvarjo"},
      {k:"sukat-muoti",l:"Muotisukat",s:"sukat muoti fashion socks"},
      {k:"rintaneulaset",l:"Rintaneulaset",s:"rintaneula solki brooch"},
    ]},
  ]},
];

// Helper: find a leaf sub item by key across the whole tree
const findSubByKey=k=>CAT_TREE.flatMap(c=>c.groups).flatMap(g=>g.items).find(s=>s.k===k)||null;

/* ── SCREENS ── */

/* KOTI */
function ScreenKoti({go,listN,favN,spent,budget,savings,potentialSavings,goPlus,alertBudget,profileRecs,behavior,onRecomm}) {
  const recItems=profileRecs?.length>0?profileRecs:(behavior?.lastResults||[]);
  return(
    <div>
      <style>{`
        @keyframes aiShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .ai-koti-btn{background:linear-gradient(135deg,#FF8C42,#FFAF6B,#FFD580,#FFAF6B,#FF8C42)!important;background-size:300% 300%!important;animation:aiShimmer 4s ease infinite!important;box-shadow:0 2px 12px rgba(255,140,66,0.35)!important;}
        @keyframes goldShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .plus-price-btn{background:linear-gradient(135deg,#C8960A,#FFD700,#FFBA08,#FFD700,#C8960A)!important;background-size:300% 300%!important;animation:goldShimmer 2.5s ease infinite!important;color:#3A2000!important;border:none!important;border-radius:14px!important;padding:6px 14px!important;cursor:pointer!important;font-weight:400!important;font-size:12px!important;box-shadow:0 2px 12px rgba(200,150,10,0.5)!important;font-family:inherit!important;}
      `}</style>
      <h1 style={{fontSize:"clamp(15px,4.5vw,20px)",fontWeight:700,color:S.ink,lineHeight:1.25,margin:"0 0 6px",wordBreak:"keep-all",overflowWrap:"break-word"}}>Osta fiksummin. Säästä enemmän.</h1>
      <p style={{fontSize:"clamp(12px,3.5vw,14px)",fontWeight:600,color:S.mut,marginBottom:16,lineHeight:1.5,overflowWrap:"break-word"}}>Shoppailu PLUS vertailee hinnat sisältäen toimituskulut ja löytää parhaat alennukset sekä alennuskoodit automaattisesti puolestasi.</p>

      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <button onClick={()=>go("haku")} style={{flex:1,...card(S.ink,S.ink),cursor:"pointer",border:"none"}}><div style={{fontSize:18}}>🔍</div><div style={{color:S.wh,fontWeight:600,fontSize:14,marginTop:6}}>Hae tuote</div><div style={{color:"#C9BAC4",fontSize:11.5}}>Nimi tai brändi</div></button>
        <button onClick={()=>go("skannaa")} style={{flex:1,...card(S.rose,S.rose),cursor:"pointer",border:"none"}}><div style={{fontSize:18}}>📷</div><div style={{color:S.wh,fontWeight:600,fontSize:14,marginTop:6}}>Skannaa</div><div style={{color:S.rs,fontSize:11.5}}>Linkki</div></button>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <button onClick={()=>go("ostoslista")} style={{flex:1,...card(),cursor:"pointer"}}><span style={{fontSize:16}}>📋</span><div style={{fontWeight:600,fontSize:13,color:S.ink}}>Ostoslista</div><div style={{fontSize:11,color:S.mut}}>{listN} tuotetta</div></button>
        <button onClick={()=>go("suosikit")} style={{flex:1,...card(),cursor:"pointer"}}><span style={{fontSize:16}}>❤️</span><div style={{fontWeight:600,fontSize:13,color:S.ink}}>Suosikit</div><div style={{fontSize:11,color:S.mut}}>{favN} tuotetta</div></button>
      </div>

      {/* AI-suunnittelija — oranssi kimallusefekti */}
      <button className="ai-koti-btn" onClick={()=>go("ai")} style={{width:"100%",border:"none",borderRadius:16,padding:"10px 14px",marginBottom:10,cursor:"pointer",textAlign:"left",fontFamily:FF}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>✨</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13,color:"#3A1800"}}>AI-suunnittelija</div>
            <div style={{fontSize:11,color:"rgba(58,24,0,0.7)",marginTop:1}}>Ainesosahaku, vertailu, asun etsiminen — live-datalla</div>
          </div>
          <span style={{background:"rgba(58,24,0,0.12)",color:"#3A1800",borderRadius:20,padding:"3px 9px",fontWeight:700,fontSize:10,fontFamily:FF}}>PLUS+</span>
        </div>
      </button>

      {/* Toteutunut säästö — kultainen kortti */}
      <div style={{background:"#FFF8DC",borderRadius:18,padding:"14px 16px",marginBottom:10}}>
        <div style={{fontSize:11.5,fontWeight:700,color:"#7A6000",marginBottom:4}}>📈 Toteutunut säästö</div>
        <div style={{fontSize:34,fontWeight:500,color:S.ink,letterSpacing:"-0.5px",lineHeight:1.1}}>{eur(savings)}</div>
        {potentialSavings>0&&<div style={{fontSize:12,color:"#5A4A00",marginTop:5}}>Mahdollinen säästö ostoslistaltasi: <strong>{eur(potentialSavings)}</strong></div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
          <button onClick={()=>go("saastot")} style={{fontSize:11.5,color:"#7A6000",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:FF,fontWeight:600}}>Katso historia →</button>
          <button className="plus-price-btn" onClick={goPlus}>{PLUS_PRICE}</button>
        </div>
      </div>

      {/* Kuukausibudjetti */}
      <div style={{...card(),cursor:"pointer"}} onClick={()=>go("saastot")}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span>💳</span><span style={{fontWeight:600,fontSize:13,color:S.ink}}>Kuukausibudjetti</span></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
          <span style={{fontSize:18,fontWeight:700,fontFamily:"monospace",color:spent>budget?S.rose:S.ink}}>{eur(spent)}</span>
          <span style={{fontSize:13,fontFamily:"monospace",color:S.mut}}>/ {eur(budget)}</span>
        </div>
        <div style={{width:"100%",height:8,borderRadius:4,background:S.brd,marginTop:8}}><div style={{height:8,borderRadius:4,background:spent>budget?S.rose:S.grn,width:budget>0?Math.min(100,(spent/budget)*100)+"%":"0%",transition:"width 0.4s"}}/></div>
        {spent>budget
          ?<p style={{fontSize:11,color:S.rose,marginTop:5,fontWeight:600}}>⚠️ Ylitetty {eur(spent-budget)}</p>
          :<p style={{fontSize:11,color:S.mut,marginTop:5}}>Jäljellä {eur(Math.max(0,budget-spent))}</p>
        }
        {alertBudget&&spent>budget&&<div style={{background:S.rs,borderRadius:10,padding:"7px 10px",marginTop:6,fontSize:11,color:S.rose,fontWeight:600}}>🔔 Kuukausibudjettisi on ylittynyt {eur(spent-budget)}</div>}
      </div>

      {/* Sinulle suositeltua — profiilipohjainen jos saatavilla */}
      {recItems.length>0&&(
        <div style={{marginTop:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:14,fontWeight:600,color:S.ink}}>✨ Sinulle suositeltua</span>
            <button onClick={()=>go("suositukset")} style={{background:"none",border:"none",color:S.rd,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FF}}>Näytä kaikki →</button>
          </div>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none"}}>
            {recItems.slice(0,5).map((item,i)=>(
              <button key={i} onClick={()=>onRecomm(item)} style={{flexShrink:0,width:120,background:S.wh,border:"1.5px solid "+S.brd,borderRadius:14,padding:10,cursor:"pointer",textAlign:"left",fontFamily:FF}}>
                {item.image&&<img src={item.image} alt="" style={{width:"100%",height:72,borderRadius:8,objectFit:"cover",background:S.rs,display:"block",marginBottom:6}} onError={e=>{e.target.style.display="none"}}/>}
                <div style={{fontSize:10.5,fontWeight:600,color:S.ink,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.title}</div>
                {item.store&&<div style={{fontSize:9.5,color:S.mut,marginTop:2}}>{item.store}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* HAKU */
function ScreenHaku({isPlus,freeLeft,useFree,favs,toggleFav,addList,goPlus,recommItem,onClearRecomm,onTrackSearch}) {
  const[q,setQ]=useState("");
  const[catMain,setCatMain]=useState(null);
  const[catGroup,setCatGroup]=useState(null);
  const[catSub,setCatSub]=useState(null);
  const[catSearchTerm,setCatSearchTerm]=useState("");
  const[showAllGroups,setShowAllGroups]=useState(false);
  const[loading,setLoading]=useState(false);
  const[suggestions,setSuggestions]=useState(null);
  const[selected,setSelected]=useState(null);
  const[showConfirm,setShowConfirm]=useState(false);
  const[compareData,setCompareData]=useState(null);
  const[compareLoading,setCompareLoading]=useState(false);
  const[history,setHistory]=useState([]);
  const[brand,setBrand]=useState(null);
  // Autocomplete
  const[autoSugg,setAutoSugg]=useState([]);
  const[showAuto,setShowAuto]=useState(false);
  // Suodattimet
  const[fMin,setFMin]=useState("");
  const[fMax,setFMax]=useState("");
  const[fStores,setFStores]=useState([]);

  useEffect(()=>{
    if(recommItem){
      setSelected(recommItem);setShowConfirm(true);
      setSuggestions(null);setCompareData(null);
      if(onClearRecomm)onClearRecomm();
    }
  },[recommItem]);

  const currentCat=catMain?CAT_TREE.find(c=>c.k===catMain):null;
  const currentGroup=catGroup&&currentCat?currentCat.groups.find(g=>g.l===catGroup):null;

  const doSearch=async(fullQuery, searchOpts={})=>{
    const query=fullQuery.trim();if(!query)return;
    // Tarkista off-topic ENSIN — ei kuluta ilmaishakuja aiheen ulkopuolisille hauille
    if(isOffTopic(query)){
      setSuggestions({ok:false,error:"Tämä tuote ei kuulu sovelluksen tuotekategorioihin. Sovellus on tarkoitettu kauneus-, muoti- ja hygieniatuotteille."});
      return;
    }
    if(!isPlus&&freeLeft<=0){
      setSuggestions({ok:false,error:"__LIMIT__"});
      return;
    }
    if(!history.includes(query))setHistory(prev=>[query,...prev.filter(x=>x!==query)].slice(0,8));
    setSuggestions(null);setSelected(null);setCompareData(null);setShowConfirm(false);
    setLoading(true);
    const apiQuery=expandQuery(query);
    // Yhteinen hakumoottori: suodattaa kategorian, tuotemerkin ja laadun mukaan
    const d=await searchProducts(apiQuery, searchOpts);
    if(d.ok)useFree();
    setSuggestions(d);
    if(d.ok&&d.results){
      const first=d.results[0];
      if(first&&onTrackSearch)onTrackSearch(first);
    }
    setLoading(false);
  };

  const buildQuery=(overrideCatTerm,overrideBrand)=>{
    const b=overrideBrand!==undefined?overrideBrand:brand;
    const ct=overrideCatTerm!==undefined?overrideCatTerm:catSearchTerm;
    return [b,q.trim(),ct].filter(Boolean).join(" ");
  };

  const onSearch=()=>{
    doSearch(buildQuery()||q.trim(), {catMain, catSub, brand});
  };

  const selectMainCat=cat=>{
    setCatMain(cat.k);setCatGroup(null);setCatSub(null);setCatSearchTerm(cat.s);setShowAllGroups(false);setBrand(null);
    setSuggestions(null);setSelected(null);setCompareData(null);
  };

  const selectGroup=group=>{
    setCatGroup(group.l);setCatSub(null);
  };

  const selectSub=sub=>{
    setCatSub(sub.k);setCatSearchTerm(sub.s);
    doSearch(buildQuery(sub.s), {catMain, catSub:sub.k, brand});
  };

  const selectBrand=b=>{
    const nb=brand===b?null:b;
    setBrand(nb);
    doSearch(buildQuery(undefined,nb), {catMain, catSub, brand:nb});
  };

  const clearCat=()=>{
    setCatMain(null);setCatGroup(null);setCatSub(null);setCatSearchTerm("");setBrand(null);
    setSuggestions(null);setCompareData(null);setSelected(null);
  };
  const goBackGroup=()=>{setCatGroup(null);setCatSub(null);};
  const goBackMain=()=>{setCatMain(null);setCatGroup(null);setCatSub(null);setCatSearchTerm("");setBrand(null);setSuggestions(null);setCompareData(null);setSelected(null);};

  const selectProduct=(item)=>{setSelected(item);setShowConfirm(true);};

  const confirmCompare=async()=>{
    if(!isPlus&&freeLeft<=0){setShowConfirm(false);goPlus();return;}
    setShowConfirm(false);setCompareLoading(true);
    const d=await liveSearch(selected.title);
    if(d.ok)useFree();
    setCompareData(d);setCompareLoading(false);
  };

  const reset=()=>{setSuggestions(null);setSelected(null);setCompareData(null);setShowConfirm(false);setQ("");setBrand(null);setCatGroup(null);clearCat();setFMin("");setFMax("");setFStores([]);setAutoSugg([]);setShowAuto(false);};
  const onQChange=v=>{setQ(v);const s=getAutoSugg(v,history);setAutoSugg(s);setShowAuto(s.length>0&&v.length>=2);};
  const pickAutoSugg=s=>{setQ(s);setAutoSugg([]);setShowAuto(false);const full=[brand,s,catSearchTerm].filter(Boolean).join(" ");setTimeout(()=>doSearch(full||s,{catMain,catSub,brand}),0);};

  const visibleGroups=currentCat
    ?(showAllGroups?currentCat.groups:currentCat.groups.slice(0,2))
    :[];

  // Emoji-kuvakkeet ryhmille (käytetään kategoriahierarkiassa)
  const GROUP_ICONS={
    "Silmämeikit":"👁️","Huulimeikit":"💋","Kasvomeikit":"😊",
    "Kynsimeikit ja kynsienhoito":"💅","Meikkipussit ja toilettilaukut":"👜","Meikkisiveltimet ja -välineet":"🖌️",
    "Kasvojenhoito":"🌿","Silmänympäryshoito":"🔬","Erityisihonhoito":"✨","Aurinkosuoja ja rusketus":"☀️","Vartalonhoito":"💆",
    "Hiustenhoito":"🚿","Hiustenmuotoilu":"💨","Hiusten värjäys":"🎨","Hiusten työkalut":"⚡","Hiusasusteet":"🎀",
    "Partahoidon tuotteet":"🧴","Parranajo":"🪒","Parran muotoilu":"✂️",
    "Peseytyminen":"🛁","Deodorantit":"🌬️","Hammashygienia":"🦷","Karvanpoisto":"✨","Kuukautishygienia":"🌸","Muut hygieniatuotteet":"🧼",
    "Hajuvedet":"🌸","Erikoistuoksut":"💎","Kodin tuoksut":"🕯️",
    "Yläosat":"👚","Alaosat":"👖","Päällysvaatteet":"🧥","Alusvaatteet ja yöasut":"🩲","Urheiluvaatteet":"🏃",
    "Vapaa-ajan kengät":"👟","Juhlakengät":"👠","Saappaat":"🥾","Urheilukengät":"🏃","Kotikengät":"🏠",
    "Käsilaukut":"👜","Reput ja muut":"🎒","Pienet nahkatavarat":"💳",
    "Korutyypit":"💍","Korusetit ja materiaalit":"✨",
    "Kellot":"⌚",
    "Päähineet":"🎩","Kaulaliinat ja huivit":"🧣","Käsineet":"🧤","Muut asusteet":"🕶️",
  };

  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>🔍 Hae tuote</h2>

      {!compareData&&<>
        {/* Hakukenttä + autocomplete */}
        <div style={{position:"relative",marginBottom:12}}>
          <div style={{display:"flex",gap:8}}>
            <input value={q} onChange={e=>onQChange(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){setShowAuto(false);onSearch();}if(e.key==="Escape")setShowAuto(false);}}
              onFocus={()=>{if(autoSugg.length>0)setShowAuto(true);}}
              onBlur={()=>setTimeout(()=>setShowAuto(false),150)}
              placeholder={currentCat?`${currentCat.i} ${currentCat.l} – tarkenna hakua...`:"Kirjoita tuote tai valitse kategoria"}
              style={inp}/>
            <button onClick={()=>{setShowAuto(false);onSearch();}} disabled={loading} style={btn(loading?S.brd:S.rose)}>
              {loading?"⏳":"Hae"}
            </button>
          </div>
          {showAuto&&autoSugg.length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:56,zIndex:100,background:S.wh,border:"1.5px solid "+S.brd,borderRadius:12,marginTop:4,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",overflow:"hidden"}}>
              {autoSugg.map((s,i)=>(
                <button key={i} onMouseDown={()=>pickAutoSugg(s)}
                  style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",fontSize:13,color:S.ink,background:"none",border:"none",borderBottom:i<autoSugg.length-1?"1px solid "+S.brd:"none",cursor:"pointer",fontFamily:FF}}>
                  🔍 {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pääkategoriat — vaakasuuntainen scroll */}
        <div style={{marginBottom:catMain?6:12}}>
          <p style={{fontSize:11,fontWeight:600,color:S.mut,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Kategoriat</p>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,scrollbarWidth:"none",msOverflowStyle:"none",WebkitOverflowScrolling:"touch"}}>
            {CAT_TREE.map(cat=>(
              <button key={cat.k}
                onClick={()=>catMain===cat.k?clearCat():selectMainCat(cat)}
                style={{flexShrink:0,padding:"8px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                  cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap",border:"1.5px solid",
                  background:catMain===cat.k?S.rose:S.wh,
                  color:catMain===cat.k?S.wh:S.ink,
                  borderColor:catMain===cat.k?S.rose:S.brd}}>
                {cat.i} {cat.l}
              </button>
            ))}
          </div>
        </div>

        {/* Taso 2: Ryhmät — näytetään kun pääkategoria valittu mutta ryhmää ei vielä */}
        {currentCat&&!catGroup&&(
          <div style={{...card(S.bg,S.brd),padding:12,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <button onClick={goBackMain} style={{background:"none",border:"none",fontSize:11,color:S.mut,cursor:"pointer",fontFamily:FF,padding:0}}>← Takaisin</button>
              <span style={{fontSize:13,fontWeight:700,color:S.ink}}>{currentCat.i} {currentCat.l}</span>
              <button onClick={clearCat} style={{background:"none",border:"none",fontSize:11,color:S.mut,cursor:"pointer",fontFamily:FF,marginLeft:"auto"}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {currentCat.groups.map(group=>(
                <button key={group.l} onClick={()=>selectGroup(group)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:14,
                    background:S.wh,border:"1.5px solid "+S.brd,cursor:"pointer",textAlign:"left",fontFamily:FF,
                    fontSize:13,fontWeight:600,color:S.ink}}>
                  <span style={{fontSize:18,minWidth:24,textAlign:"center"}}>{GROUP_ICONS[group.l]||"›"}</span>
                  <span style={{flex:1}}>{group.l}</span>
                  <span style={{fontSize:11,color:S.mut}}>{group.items.length} kpl ›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Taso 3: Alakategoriat — näytetään kun ryhmä valittu */}
        {currentCat&&catGroup&&currentGroup&&(
          <div style={{...card(S.bg,S.brd),padding:12,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <button onClick={goBackGroup} style={{background:"none",border:"none",fontSize:11,color:S.rose,cursor:"pointer",fontFamily:FF,padding:0,fontWeight:600}}>← {currentCat.l}</button>
              <span style={{fontSize:13,fontWeight:700,color:S.ink}}>{GROUP_ICONS[currentGroup.l]||""} {currentGroup.l}</span>
              <button onClick={clearCat} style={{background:"none",border:"none",fontSize:11,color:S.mut,cursor:"pointer",fontFamily:FF,marginLeft:"auto"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {currentGroup.items.map(sub=>(
                <button key={sub.k} onClick={()=>selectSub(sub)}
                  style={{padding:"6px 13px",borderRadius:14,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:FF,
                    border:"1px solid "+(catSub===sub.k?S.rose:S.brd),
                    background:catSub===sub.k?S.rose:S.rs,
                    color:catSub===sub.k?S.wh:S.rd}}>
                  {sub.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tuotemerkkivalinta — näytetään kun relevantti kategoria valittu */}
        {catMain&&BRANDS[catMain]&&(
          <div style={{...card(S.bg,S.brd),padding:12,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:700,color:S.mut,textTransform:"uppercase",letterSpacing:"0.05em"}}>Tuotemerkki</span>
              {brand&&<button onClick={()=>selectBrand(brand)} style={{background:"none",border:"none",fontSize:11,color:S.rose,cursor:"pointer",fontFamily:FF,fontWeight:600}}>Poista ✕</button>}
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {BRANDS[catMain].map(b=>(
                <button key={b} onClick={()=>selectBrand(b)}
                  style={{padding:"5px 11px",borderRadius:14,fontSize:11.5,fontWeight:500,cursor:"pointer",fontFamily:FF,
                    border:"1px solid "+(brand===b?S.rose:S.brd),
                    background:brand===b?S.rose:S.wh,
                    color:brand===b?S.wh:S.ink}}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isPlus&&freeLeft>0&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
          <div style={{flex:1,height:5,borderRadius:3,background:S.brd}}>
            <div style={{height:5,borderRadius:3,background:freeLeft<=2?S.rose:S.grn,width:(freeLeft/FREE_MONTHLY_LIMIT*100)+"%",transition:"width 0.3s"}}/>
          </div>
          <span style={{fontSize:11,color:freeLeft<=2?S.rose:S.mut,fontWeight:600,flexShrink:0}}>{freeLeft}/{FREE_MONTHLY_LIMIT} hakua jäljellä</span>
        </div>}
        {!isPlus&&freeLeft<=0&&(
          <div style={{...card(S.rs,S.rose),padding:"12px 14px",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:S.rd,marginBottom:4}}>🔒 Kuukausiraja täynnä</div>
            <p style={{fontSize:12,color:S.rd,margin:"0 0 8px",lineHeight:1.4}}>Olet käyttänyt kaikki {FREE_MONTHLY_LIMIT} ilmaista hakua tältä kuulta. Uudet haut avautuvat ensi kuussa.</p>
            <button onClick={goPlus} style={{...btn(S.rose),width:"100%",padding:"10px 0",fontSize:13}}>👑 Aktivoi Plus — rajattomat haut</button>
          </div>
        )}

        {/* Hakuhistoria — vain kun ei aktiivista hakua tai kategoriaa */}
        {!catMain&&!q&&history.length>0&&(
          <div style={{marginBottom:12}}>
            <p style={{fontSize:11,fontWeight:600,color:S.mut,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Viimeisimmät haut</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {history.map(h=>(
                <button key={h} onClick={()=>doSearch(h)}
                  style={{background:S.rs,color:S.rd,border:"none",borderRadius:14,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:FF}}>
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </>}

      {loading&&<Spinner label="Haetaan tuotteita…"/>}

      {suggestions&&!compareData&&!loading&&(()=>{
        if(!suggestions.ok){
          if(suggestions.error==="__LIMIT__")return null; // Raja-ilmoitus näkyy jo ylhäällä
          return<Err msg={suggestions.error}/>;
        }
        // Data tulee jo suodatettuna searchProducts-funktiosta; suojasuodatus isFinnish
        const sugg=suggestions.results.filter(r=>isFinnish(r));
        // Kaupat suodatusta varten
        const availableStores=[...new Set(sugg.map(r=>r.store).filter(Boolean))].sort();
        // Sovella suodattimet
        const filtered=sugg.filter(r=>{
          if(fMin&&r.price!=null&&r.price<parseFloat(fMin))return false;
          if(fMax&&r.price!=null&&r.price>parseFloat(fMax))return false;
          if(fStores.length>0&&!fStores.includes(r.store))return false;
          return true;
        });
        const hasFilters=fMin||fMax||fStores.length>0;
        return sugg.length>0?(
          <div style={{marginTop:8}}>
            {/* Kategoria-aktiivinen palkki */}
            {catMain&&catSub&&(
              <div style={{...card(S.rs,S.brd),padding:"7px 12px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11.5,color:S.rd,fontWeight:600}}>
                  {currentCat?.i} {currentCat?.l} › {findSubByKey(catSub)?.l}
                </span>
                <button onClick={()=>{setCatSub(null);setCatSearchTerm(currentCat?.s||"");}}
                  style={{background:"none",border:"none",color:S.mut,fontSize:10.5,cursor:"pointer",fontFamily:FF}}>
                  ✕ Poista tarkennus
                </button>
              </div>
            )}
            {catMain&&!catSub&&(
              <div style={{...card(S.rs,S.brd),padding:"7px 12px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11.5,color:S.rd,fontWeight:600}}>
                  {currentCat?.i} {currentCat?.l} — kaikki tuotteet
                </span>
                <button onClick={clearCat}
                  style={{background:"none",border:"none",color:S.mut,fontSize:10.5,cursor:"pointer",fontFamily:FF}}>
                  ✕ Poista
                </button>
              </div>
            )}
            {/* ── Suodattimet ── */}
            <div style={{...card(S.bg,S.brd),padding:"10px 12px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:11.5,fontWeight:700,color:S.ink}}>🎛 Rajaa tuloksia</span>
                {hasFilters&&<button onClick={()=>{setFMin("");setFMax("");setFStores([]);}} style={{fontSize:11,color:S.rose,background:"none",border:"none",cursor:"pointer",fontFamily:FF,fontWeight:600}}>Tyhjennä ✕</button>}
              </div>
              {/* Hintaväli */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:11.5,color:S.mut,flexShrink:0}}>Hinta:</span>
                <input type="number" value={fMin} onChange={e=>setFMin(e.target.value)} placeholder="Min €"
                  style={{...inp,fontSize:12,padding:"6px 10px",width:70,minWidth:0}}/>
                <span style={{fontSize:12,color:S.mut}}>–</span>
                <input type="number" value={fMax} onChange={e=>setFMax(e.target.value)} placeholder="Max €"
                  style={{...inp,fontSize:12,padding:"6px 10px",width:70,minWidth:0}}/>
              </div>
              {/* Kaupat */}
              {availableStores.length>1&&(
                <div>
                  <div style={{fontSize:11,color:S.mut,marginBottom:5,fontWeight:600}}>Kauppa:</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {availableStores.map(st=>{
                      const on=fStores.includes(st);
                      return(
                        <button key={st} onClick={()=>setFStores(on?fStores.filter(s=>s!==st):[...fStores,st])}
                          style={{padding:"4px 10px",borderRadius:12,fontSize:11.5,fontWeight:500,cursor:"pointer",fontFamily:FF,
                            border:"1px solid "+(on?S.rose:S.brd),background:on?S.rose:S.wh,color:on?S.wh:S.ink}}>
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <p style={{fontSize:12,color:S.mut,marginBottom:10,fontFamily:FF}}>
              Valitse tuote, jonka hinnat haluat vertailla:
              {hasFilters&&<span style={{color:S.rose}}> ({filtered.length}/{sugg.length})</span>}
            </p>
            {(hasFilters?filtered:sugg).sort((a,b)=>{
              if(a.price!=null&&b.price!=null)return a.price-b.price;
              if(a.price!=null)return -1;
              if(b.price!=null)return 1;
              return 0;
            }).map((item,i)=>(
              <button key={i} onClick={()=>selectProduct(item)}
                style={{...card(),cursor:"pointer",width:"100%",textAlign:"left",display:"flex",gap:12,alignItems:"center",padding:13,marginBottom:0}}>
                {item.image&&<img src={item.image} alt="" style={{width:52,height:52,borderRadius:12,objectFit:"cover",background:S.rs,flexShrink:0}} onError={e=>{e.target.style.display="none"}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13.5,fontWeight:600,color:S.ink,lineHeight:1.35,fontFamily:FF}}>{item.title}</div>
                </div>
                <div style={{fontSize:11.5,color:S.rose,fontWeight:600,flexShrink:0,fontFamily:FF}}>Valitse →</div>
              </button>
            ))}
            {hasFilters&&filtered.length===0&&<p style={{color:S.mut,fontSize:13,marginTop:8,fontFamily:FF}}>Ei tuloksia valituilla suodattimilla. Kokeile laajentaa hintaväliä tai poista kaupparajaus.</p>}
          </div>
        ):<p style={{color:S.mut,fontSize:13,marginTop:12,fontFamily:FF}}>Ei tuloksia suomalaisista verkkokaupoista. Kokeile toista hakusanaa tai eri kategoriaa.</p>;
      })()}

      {showConfirm&&selected&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:S.wh,borderRadius:20,padding:20,maxWidth:360,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontWeight:700,fontSize:16,color:S.ink,marginBottom:4}}>Hintavertailu</div>
            <p style={{fontSize:13,color:S.mut,marginBottom:14}}>
              {isPlus?"Haluatko vertailla tämän tuotteen hintoja eri kaupoissa?":freeLeft<=0?"Ilmaiset vertailut käytetty. Aktivoi Plus jatkaaksesi.":`Haluatko käyttää ilmaisen vertailun? Jäljellä ${freeLeft}/10.`}
            </p>
            <div style={{...card(S.bg,S.brd),marginBottom:16,padding:10,display:"flex",gap:10,alignItems:"center"}}>
              {selected.image&&<img src={selected.image} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover",flexShrink:0}} onError={e=>{e.target.style.display="none"}}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:600,color:S.ink,lineHeight:1.3}}>{selected.title}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowConfirm(false);setSelected(null);}} style={{...btn(S.brd,S.mut),flex:1,padding:"10px 0"}}>Ei</button>
              <button onClick={confirmCompare} disabled={!isPlus&&freeLeft<=0}
                style={{...btn(!isPlus&&freeLeft<=0?S.brd:S.rose,!isPlus&&freeLeft<=0?S.mut:S.wh),flex:1,padding:"10px 0"}}>
                Kyllä, vertaile
              </button>
            </div>
            {!isPlus&&freeLeft<=0&&<button onClick={()=>{setShowConfirm(false);goPlus();}} style={{...btn(S.rose),width:"100%",marginTop:8,padding:"10px 0"}}>Aktivoi Plus</button>}
          </div>
        </div>
      )}

      {(compareData||compareLoading)&&(
        <div>
          <button onClick={reset} style={{background:"none",border:"none",color:S.rd,fontWeight:600,fontSize:13,cursor:"pointer",marginBottom:12}}>← Uusi haku</button>
          {selected&&<div style={{...card(S.gs,S.grn),marginBottom:12,padding:10}}>
            <div style={{fontSize:12,fontWeight:600,color:S.grn}}>Vertaillaan: {selected.title}</div>
          </div>}
          <Results data={compareData} loading={compareLoading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
        </div>
      )}
    </div>
  );
}

/* SKANNAA */
function ScreenSkannaa({isPlus,freeLeft,useFree,favs,toggleFav,addList,goPlus}) {
  const[url,setUrl]=useState("");
  const[loading,setLoading]=useState(false);
  const[data,setData]=useState(null);
  const[eanFound,setEanFound]=useState(null);
  const[scanning,setScanning]=useState(false);
  const[statusMsg,setStatusMsg]=useState("");
  const videoRef=useRef(null);
  const streamRef=useRef(null);
  const zxingRef=useRef(null);

  const guessName=u=>{
    try{
      const parsed=new URL(u);
      const segments=parsed.pathname.split("/").filter(Boolean);
      const SKIP=/^(fi|sv|en|p|c|d|s|cat|category|products?|shop|store|tuotteet?|verkkokauppa|[a-z]{1,2}|\d+)$/i;
      const parts=segments.filter(s=>s.length>5&&!SKIP.test(s)&&s.includes('-'));
      parts.sort((a,b)=>b.length-a.length);
      const slug=(parts[0]||segments[segments.length-1]||"");
      return slug.replace(/[-_]/g," ").replace(/\.\w{2,4}$/,"").trim().slice(0,150);
    }catch{return u.slice(0,100);}
  };

  const searchByEan=async(ean)=>{
    setLoading(true);setData(null);
    setStatusMsg("Haetaan tuotenimeä EAN-koodilla "+ean+"…");
    // Hae tuotenimi Open Beauty/Food Facts -tietokannasta
    let searchTerm=ean;
    try{
      const nr=await fetch(`${API}/api/ean?${new URLSearchParams({url:ean})}`);
      const nj=await nr.json();
      if(nj.productName){searchTerm=nj.productName;setStatusMsg("Löytyi: "+nj.productName+" — haetaan kaupoista…");}
    }catch{}
    const d=await searchProducts(searchTerm,{titleThreshold:0});
    setData(d);setLoading(false);setStatusMsg("");
    if(d.ok)useFree();
  };

  const run=async()=>{
    if(!url.trim()||(!isPlus&&freeLeft<=0))return;
    setLoading(true);setData(null);setEanFound(null);
    // Yritä poimia EAN tuotesivulta ensin
    if(url.startsWith("http")){
      setStatusMsg("Haetaan EAN-koodi tuotesivulta…");
      try{
        const r=await fetch(`${API}/api/ean?${new URLSearchParams({url})}`);
        const j=await r.json();
        if(j.ok&&j.ean){
          setEanFound(j.ean);
          // Käytä tuotenimeä jos löytyi, muuten EAN-koodia
          const searchTerm=j.productName||j.ean;
          setStatusMsg(j.productName?"Löytyi: "+j.productName+" — haetaan kaupoista…":"EAN: "+j.ean+" — haetaan kaupoista…");
          const d=await searchProducts(searchTerm,{titleThreshold:0});
          setData(d);setLoading(false);setStatusMsg("");
          if(d.ok)useFree();return;
        }
      }catch{}
    }
    // Fallback: nimimatching URL-slugista
    setStatusMsg("EAN ei löytynyt — haetaan tuotenimellä…");
    const productName=guessName(url);
    const d=await searchProducts(productName,{titleThreshold:0.45});
    setData(d);setLoading(false);setStatusMsg("");
    if(d.ok)useFree();
  };

  const stopCamera=()=>{
    if(zxingRef.current){try{zxingRef.current.reset();}catch{}zxingRef.current=null;}
    if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
    setScanning(false);
  };

  const startCamera=async()=>{
    try{
      const{BrowserMultiFormatReader}=await import("@zxing/browser");
      const reader=new BrowserMultiFormatReader();
      zxingRef.current=reader;
      setScanning(true);
      // Odota React-renderointi jotta video-elementti on DOM:ssa
      await new Promise(r=>setTimeout(r,150));
      if(!videoRef.current){return;}
      // decodeFromConstraints hoitaa kameran avauksen itse — toimii iOS Safarissa
      reader.decodeFromConstraints(
        {video:{facingMode:{ideal:"environment"}}},
        videoRef.current,
        (result,err)=>{
          if(result){
            const ean=result.getText();
            // Tallenna stream stoppia varten
            if(videoRef.current&&videoRef.current.srcObject)streamRef.current=videoRef.current.srcObject;
            stopCamera();
            setUrl(ean);
            setEanFound(ean);
            if(!isPlus&&freeLeft<=0)return;
            searchByEan(ean);
          }
          // NotFoundException on normaali kun koodia ei näy — ei virhe
        }
      );
    }catch(e){
      stopCamera();
      if(e.name==="NotAllowedError"||e.name==="PermissionDeniedError"){
        alert("Kameran käyttöoikeus evätty. Salli kameran käyttö selaimen asetuksista.");
      }else{
        alert("Kameran avaaminen epäonnistui: "+(e.message||e));
      }
    }
  };

  useEffect(()=>()=>stopCamera(),[]);

  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:4}}>📷 Skannaa</h2>
      <p style={{fontSize:13,color:S.mut,marginBottom:12}}>Skannaa viivakoodi kameralla tai liitä tuotelinkki — sovellus etsii saman tuotteen hinnat kaikista kaupoista EAN-koodin avulla.</p>

      {scanning&&(
        <div style={{marginBottom:12,borderRadius:16,overflow:"hidden",background:"#000",position:"relative"}}>
          <video ref={videoRef} style={{width:"100%",maxHeight:240,objectFit:"cover",display:"block"}} playsInline muted/>
          <div style={{position:"absolute",inset:0,border:"3px solid "+S.rose,borderRadius:16,pointerEvents:"none"}}/>
          <button onClick={stopCamera} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>✕ Sulje</button>
          <div style={{position:"absolute",bottom:8,left:0,right:0,textAlign:"center",color:"#fff",fontSize:12}}>Kohdista viivakoodi kameraan</div>
        </div>
      )}

      <div style={card()}>
        <div style={{fontWeight:600,fontSize:13,color:S.ink,marginBottom:8}}>🔗 Tuotelinkki tai EAN-koodi</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input value={url} onChange={e=>{setUrl(e.target.value);setEanFound(null);}} placeholder="https://... tai 6408430012345" style={{...inp,fontSize:12.5}}/>
          <button onClick={run} disabled={loading||!url.trim()||(!isPlus&&freeLeft<=0)} style={{...btn((!isPlus&&freeLeft<=0)||!url.trim()?S.brd:S.ink),whiteSpace:"nowrap"}}>{loading?"⏳":"Hae"}</button>
        </div>
        <button onClick={scanning?stopCamera:startCamera} style={{...btn(scanning?S.rose:S.ink),width:"100%",fontSize:13}}>
          {scanning?"⏹ Pysäytä skannaus":"📷 Skannaa viivakoodi kameralla"}
        </button>
      </div>

      {eanFound&&<div style={{background:"#F0FAF0",border:"1px solid "+S.grn,borderRadius:10,padding:"8px 12px",marginTop:8,fontSize:12,color:S.grn}}>
        ✓ EAN löytyi: <strong>{eanFound}</strong> — hakutulokset ovat tarkempia
      </div>}
      {statusMsg&&!data&&<div style={{fontSize:12,color:S.mut,marginTop:8,textAlign:"center"}}>{statusMsg}</div>}

      <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
    </div>
  );
}

/* AI-SUUNNITTELIJA */
function ScreenAI({isPlus,goPlus,favs,toggleFav,addList,profile}) {
  const[tool,setTool]=useState(null);
  if(!isPlus)return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>✨ AI-suunnittelija</h2>
      <div style={{...card(),background:"linear-gradient(135deg,"+S.rs+","+S.ys+")",textAlign:"center",padding:24}}>
        <div style={{fontSize:26}}>👑</div>
        <h3 style={{fontSize:18,fontWeight:700,color:S.ink,margin:"8px 0"}}>AI-suunnittelija on Plus-ominaisuus</h3>
        <button onClick={goPlus} style={{...btn(S.rose),fontSize:13.5,padding:"10px 24px",marginTop:8}}>Aktivoi Plus</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16}}>
        {[["🧪 Ainesosahaku","Hae tuotteita ainesosan mukaan"],["✨ Paras tuote minulle","Live-haku profiilisi mukaan"],["⚖️ Tuotevertailu","Vertaa kahta tuotetta"],["🔄 Vastaava tuote","Löydä halvempi vaihtoehto"],["💬 Luonnollisen kielen haku","\"Shampoo max 9,90 €\""],["👗 Asun etsiminen","Kokonaisuus budjetilla"]].map(([l,d])=>(
          <div key={l} style={{...card(),opacity:0.7,padding:12}}><div style={{fontSize:14}}>{l.split(" ")[0]}</div><div style={{fontWeight:600,fontSize:11.5,color:S.ink,marginTop:4}}>{l.split(" ").slice(1).join(" ")}</div><div style={{fontSize:10,color:S.mut}}>{d}</div><div style={{fontSize:10,color:S.mut,marginTop:4}}>🔒 Plus</div></div>
        ))}
      </div>
    </div>
  );
  const tools=[
    {k:"ainesosa",l:"🧪 Ainesosahaku",d:"Hae tuotteita ainesosan mukaan"},
    {k:"paras",l:"✨ Paras tuote minulle",d:"Live-haku profiilisi mukaan"},
    {k:"vertailu",l:"⚖️ Tuotevertailu",d:"Vertaa kahta tuotetta"},
    {k:"vastaava",l:"🔄 Vastaava tuote",d:"Löydä halvempi vaihtoehto"},
    {k:"luonnollinen",l:"💬 Luonnollisen kielen haku",d:"Esim. \"Shampoo max 9,90 €\""},
    {k:"asu",l:"👗 Asun etsiminen",d:"Luo kokonaisuus budjetin perusteella"},
  ];
  const cp={isPlus,goPlus,favs,toggleFav,addList};
  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>✨ AI-suunnittelija</h2>
      {!tool&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{tools.map(t=><button key={t.k} onClick={()=>setTool(t.k)} style={{...card(),cursor:"pointer",textAlign:"left"}}><div style={{fontWeight:600,fontSize:12,color:S.ink}}>{t.l}</div><div style={{fontSize:10.5,color:S.mut,marginTop:3}}>{t.d}</div></button>)}</div>}
      {tool==="ainesosa"&&<AinesosaTool back={()=>setTool(null)} {...cp}/>}
      {tool==="paras"&&<ParasTool back={()=>setTool(null)} {...cp} profile={profile}/>}
      {tool==="vertailu"&&<VertailuTool back={()=>setTool(null)} {...cp}/>}
      {tool==="vastaava"&&<VastaavaTool back={()=>setTool(null)} {...cp}/>}
      {tool==="luonnollinen"&&<LuonnollinenTool back={()=>setTool(null)} {...cp}/>}
      {tool==="asu"&&<AsuTool back={()=>setTool(null)} {...cp} profile={profile}/>}
    </div>
  );
}

function ToolHeader({label,back}) { return <button onClick={back} style={{background:"none",border:"none",color:S.rd,fontWeight:600,fontSize:13,cursor:"pointer",marginBottom:12}}>← {label}</button>; }

function AinesosaTool({back,isPlus,goPlus,favs,toggleFav,addList}) {
  const[q,setQ]=useState("");const[loading,setLoading]=useState(false);const[data,setData]=useState(null);
  const key=q?findIng(q):null;
  const run=async()=>{if(!q.trim())return;setLoading(true);setData(await searchProducts(q));setLoading(false);};
  return(<div><ToolHeader label="Ainesosahaku" back={back}/>
    <p style={{fontSize:12.5,color:S.mut,marginBottom:8}}>Kirjoita ainesosa — haemme tuotteita, joiden kuvauksessa se mainitaan.</p>
    <div style={{display:"flex",gap:8,marginBottom:8}}>
      <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="esim. arganöljy, keratiini, niacinamide" style={{...inp,fontSize:13}}/>
      <button onClick={run} style={btn(S.ink)}>🔍</button>
    </div>
    {key&&INGREDIENTS[key]&&<div style={{...card(S.rs,S.rd),padding:10}}><span style={{fontWeight:600,fontSize:12,color:S.rd}}>{key}:</span> <span style={{fontSize:12,color:S.rd}}>{INGREDIENTS[key]}</span></div>}
    <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
  </div>);
}

function ParasTool({back,isPlus,goPlus,favs,toggleFav,addList,profile}) {
  const[selCat,setSelCat]=useState(null);const[loading,setLoading]=useState(false);const[data,setData]=useState(null);

  // Kaikki profiilitägi-ryhmät dynaamisesti — ei kovakoodattuja kategorioita
  const tagGroups=Object.entries(profile)
    .filter(([k,v])=>k!=='mitat'&&k!=='budjetti'&&Array.isArray(v)&&v.length>0)
    .map(([k,v])=>({key:k,tags:v}));
  const catLabels={'hiuksetTags':'🧴 Hiukset','kosmetiikkaTags':'💄 Kosmetiikka','tyyliTags':'👗 Tyyli'};

  const run=async()=>{
    const catKey=selCat||tagGroups[0]?.key;
    if(!catKey){setData({ok:false,error:"Valitse ensin kategoria."});return;}
    const tags=profile[catKey]||[];
    if(!tags.length){setData({ok:false,error:"Täytä ensin profiilisi mieltymykset profiilisivulla."});return;}
    const anchor=CAT_ANCHORS[catKey];
    // Etsi ensimmäinen tagi jolla on täsmäävä hakutermi
    let searchTerm=null;
    for(const tag of tags){
      const mapped=anchor?.tagMap?.[tag.toLowerCase()];
      if(mapped){searchTerm=mapped;break;}
    }
    // Fallback: satunnainen ankurihaku — EI tagien nimiä suoraan
    if(!searchTerm){
      const bases=anchor?.bases||["naisten vaate"];
      searchTerm=bases[Math.floor(Math.random()*bases.length)];
    }
    // Lisää vaatekoko tyylihakuun
    if(catKey==='tyyliTags'&&profile.mitat?.vaatekoko) searchTerm+=' koko '+profile.mitat.vaatekoko;
    // Sukupuolimukainen hakutermi (vain Paras tuote minulle)
    const gender=profile.sukupuoli;
    if(gender==="Mies"&&catKey==='tyyliTags'){
      searchTerm=searchTerm.replace(/naisten?/gi,"miesten");
      if(!searchTerm.includes("mies")) searchTerm="miesten "+searchTerm;
    }
    setLoading(true);
    // Yhteinen hakumoottori: kategoriavalidointi + sukupuolisuodatus
    const d=await searchProducts(searchTerm, {validate:anchor?.validate, gender});
    setData(d);setLoading(false);
  };

  return(<div><ToolHeader label="Paras tuote minulle" back={back}/>
    {tagGroups.length>0?(
      <>
        <p style={{fontSize:12,color:S.mut,marginBottom:8}}>Valitse kategoria tai hae kaikista profiilisi mieltymyksistä:</p>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          {tagGroups.map(({key})=>(
            <button key={key} onClick={()=>setSelCat(selCat===key?null:key)} style={chip(selCat===key)}>
              {catLabels[key]||key.replace('Tags','')}
            </button>
          ))}
        </div>
        {profile.mitat?.vaatekoko&&<p style={{fontSize:11,color:S.mut,marginBottom:6}}>👗 Vaatekokosi: {profile.mitat.vaatekoko} (huomioituu tyylihaussa)</p>}
        {profile.mitat?.ihonsavy&&<p style={{fontSize:11,color:S.mut,marginBottom:6}}>🎨 Ihon sävy: {profile.mitat.ihonsavy}</p>}
      </>
    ):(
      <div style={{...card(S.rs,S.brd),padding:14,marginBottom:10}}>
        <p style={{fontSize:13,color:S.ink,fontWeight:600,marginBottom:4}}>Profiili puuttuu</p>
        <p style={{fontSize:12,color:S.mut,margin:0}}>Täytä ensin profiilisi mieltymykset, jotta AI voi suositella sopivia tuotteita.</p>
      </div>
    )}
    <button onClick={run} disabled={tagGroups.length===0} style={{...btn(tagGroups.length>0?S.ink:S.brd,tagGroups.length>0?S.wh:S.mut),width:"100%",marginBottom:10}}>
      ✨ Hae suositus profiilini mukaan
    </button>
    <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
  </div>);
}

function VertailuTool({back,isPlus,goPlus,favs,toggleFav,addList}) {
  const[qa,setQa]=useState("");const[qb,setQb]=useState("");const[loading,setLoading]=useState(false);const[da,setDa]=useState(null);const[db,setDb]=useState(null);
  const run=async()=>{if(!qa.trim()||!qb.trim())return;setLoading(true);const[a,b]=await Promise.all([searchProducts(qa),searchProducts(qb)]);setDa(a);setDb(b);setLoading(false);};
  const bestA=da?.ok?(da.results||[]).filter(r=>isFinnish(r)&&r.price!=null)[0]:null;
  const bestB=db?.ok?(db.results||[]).filter(r=>isFinnish(r)&&r.price!=null)[0]:null;
  return(<div><ToolHeader label="Tuotevertailu" back={back}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
      <input value={qa} onChange={e=>setQa(e.target.value)} placeholder="Tuote A" style={{...inp,fontSize:12.5}}/>
      <input value={qb} onChange={e=>setQb(e.target.value)} placeholder="Tuote B" style={{...inp,fontSize:12.5}}/>
    </div>
    <button onClick={run} disabled={!qa.trim()||!qb.trim()} style={{...btn(S.ink),width:"100%",marginBottom:10}}>Vertaa</button>
    {loading&&<Spinner/>}
    {!loading&&bestA&&bestB&&(
      <div style={{...card(),marginBottom:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:600,color:S.mut,marginBottom:10,textAlign:"center"}}>Halvin hinta vertailussa</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center"}}>
          <div style={{textAlign:"center",padding:"10px 8px",borderRadius:12,background:bestA._total<=bestB._total?"#F0FAF0":S.rs,border:"2px solid "+(bestA._total<=bestB._total?S.grn:S.brd)}}>
            <div style={{fontSize:10,color:S.mut,marginBottom:4,lineHeight:1.3}}>{bestA.title?.slice(0,40)}</div>
            <div style={{fontSize:18,fontWeight:700,color:bestA._total<=bestB._total?S.grn:S.ink}}>{eur(bestA._total??bestA.price)}</div>
            <div style={{fontSize:10,color:S.mut}}>{bestA.store}</div>
            {bestA._total<=bestB._total&&<div style={{fontSize:10,color:S.grn,fontWeight:600,marginTop:2}}>✓ Halvempi</div>}
          </div>
          <div style={{fontSize:12,color:S.mut,fontWeight:600}}>vs</div>
          <div style={{textAlign:"center",padding:"10px 8px",borderRadius:12,background:bestB._total<bestA._total?"#F0FAF0":S.rs,border:"2px solid "+(bestB._total<bestA._total?S.grn:S.brd)}}>
            <div style={{fontSize:10,color:S.mut,marginBottom:4,lineHeight:1.3}}>{bestB.title?.slice(0,40)}</div>
            <div style={{fontSize:18,fontWeight:700,color:bestB._total<bestA._total?S.grn:S.ink}}>{eur(bestB._total??bestB.price)}</div>
            <div style={{fontSize:10,color:S.mut}}>{bestB.store}</div>
            {bestB._total<bestA._total&&<div style={{fontSize:10,color:S.grn,fontWeight:600,marginTop:2}}>✓ Halvempi</div>}
          </div>
        </div>
        {bestA._total!=null&&bestB._total!=null&&<div style={{fontSize:11,color:S.mut,textAlign:"center",marginTop:8}}>
          Hintaero: <strong>{eur(Math.abs(bestA._total-bestB._total))}</strong>
        </div>}
      </div>
    )}
    {!loading&&da&&<><p style={{fontWeight:600,fontSize:12,color:S.mut,marginBottom:4}}>Kaikki tulokset — Tuote A</p><Results data={da} loading={false} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/></>}
    {!loading&&db&&<><p style={{fontWeight:600,fontSize:12,color:S.mut,marginBottom:4,marginTop:12}}>Kaikki tulokset — Tuote B</p><Results data={db} loading={false} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/></>}
  </div>);
}

function VastaavaTool({back,isPlus,goPlus,favs,toggleFav,addList}) {
  const[q,setQ]=useState("");const[loading,setLoading]=useState(false);const[data,setData]=useState(null);
  const run=async()=>{if(!q.trim())return;setLoading(true);setData(await searchProducts(q));setLoading(false);};
  return(<div><ToolHeader label="Vastaava tuote" back={back}/>
    <p style={{fontSize:12.5,color:S.mut,marginBottom:8}}>Kirjoita tuote — näytämme vaihtoehdot eri kaupoista.</p>
    <div style={{display:"flex",gap:8,marginBottom:8}}><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="esim. Moroccanoil Treatment 100ml" style={{...inp,fontSize:13}}/><button onClick={run} style={btn(S.ink)}>🔍</button></div>
    <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
  </div>);
}

function LuonnollinenTool({back,isPlus,goPlus,favs,toggleFav,addList}) {
  const[q,setQ]=useState("");const[loading,setLoading]=useState(false);const[data,setData]=useState(null);
  const run=async()=>{if(!q.trim())return;setLoading(true);const d=await searchProducts(q);
    const pm=q.toLowerCase().match(/(\d+[.,]?\d*)\s*€/);
    if(pm&&d.ok){const max=parseFloat(pm[1].replace(",","."));d.results=d.results.filter(x=>x.price!=null&&x.price<=max);}
    setData(d);setLoading(false);};
  return(<div><ToolHeader label="Luonnollisen kielen haku" back={back}/>
    <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="Kosteuttava shampoo max 9,90 €" style={{...inp,width:"100%",marginBottom:8}}/>
    <button onClick={run} style={{...btn(S.ink),width:"100%",marginBottom:10}}>Kysy AI-suunnittelijalta</button>
    <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
  </div>);
}

function AsuTool({back,isPlus,goPlus,favs,toggleFav,addList,profile}) {
  const[budget,setBudget]=useState(80);const[loading,setLoading]=useState(false);const[picks,setPicks]=useState(null);
  const run=async()=>{
    setLoading(true);
    const kw=(profile.tyyliTags||[])[0]||"";
    const anchor=CAT_ANCHORS.tyyliTags;
    const mapped=anchor.tagMap[kw.toLowerCase()]||"naisten vaatteet muoti";
    const d=await searchProducts(mapped+(profile.mitat?.vaatekoko?' koko '+profile.mitat.vaatekoko:''), {validate:anchor.validate});
    if(d.ok){
      const filtered=d.results;
      let t=0;const c=[];
      for(const it of filtered){
        if(it.price!=null&&t+it.price<=budget){c.push(it);t+=it.price;}
      }
      setPicks({chosen:c,total:t});
    }else setPicks({error:d.error});
    setLoading(false);
  };
  return(<div><ToolHeader label="Asun etsiminen" back={back}/>
    {profile.mitat?.vaatekoko&&<p style={{fontSize:11.5,color:S.mut,marginBottom:8}}>Vaatekokosi: {profile.mitat.vaatekoko}</p>}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:12.5}}>Budjetti</span><input type="range" min={20} max={300} value={budget} onChange={e=>setBudget(+e.target.value)} style={{flex:1}}/><span style={{fontWeight:700,fontFamily:"monospace",fontSize:13}}>{eur(budget)}</span></div>
    <button onClick={run} style={{...btn(S.ink),width:"100%",marginBottom:10}}>Hae asukokonaisuus</button>
    {loading&&<Spinner/>}
    {!loading&&picks?.error&&<Err msg={picks.error}/>}
    {!loading&&picks?.chosen&&<>{picks.chosen.length===0&&<p style={{fontSize:12.5,color:S.mut}}>Budjetti ei riittänyt.</p>}
    {groupProducts(picks.chosen).map((g,i)=><GroupedResultCard key={i} group={g} maxPrice={budget} toggleFav={toggleFav} addList={addList} favs={favs} isPlus={isPlus} goPlus={goPlus}/>)}
    {picks.total>0&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontWeight:600,fontSize:12.5}}>Yhteensä</span><span style={{fontWeight:700,fontFamily:"monospace",fontSize:14}}>{eur(picks.total)}</span></div>}</>}
  </div>);
}

/* OSTOSLISTA */
function ScreenOstoslista({list,setList,markBought,toggleFav,isPlus,goPlus,go}) {
  const[optimizing,setOptimizing]=useState(false);
  const[alerts,setAlerts]=useState([]);
  const total=list.reduce((s,it)=>s+(it.price||0),0);
  const remove=i=>setList(list.filter((_,j)=>j!==i));
  const toggleWatch=i=>setList(list.map((it,j)=>j===i?{...it,watched:!it.watched}:it));

  const checkAlerts=async(items)=>{
    const watched=items.filter(it=>it.watched&&it.price!=null);
    if(!watched.length)return[];
    const found=[];
    for(const it of watched){
      const r=await searchProducts(it.title);
      if(!r.ok||!r.results.length)continue;
      const best=r.results.reduce((a,b)=>((b._total||b.price||999)<(a._total||a.price||999)?b:a));
      const np=best._total||best.price;
      if(np!=null&&np<(it.price||999))found.push({title:it.title,oldPrice:it.price,newPrice:np,store:best.store});
    }
    return found;
  };

  const optimize=async()=>{
    setOptimizing(true);
    const u=[...list];
    for(let i=0;i<u.length;i++){
      const r=await searchProducts(u[i].title);
      if(r.ok&&r.results.length){
        const c=r.results.reduce((a,b)=>((b._total||b.price||999)<(a._total||a.price||999)?b:a));
        if((c._total||c.price||999)<(u[i].price||999))u[i]={...u[i],...c,previousPrice:u[i].price};
      }
    }
    setList(u);
    const found=await checkAlerts(u);
    if(found.length)setAlerts(found);
    setOptimizing(false);
  };

  // Tarkista hintavahdit automaattisesti kun ostoslista avataan
  useEffect(()=>{
    if(list.some(it=>it.watched))checkAlerts(list).then(a=>{if(a.length)setAlerts(a);});
  },[]);

  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>📋 Ostoslista</h2>

      {/* Hintavahti-ilmoitukset */}
      {alerts.length>0&&(
        <div style={{background:"#F0FAF0",border:"1.5px solid "+S.grn,borderRadius:14,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:S.grn,marginBottom:6}}>📉 Hintalasku havaittu!</div>
          {alerts.map((a,i)=>(
            <div key={i} style={{fontSize:12,color:S.ink,marginBottom:4}}>
              <b>{a.title}</b> · <span style={{textDecoration:"line-through",color:S.mut}}>{eur(a.oldPrice)}</span> → <span style={{color:S.grn,fontWeight:700}}>{eur(a.newPrice)}</span>
              {a.store&&<span style={{color:S.mut}}> · {a.store}</span>}
              <span style={{color:S.grn,fontWeight:600}}> (−{eur(a.oldPrice-a.newPrice)})</span>
            </div>
          ))}
          <button onClick={()=>setAlerts([])} style={{fontSize:11,color:S.mut,background:"none",border:"none",cursor:"pointer",marginTop:6,padding:0,fontFamily:FF}}>✕ Sulje ilmoitus</button>
        </div>
      )}

      {list.length===0&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,width:"100%",marginTop:40,padding:"32px 24px",background:S.wh,border:"2px dashed "+S.brd,borderRadius:20}}>
          <span style={{fontSize:40}}>🛍️</span>
          <div style={{fontSize:14,fontWeight:600,color:S.ink}}>Ostoslistasi on tyhjä</div>
          <div style={{fontSize:12,color:S.mut}}>Lisää tuotteita hakemalla niitä</div>
          <button onClick={()=>go("haku")} style={{background:S.rose,color:S.wh,borderRadius:14,padding:"10px 24px",fontSize:13,fontWeight:600,marginTop:4,border:"none",cursor:"pointer",fontFamily:FF}}>Selaa tuotteita →</button>
        </div>
      )}
      {list.length>0&&<div style={card()}><div style={{fontSize:12,color:S.mut}}>Yhteensä</div><div style={{fontSize:20,fontWeight:700,fontFamily:"monospace",color:S.ink}}>{eur(total)}</div></div>}
      {list.map((it,i)=>(
        <div key={i} style={{...card(),padding:"14px 14px 12px"}}>
          {/* Tuotetiedot */}
          <div style={{display:"flex",gap:12,marginBottom:12}}>
            {it.image&&<img src={it.image} alt="" style={{width:56,height:56,borderRadius:12,objectFit:"cover",flexShrink:0}} onError={e=>{e.target.style.display="none"}}/>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:S.ink,lineHeight:1.35,marginBottom:2}}>{it.title}</div>
              {it.store&&<div style={{fontSize:11.5,color:S.mut,marginBottom:4}}>🏪 {it.store}</div>}
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                {it.previousPrice>it.price&&<span style={{fontSize:12,color:S.mut,textDecoration:"line-through"}}>{eur(it.previousPrice)}</span>}
                <span style={{fontSize:17,fontWeight:700,fontFamily:"monospace",color:it.previousPrice>it.price?S.grn:S.ink}}>{eur(it.price)}</span>
                {it.previousPrice>it.price&&<span style={{fontSize:11,color:S.grn,fontWeight:700}}>−{eur(it.previousPrice-it.price)}</span>}
              </div>
              {it.watched&&<div style={{fontSize:10,color:S.grn,fontWeight:600,marginTop:2}}>👁 Hintavahti päällä</div>}
              {(()=>{const del=parseDelivery(it.delivery);
                if(del.free) return <div style={{fontSize:10,color:S.grn,fontWeight:700,marginTop:2}}>Toimitus ilmainen</div>;
                if(del.cost!=null&&it.price!=null) return <div style={{fontSize:10,color:S.mut,marginTop:2}}>+ toimitus {eur(del.cost)} · yht. <b>{eur(it.price+del.cost)}</b></div>;
                if(del.text) return <div style={{fontSize:10,color:S.mut,marginTop:2}}>toimitus: {del.text}</div>;
                return null;
              })()}
            </div>
          </div>
          {/* Päätoiminto */}
          <button onClick={()=>markBought(i)} style={{width:"100%",background:S.ink,color:S.wh,border:"none",borderRadius:12,padding:"11px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF,marginBottom:8}}>
            ✅ Merkitse ostetuksi
          </button>
          {/* Toissijaiset toiminnot */}
          <div style={{display:"grid",gridTemplateColumns:it.link?"1fr 1fr 1fr 1fr":"1fr 1fr 1fr",gap:6}}>
            {it.link&&(
              <a href={it.link} target="_blank" rel="noreferrer"
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:S.bg,border:"1.5px solid "+S.brd,borderRadius:10,padding:"9px 4px",fontSize:11.5,fontWeight:600,color:S.rd,textDecoration:"none",textAlign:"center"}}>
                🔗 Sivu
              </a>
            )}
            <button onClick={()=>toggleWatch(i)}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:it.watched?"#F0FAF0":S.bg,border:"1.5px solid "+(it.watched?S.grn:S.brd),borderRadius:10,padding:"9px 4px",fontSize:11.5,fontWeight:600,color:it.watched?S.grn:S.mut,cursor:"pointer",fontFamily:FF}}>
              👁 {it.watched?"Seurataan":"Seuraa"}
            </button>
            <button onClick={()=>{toggleFav(it);remove(i);}}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:S.rs,border:"1.5px solid "+S.brd,borderRadius:10,padding:"9px 4px",fontSize:11.5,fontWeight:600,color:S.rd,cursor:"pointer",fontFamily:FF}}>
              ❤️ Suosikit
            </button>
            <button onClick={()=>remove(i)}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:S.bg,border:"1.5px solid "+S.brd,borderRadius:10,padding:"9px 4px",fontSize:11.5,fontWeight:600,color:S.mut,cursor:"pointer",fontFamily:FF}}>
              🗑️ Poista
            </button>
          </div>
        </div>
      ))}
      {list.length>0&&<div style={{marginTop:12}}>
        {isPlus?<button onClick={optimize} disabled={optimizing} style={{...btn(S.ink),width:"100%",padding:"12px 0"}}>{optimizing?"⏳ Haetaan tuoreimmat hinnat…":"🔄 Optimoi ostoslista nyt"}</button>
        :<button onClick={goPlus} style={{...btn(S.brd,S.mut),width:"100%",padding:"12px 0"}}>🔒 Optimoi ostoslista (Plus)</button>}
        <p style={{fontSize:10.5,color:S.mut,textAlign:"center",marginTop:6}}>Hakee jokaiselle tuotteelle uusimmat hinnat ja päivittää halvimman.</p>
      </div>}
    </div>
  );
}

/* SUOSIKIT */
function ScreenSuosikit({favs,toggleFav,addList,isPlus,goPlus}) {
  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>❤️ Suosikit</h2>
      {favs.length===0&&<p style={{color:S.mut,fontSize:13}}>Ei suosikkeja. Lisää tuotteita hausta.</p>}
      {favs.map((it,i)=><ResultCard key={i} item={it} rank={null} toggleFav={toggleFav} addList={addList} isFav isPlus={isPlus} goPlus={goPlus}/>)}
    </div>
  );
}

/* SINULLE SUOSITELTUA — koko näkymä */
function ScreenSuositukset({behavior,profileRecs,onRecomm}) {
  const histItems=behavior?.lastResults||[];
  const profItems=profileRecs||[];
  const seen=new Set(profItems.map(x=>x.title));
  // Profiilipohjaiset ensin, sitten selaushistoria (ei duplikaatteja)
  const items=[...profItems,...histItems.filter(x=>!seen.has(x.title))];
  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>✨ Sinulle suositeltua</h2>
      {profItems.length>0&&<p style={{fontSize:11,color:S.mut,marginBottom:8}}>Suositukset perustuvat profiilisi mieltymyksiin.</p>}
      {items.length===0&&<p style={{color:S.mut,fontSize:13}}>Ei suosituksia vielä. Täytä profiilisi mieltymykset tai tee hakuja.</p>}
      {items.map((item,i)=>(
        <button key={i} onClick={()=>onRecomm(item)}
          style={{...card(),cursor:"pointer",width:"100%",textAlign:"left",display:"flex",gap:12,alignItems:"center",padding:13}}>
          {item.image&&<img src={item.image} alt="" style={{width:52,height:52,borderRadius:12,objectFit:"cover",background:S.rs,flexShrink:0}} onError={e=>{e.target.style.display="none"}}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:S.ink,lineHeight:1.3}}>{item.title}</div>
            {item.store&&<div style={{fontSize:11,color:S.mut,marginTop:2}}>{item.store}</div>}
            {item.price!=null&&<div style={{fontSize:12,fontWeight:700,fontFamily:"monospace",color:S.grn,marginTop:2}}>{eur(item.price)}</div>}
          </div>
          <span style={{fontSize:11.5,color:S.rose,fontWeight:600,flexShrink:0}}>Vertaile →</span>
        </button>
      ))}
    </div>
  );
}

/* TOTEUTUNUT SÄÄSTÖ */
function ScreenSaasto({savings,hist,isPlus,goPlus}) {
  const totalSaved=hist.reduce((s,p)=>s+(p.savedAmount||0),0)||savings;
  const savedItems=hist.filter(p=>p.savedAmount>0);
  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>📈 Toteutunut säästö</h2>
      <div style={{background:"#FFF8DC",borderRadius:18,padding:20,textAlign:"center",marginBottom:isPlus?16:10}}>
        <div style={{fontSize:13,color:"#7A6000",fontWeight:500}}>Kokonaissäästö</div>
        <div style={{fontSize:36,fontWeight:400,color:S.ink,marginTop:4}}>{eur(totalSaved)}</div>
      </div>
      {!isPlus&&(
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#FFF8DC",borderRadius:14,padding:"10px 14px",marginBottom:16,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#7A6000",lineHeight:1.4,flex:1,minWidth:180}}>Plus-versio näyttää halvimman löydetyn hinnan ja alennuskoodit</span>
          <button
            onClick={goPlus}
            style={{background:"linear-gradient(135deg,#C8960A,#FFD700,#FFBA08,#FFD700,#C8960A)",backgroundSize:"300% 300%",animation:"goldShimmer 3s ease infinite",border:"none",borderRadius:10,padding:"7px 13px",fontWeight:700,fontSize:13,color:"#3A2000",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",boxShadow:"0 2px 10px rgba(200,150,10,0.4)",flexShrink:0}}
          >{PLUS_PRICE}</button>
        </div>
      )}
      {savedItems.length===0&&<p style={{fontSize:12,color:S.mut}}>Ei vielä säästöjä. Merkitse tuote ostetuksi ostoslistalla.</p>}
      {savedItems.map((p,i)=>(
        <div key={i} style={{...card(),padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:600,color:S.ink,lineHeight:1.3}}>{p.name}</div>
              <div style={{fontSize:11,color:S.mut,marginTop:2}}>{p.date}{p.store?" · "+p.store:""}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:11,color:S.grn,fontWeight:600}}>Säästit {eur(p.savedAmount)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* OSTOKSET */
function ScreenOstokset({hist,saveHist}) {
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({date:"",store:"",name:"",price:""});
  const [scanning,setScanning]=useState(false);
  const [scanItems,setScanItems]=useState(null);
  const [scanErr,setScanErr]=useState("");
  const cameraRef=useRef();
  const galleryRef=useRef();

  const totalSpent=hist.reduce((s,p)=>s+(p.price||0),0);

  // Ryhmitellään kuukausittain
  const grouped={};
  hist.forEach(p=>{
    const parts=(p.date||"").split(".");
    const key=parts.length>=3?parts[2]+"-"+parts[1].padStart(2,"0"):"0000-00";
    const label=parts.length>=3?new Date(parseInt(parts[2]),parseInt(parts[1])-1).toLocaleDateString("fi-FI",{month:"long",year:"numeric"}):"—";
    if(!grouped[key])grouped[key]={label,items:[]};
    grouped[key].items.push(p);
  });
  const months=Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0]));

  const addManual=()=>{
    if(!form.name.trim())return;
    const price=parseFloat(form.price.replace(",","."))||0;
    const nh=[{date:form.date.trim()||today(),name:form.name.trim(),store:form.store.trim(),price,savedAmount:0,source:"manual"},...hist].slice(0,100);
    saveHist(nh);
    setForm({date:"",store:"",name:"",price:""});
    setShowAdd(false);
  };

  const handleImage=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setScanning(true);setScanErr("");setScanItems(null);
    try{
      const reader=new FileReader();
      const b64=await new Promise((res,rej)=>{reader.onload=()=>res(reader.result.split(",")[1]);reader.onerror=rej;reader.readAsDataURL(file);});
      const resp=await fetch(API+"/api/receipt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:b64,mimeType:file.type})});
      const data=await resp.json();
      if(!data.ok)throw new Error(data.error||"Virhe");
      setScanItems(data.items.map(it=>({...it,selected:true})));
    }catch(err){
      setScanErr("Kuitin lukeminen epäonnistui: "+(err.message||"yritä uudelleen"));
    }finally{
      setScanning(false);
      e.target.value="";
    }
  };

  const saveScanItems=()=>{
    const toAdd=scanItems.filter(it=>it.selected).map(it=>({date:it.date||today(),name:it.name,store:it.store||"",price:it.price||0,savedAmount:0,source:"receipt"}));
    if(!toAdd.length){setScanItems(null);return;}
    saveHist([...toAdd,...hist].slice(0,100));
    setScanItems(null);
  };

  if(scanItems)return(
    <div>
      <button onClick={()=>setScanItems(null)} style={{background:"none",border:"none",color:S.rd,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:FF,marginBottom:12,padding:0}}>← Takaisin</button>
      <h2 style={{fontSize:18,fontWeight:700,color:S.ink,marginBottom:4}}>🧾 Tarkista kuitti</h2>
      <p style={{fontSize:12,color:S.mut,marginBottom:12}}>Valitse tallennettavat tuotteet ja tarkista tiedot.</p>
      {scanItems.map((it,i)=>(
        <div key={i} style={{...card(),padding:12,display:"flex",alignItems:"flex-start",gap:10}}>
          <input type="checkbox" checked={it.selected} onChange={e=>setScanItems(scanItems.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))} style={{width:18,height:18,cursor:"pointer",flexShrink:0,marginTop:4}}/>
          <div style={{flex:1,minWidth:0}}>
            <input value={it.name} onChange={e=>setScanItems(scanItems.map((x,j)=>j===i?{...x,name:e.target.value}:x))}
              style={{...inp,padding:"6px 10px",fontSize:13,width:"100%",marginBottom:6}}/>
            <div style={{display:"flex",gap:6}}>
              <input value={it.store||""} onChange={e=>setScanItems(scanItems.map((x,j)=>j===i?{...x,store:e.target.value}:x))}
                placeholder="Kauppa" style={{...inp,padding:"5px 10px",fontSize:12,flex:1}}/>
              <input value={String(it.price||"")} onChange={e=>setScanItems(scanItems.map((x,j)=>j===i?{...x,price:parseFloat(e.target.value.replace(",","."))||0}:x))}
                placeholder="Hinta" style={{...inp,padding:"5px 10px",fontSize:12,width:70,fontFamily:"monospace"}}/>
            </div>
          </div>
        </div>
      ))}
      <button onClick={saveScanItems} style={{...btn(S.rose),width:"100%",padding:"13px 0",fontSize:14,marginTop:4}}>
        Tallenna {scanItems.filter(x=>x.selected).length} ostosta
      </button>
    </div>
  );

  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:4}}>🛍️ Ostokset</h2>
      <p style={{fontSize:12,color:S.mut,marginBottom:12}}>Yhteensä käytetty: <strong style={{color:S.ink,fontFamily:"monospace"}}>{eur(totalSpent)}</strong></p>

      <div style={{...card(S.ys,S.brd),padding:"12px 14px",marginBottom:12}}>
        <p style={{fontSize:12,color:S.at,fontWeight:600,marginBottom:6}}>Voit lisätä ostoksen kahdella tavalla:</p>
        <p style={{fontSize:12,color:S.ink,margin:"0 0 4px",lineHeight:1.5}}>• Lisää ostos manuaalisesti syöttämällä ostopäivämäärä, kauppa, tuote ja hinta.</p>
        <p style={{fontSize:12,color:S.ink,margin:0,lineHeight:1.5}}>• Ota kuva kuitista kameralla tai lataa kuva galleriasta — sovellus poimii automaattisesti ostopäivämäärän, kaupan, tuotteet ja hinnat.</p>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>setShowAdd(!showAdd)} style={{...btn(S.rose),flex:1,padding:"11px 0",fontSize:13}}>+ Lisää ostos</button>
        <button onClick={()=>cameraRef.current?.click()} style={{...btn(S.ink),flex:1,padding:"11px 0",fontSize:12}}>{scanning?"⏳ Luetaan…":"📷 Kamera"}</button>
        <button onClick={()=>galleryRef.current?.click()} style={{...btn(S.ink),flex:1,padding:"11px 0",fontSize:12}}>{scanning?"":"🖼️ Galleria"}</button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleImage}/>
        <input ref={galleryRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImage}/>
      </div>

      {scanErr&&<div style={{...card(S.rs,S.rose),padding:10,marginBottom:10}}><span style={{fontSize:12,color:S.rd}}>{scanErr}</span></div>}

      {showAdd&&(
        <div style={{...card(),marginBottom:12,padding:14}}>
          <div style={{fontSize:13,fontWeight:600,color:S.ink,marginBottom:10}}>Lisää ostos manuaalisesti</div>
          <input type="text" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}
            placeholder="Ostopäivämäärä (pp.kk.vvvv)" inputMode="numeric"
            style={{...inp,width:"100%",marginBottom:8,fontSize:13,padding:"10px 12px"}}/>
          <input value={form.store} onChange={e=>setForm({...form,store:e.target.value})} placeholder="Kauppa (valinnainen)"
            style={{...inp,width:"100%",marginBottom:8,fontSize:13,padding:"10px 12px"}}/>
          <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Tuote / kuvaus"
            style={{...inp,width:"100%",marginBottom:8,fontSize:13,padding:"10px 12px"}}/>
          <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
            <input value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Hinta" inputMode="decimal"
              style={{...inp,flex:1,fontSize:13,padding:"10px 12px",fontFamily:"monospace"}}/>
            <span style={{color:S.mut,fontSize:14}}>€</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={addManual} disabled={!form.name.trim()} style={{...btn(!form.name.trim()?S.brd:S.rose,!form.name.trim()?S.mut:S.wh),flex:1,padding:"11px 0"}}>Tallenna</button>
            <button onClick={()=>setShowAdd(false)} style={{...btn(S.brd,S.mut),flex:1,padding:"11px 0"}}>Peruuta</button>
          </div>
        </div>
      )}

      {hist.length===0&&!showAdd&&(
        <div style={{textAlign:"center",padding:"40px 16px",color:S.mut}}>
          <div style={{fontSize:36,marginBottom:8}}>🛍️</div>
          <div style={{fontSize:13}}>Ei vielä ostoksia. Lisää ensimmäinen!</div>
        </div>
      )}

      {months.map(([key,{label,items}])=>(
        <div key={key} style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:S.mut,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{label}</div>
          {items.map((p,i)=>(
            <div key={i} style={{...card(),padding:"10px 12px",marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:S.ink,lineHeight:1.3}}>{p.name}</div>
                  <div style={{fontSize:11,color:S.mut,marginTop:2}}>
                    {p.date}{p.store?" · "+p.store:""}
                    {p.source==="manual"&&<span style={{marginLeft:6,fontSize:10,background:S.brd,borderRadius:6,padding:"1px 5px"}}>manuaalinen</span>}
                    {p.source==="receipt"&&<span style={{marginLeft:6,fontSize:10,background:S.brd,borderRadius:6,padding:"1px 5px"}}>kuitti</span>}
                  </div>
                </div>
                <div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:S.ink,flexShrink:0}}>{eur(p.price)}</div>
              </div>
            </div>
          ))}
          <div style={{fontSize:11,color:S.mut,textAlign:"right",marginTop:2}}>Yhteensä: <strong style={{fontFamily:"monospace"}}>{eur(items.reduce((s,p)=>s+(p.price||0),0))}</strong></div>
        </div>
      ))}
    </div>
  );
}

/* BUDJETTI */
function ScreenBudjetti({budgetD,setBudgetD,saveBudget,hist}) {
  const now=new Date();
  const curMonth=now.getMonth();
  const curYear=now.getFullYear();
  const spentMonth=hist.filter(p=>{
    const parts=(p.date||"").split(".");
    return parts.length>=3&&parseInt(parts[1])-1===curMonth&&parseInt(parts[2])===curYear;
  }).reduce((s,p)=>s+(p.price||0),0);
  const [editing,setEditing]=useState(false);
  const [input,setInput]=useState(String(budgetD));
  const monthLabel=now.toLocaleDateString("fi-FI",{month:"long",year:"numeric"});
  const over=spentMonth>budgetD;
  const remaining=Math.max(0,budgetD-spentMonth);

  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:4}}>💳 Kuukausibudjetti</h2>
      <p style={{fontSize:12,color:S.mut,marginBottom:12}}>{monthLabel}</p>
      <div style={{...card(),padding:20,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:13,color:S.mut}}>Kuukausibudjetti</span>
          {!editing
            ?<div style={{display:"flex",alignItems:"center",gap:10}}>
               <span style={{fontFamily:"monospace",fontWeight:700,fontSize:18,color:S.ink}}>{eur(budgetD)}</span>
               <button onClick={()=>{setInput(String(budgetD));setEditing(true);}} style={{...btn(S.rs,S.rd),padding:"5px 12px",fontSize:11}}>Muokkaa</button>
             </div>
            :<div style={{display:"flex",alignItems:"center",gap:6}}>
               <input type="text" inputMode="numeric" value={input} onChange={e=>setInput(e.target.value.replace(/[^0-9]/g,""))}
                 style={{fontFamily:"monospace",textAlign:"right",border:"1.5px solid "+S.brd,borderRadius:8,padding:"5px 8px",fontSize:15,color:S.ink,width:70,outline:"none"}}
                 autoFocus onKeyDown={e=>{if(e.key==="Enter"){const v=parseInt(input)||0;setBudgetD(v);saveBudget&&saveBudget(v);setEditing(false);}if(e.key==="Escape")setEditing(false);}}/>
               <span style={{fontFamily:"monospace",color:S.mut}}>€</span>
               <button onClick={()=>{const v=parseInt(input)||0;setBudgetD(v);saveBudget&&saveBudget(v);setEditing(false);}} style={{...btn(S.ink),padding:"5px 12px",fontSize:11}}>OK</button>
             </div>
          }
        </div>
        <div style={{width:"100%",height:10,borderRadius:5,background:S.brd,marginBottom:12}}>
          <div style={{height:10,borderRadius:5,background:over?S.rose:S.grn,width:budgetD>0?Math.min(100,(spentMonth/budgetD)*100)+"%":"0%",transition:"width 0.4s"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{textAlign:"center",padding:"14px 8px",background:S.bg,borderRadius:14}}>
            <div style={{fontSize:11,color:S.mut,marginBottom:4}}>Käytetty</div>
            <div style={{fontFamily:"monospace",fontSize:17,fontWeight:700,color:over?S.rose:S.ink}}>{eur(spentMonth)}</div>
          </div>
          <div style={{textAlign:"center",padding:"14px 8px",background:S.bg,borderRadius:14}}>
            <div style={{fontSize:11,color:S.mut,marginBottom:4}}>{over?"Ylitys":"Jäljellä"}</div>
            <div style={{fontFamily:"monospace",fontSize:17,fontWeight:700,color:over?S.rose:S.grn}}>{over?"+"+eur(spentMonth-budgetD):eur(remaining)}</div>
          </div>
        </div>
        {over&&<p style={{fontSize:11,color:S.rose,marginTop:12,fontWeight:600,textAlign:"center"}}>⚠️ Budjetti ylitetty {eur(spentMonth-budgetD)}</p>}
      </div>
    </div>
  );
}

/* PLUS */
function ScreenPlus({subscription,onActivate,onCancel,onReactivate}) {
  const[showCancelModal,setShowCancelModal]=useState(false);
  const status=subscription?.status||"free";
  const fmt=iso=>iso?new Date(iso).toLocaleDateString("fi-FI",{day:"numeric",month:"long",year:"numeric"}):null;
  const nextBilling=fmt(subscription?.nextBillingDate);
  const startDate=fmt(subscription?.startDate);
  const validUntil=fmt(subscription?.validUntil);
  const cancelledDate=fmt(subscription?.cancelledDate);
  const cancelledStillValid=status==="cancelled"&&subscription?.validUntil&&new Date(subscription.validUntil)>new Date();

  const FEATS=[
    {i:"♾️",t:"Rajattomat live-hakukerrat"},
    {i:"✨",t:"AI-suunnittelija kaikilla työkaluilla"},
    {i:"🏷️",t:"Alennuskoodihaku kaupan omilta sivuilta"},
    {i:"🔄",t:"Ostoslistan optimointi tuorein hinnoin"},
    {i:"📈",t:"Toteutunut säästö -seuranta"},
    {i:"🎯",t:"Henkilökohtaiset tuotesuositukset profiilisi mukaan"},
  ];

  const STYLES=`
    @keyframes plusHeroShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    .plus-hero-bg{background:linear-gradient(135deg,#2B1B2E,#4A1A7A,#7B3FBE,#9D4EDD,#7B3FBE,#4A1A7A);background-size:300% 300%;animation:plusHeroShimmer 6s ease infinite;border-radius:22px;padding:30px 20px 24px;text-align:center;margin-bottom:18px;position:relative;overflow:hidden;}
    @keyframes goldShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    .gold-price-text{background:linear-gradient(90deg,#B8860B,#FFE066,#FFD700,#FFBA08,#FFD700,#FFE066,#B8860B);background-size:300% 100%;animation:goldShimmer 3s ease infinite;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .plus-activate-btn{background:linear-gradient(135deg,#C8960A,#FFD700,#FFBA08,#FFD700,#C8960A)!important;background-size:300% 300%!important;animation:goldShimmer 3s ease infinite!important;color:#3A2000!important;border:none!important;border-radius:16px!important;padding:15px 0!important;width:100%!important;font-size:15px!important;font-weight:500!important;cursor:pointer!important;margin-top:16px!important;box-shadow:0 4px 20px rgba(200,150,10,0.45)!important;font-family:inherit!important;}
    .plus-cancel-link{background:none;border:none;color:#8A7A86;font-size:12px;cursor:pointer;font-family:inherit;text-decoration:underline;display:block;text-align:center;margin-top:14px;padding:4px;}
  `;

  // ── AKTIIVINEN TILAUS ──
  if(status==="active"){
    return(
      <div>
        <style>{STYLES}</style>
        <div className="plus-hero-bg">
          <div style={{fontSize:44,marginBottom:6,filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.3))"}}>👑</div>
          <div style={{fontSize:26,fontWeight:500,color:"#fff",letterSpacing:"-0.3px"}}>Shoppailu <span style={{color:"#FFD700"}}>PLUS+</span></div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(31,164,99,0.25)",border:"1px solid rgba(31,164,99,0.5)",borderRadius:20,padding:"5px 14px",marginTop:10}}>
            <span style={{fontSize:11,color:"#5eff9e",fontWeight:700,letterSpacing:"0.5px"}}>✓ AKTIIVINEN</span>
          </div>
        </div>

        {/* Laskutustiedot */}
        <div style={{...card(),padding:"16px 18px",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:600,color:S.ink,marginBottom:12}}>Tilauksen tiedot</div>
          {[
            ["Tila","Aktiivinen 👑"],
            ["Seuraava veloitus",nextBilling||"—"],
            ["Tilaus alkaen",startDate||"—"],
            ["Hinta",PLUS_PRICE],
          ].map(([label,val])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
              <span style={{fontSize:12,color:S.mut}}>{label}</span>
              <span style={{fontSize:12,fontWeight:600,color:S.ink}}>{val}</span>
            </div>
          ))}
        </div>

        {/* Ominaisuudet */}
        <div style={{...card(),padding:"16px 18px",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:600,color:S.ink,marginBottom:12}}>Mitä tilauksesi sisältää:</div>
          {FEATS.map(({i,t})=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
              <div style={{fontSize:17,width:26,textAlign:"center",flexShrink:0}}>{i}</div>
              <span style={{fontSize:12,color:S.ink,lineHeight:1.3}}>{t}</span>
            </div>
          ))}
        </div>

        <button className="plus-cancel-link" onClick={()=>setShowCancelModal(true)}>Peruuta tilaus</button>

        {/* Peruutusmodaali */}
        {showCancelModal&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:S.wh,borderRadius:20,padding:"24px 20px",maxWidth:340,width:"100%",boxShadow:"0 8px 40px rgba(0,0,0,0.2)"}}>
              <div style={{fontSize:22,textAlign:"center",marginBottom:8}}>😔</div>
              <div style={{fontSize:16,fontWeight:700,color:S.ink,textAlign:"center",marginBottom:10}}>Peruuta Plus-tilaus?</div>
              <p style={{fontSize:13,color:S.mut,lineHeight:1.5,textAlign:"center",margin:"0 0 18px"}}>
                Plus-ominaisuudet säilyvät käytettävissäsi <strong style={{color:S.ink}}>{nextBilling}</strong> saakka. Tämän jälkeen tilisi palaa ilmaisversioon.
              </p>
              <button
                onClick={()=>{onCancel();setShowCancelModal(false);}}
                style={{width:"100%",...btn(S.rs,S.rd),padding:"12px 0",fontSize:13,marginBottom:10}}
              >Kyllä, peruuta tilaus</button>
              <button
                onClick={()=>setShowCancelModal(false)}
                style={{width:"100%",...btn("#2B1B2E","#FFD700"),padding:"12px 0",fontSize:13,fontWeight:700}}
              >Pidä Plus-tilaus 👑</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PERUTTU MUTTA VOIMASSA ──
  if(cancelledStillValid){
    return(
      <div>
        <style>{STYLES}</style>
        <div className="plus-hero-bg">
          <div style={{fontSize:44,marginBottom:6,filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.3))"}}>👑</div>
          <div style={{fontSize:26,fontWeight:500,color:"#fff",letterSpacing:"-0.3px"}}>Shoppailu <span style={{color:"#FFD700"}}>PLUS+</span></div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,201,64,0.2)",border:"1px solid rgba(255,201,64,0.4)",borderRadius:20,padding:"5px 14px",marginTop:10}}>
            <span style={{fontSize:11,color:"#FFE066",fontWeight:700,letterSpacing:"0.5px"}}>⏳ PERUTTU — voimassa {validUntil} asti</span>
          </div>
        </div>

        <div style={{...card(S.ys,S.at),padding:"14px 16px",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600,color:S.at,marginBottom:4}}>Tilauksesi on peruttu {cancelledDate}.</div>
          <div style={{fontSize:12,color:S.at,lineHeight:1.5}}>Pääset käyttämään kaikkia Plus-ominaisuuksia <strong>{validUntil}</strong> saakka. Sen jälkeen tilisi palaa ilmaisversioon.</div>
        </div>

        {/* Ominaisuudet */}
        <div style={{...card(),padding:"16px 18px",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:S.ink,marginBottom:12}}>Tilauksesi sisältää:</div>
          {FEATS.map(({i,t})=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
              <div style={{fontSize:17,width:26,textAlign:"center",flexShrink:0}}>{i}</div>
              <span style={{fontSize:12,color:S.ink,lineHeight:1.3}}>{t}</span>
            </div>
          ))}
        </div>

        <button className="plus-activate-btn" onClick={onReactivate}>Jatka Plus-tilausta →</button>
        <div style={{fontSize:11,color:S.mut,textAlign:"center",marginTop:8}}>Uusi laskutuskausi alkaa heti, {PLUS_PRICE}</div>
      </div>
    );
  }

  // ── VANHENTUNUT tai EI TILAUSTA (osto-näkymä) ──
  return(
    <div>
      <style>{STYLES}</style>
      <div className="plus-hero-bg">
        <div style={{fontSize:44,marginBottom:6,filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.3))"}}>👑</div>
        <div style={{fontSize:26,fontWeight:500,color:"#fff",letterSpacing:"-0.3px"}}>Shoppailu PLUS <span style={{color:"#FFD700"}}>+</span></div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",marginTop:6,marginBottom:20}}>{status==="expired"?"Tilauksesi on vanhentunut — aktivoi uudelleen.":"Osta fiksummin, säästä ja saa enemmän."}</div>
        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:16,padding:"14px 24px",display:"inline-block",backdropFilter:"blur(4px)"}}>
          <span className="gold-price-text" style={{fontSize:42,fontWeight:400}}>{PLUS_PRICE_SHORT}</span>
          <span style={{fontSize:14,color:"rgba(255,255,255,0.65)",marginLeft:6}}>/kk</span>
        </div>
        <div style={{marginTop:10,fontSize:11,color:"rgba(255,255,255,0.5)"}}>7 päivän ilmainen kokeilu · Peru milloin tahansa</div>
      </div>

      <div style={{...card(),padding:"18px 20px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:500,color:S.ink,marginBottom:14}}>Mitä saat PLUS+-tilauksella:</div>
        {FEATS.map(({i,t})=>(
          <div key={t} style={{display:"flex",alignItems:"center",gap:12,marginBottom:11}}>
            <div style={{fontSize:19,width:28,textAlign:"center",flexShrink:0}}>{i}</div>
            <span style={{fontSize:13,color:S.ink,fontWeight:400,lineHeight:1.3}}>{t}</span>
          </div>
        ))}
      </div>

      <button className="plus-activate-btn" onClick={onActivate}>
        {status==="expired"?"Aktivoi Plus uudelleen →":"Aloita ilmainen kokeilu →"}
      </button>
    </div>
  );
}

/* PROFIILI */
const PROFILE_CATS=[
  {key:'hiuksetTags',icon:'🧴',label:'Hiukset',subcats:[
    {label:'Hiusten rakenne',options:['Suorat hiukset','Loivasti laineikkaat hiukset','Kiharat hiukset','Erittäin kiharat hiukset','Ohuet / hennot hiukset','Paksut hiukset']},
    {label:'Hiuspohja',options:['Normaali hiuspohja','Kuiva hiuspohja','Herkkä hiuspohja','Rasvoittuva hiuspohja','Hilseilevä hiuspohja','Kutiseva hiuspohja']},
    {label:'Hiusten kunto',options:['Kuivat hiukset','Vaurioituneet hiukset','Katkeilevat hiukset','Haaroittuvat latvat','Pörröiset hiukset','Takkuuntuvat hiukset','Elottomat / kiillottomat hiukset','Huokoiset hiukset']},
    {label:'Käsitellyt hiukset',options:['Värjätyt hiukset','Vaaleat / blondatut hiukset','Raidoitetut hiukset','Valkaistut hiukset','Kemiallisesti käsitellyt hiukset','Permanentatut hiukset']},
    {label:'Hiusten tarpeet',options:['Tuuheutta kaipaavat hiukset','Kosteutusta kaipaavat hiukset','Korjausta kaipaavat hiukset','Kiharien korostaminen','Pörröisyyden hallinta','Värin ylläpito','Lämpösuojan tarve','Auringolta suojaaminen']},
  ]},
  {key:'kosmetiikkaTags',icon:'💄',label:'Kosmetiikka',subcats:[
    {label:'Ihotyyppi',options:['Normaali iho','Kuiva iho','Rasvoittuva iho','Yhdistelmäiho','Herkkä iho']},
    {label:'Ihon tarpeet',options:['Akneen taipuvainen iho','Epäpuhtauksiin taipuvainen iho','Mustapäät','Laajentuneet ihohuokoset','Pintakuivuus','Samea iho','Epätasainen ihonsävy','Pigmenttiläiskät','Tummat läiskät','Punoitus','Epätasainen ihon rakenne','Hienot juonteet','Rypyt','Ihon kimmoisuuden väheneminen','Ikääntyvä / kypsyvä iho','Ihon suojabarrierin vahvistaminen','Kosteutuksen tarve','Heleyden tarve']},
    {label:'Erityistarpeet',options:['Erittäin herkkä iho','Hajusteherkkyys','Hajusteettomien tuotteiden suosiminen','Ei-komedogeenisten tuotteiden suosiminen','Rosacea-/couperosa-taipumus']},
  ]},
  {key:'tyyliTags',icon:'👗',label:'Tyyli',subcats:[
    {label:'Päätyyli',options:['Klassinen','Minimalistinen','Rento / casual','Elegantti','Juhlava','Sporttinen','Athleisure','Boheemi / boho','Romanttinen','Naisellinen','Streetwear','Trendikäs','Vintage','Retro','Preppy','Edgy / rock','Business / office','Scandi / skandinaavinen','Y2K']},
    {label:'Käyttötarkoitus',options:['Arkeen','Töihin','Toimistolle','Vapaa-ajalle','Treeneihin','Ulkoiluun','Treffeille','Juhliin','Häihin','Lomalle','Matkustamiseen','Ilta-/ravintolakäyttöön']},
    {label:'Istuvuus',options:['Istuvat vaatteet','Väljä / oversize','Rennosti istuva','Slim fit','Regular fit','Korostettu vyötärö','Pitkät mallit','Lyhyet mallit']},
    {label:'Värit ja kuosit',options:['Neutraalit värit','Musta','Valkoinen','Beige / ruskeat','Harmaa','Pastellit','Kirkkaat värit','Tummat sävyt','Kuviolliset','Yksiväriset']},
  ]},
];

const MITAT_FIELDS=[["Pituus","pituus","cm"],["Rinnanympärys","rinta","cm"],["Vyötärö","vyotaro","cm"],["Lantio","lantio","cm"],["Vaatekoko","vaatekoko",""],["Kengän koko","kengankoko",""],["Ihon sävy","ihonsavy",""],["Hiusten väri","hiustenvari",""]];

function ScreenProfiili({profile,setProfile,auth,onNameChange,changePassword,changeEmail,onLogout,hist,savings,listN,isPlus,budgetD,setBudgetD,saveBudget,deleteAccount,onGoPlus,onGoSaastot,onGoOstokset,onGoBudjetti,onGoOstoslista}) {
  const setM=(k,v)=>setProfile({...profile,mitat:{...profile.mitat,[k]:v}});
  const now=new Date();
  const spentMonth=hist.filter(p=>{const parts=(p.date||"").split(".");return parts.length>=3&&parseInt(parts[1])-1===now.getMonth()&&parseInt(parts[2])===now.getFullYear();}).reduce((s,p)=>s+(p.price||0),0);

  // Avatar
  const initials=(auth.name||"?").split(" ").map(w=>w[0]||"").join("").toUpperCase().slice(0,2)||"?";
  const AVATAR_COLORS=["#E8447F","#6B2FBE","#1FA463","#E8760A","#0088CC"];
  const avatarBg=AVATAR_COLORS[(auth.name||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0)%AVATAR_COLORS.length];

  // Jäsen alkaen
  const memberSince=auth.memberSince?new Date(auth.memberSince).toLocaleDateString("fi-FI",{month:"long",year:"numeric"}):null;
  const[settingsOpen,setSettingsOpen]=useState(null);
  const[nameF,setNameF]=useState(auth.name);
  const[pwF,setPwF]=useState({cur:"",new1:"",new2:""});
  const[pwErr,setPwErr]=useState("");
  const[pwResetSent,setPwResetSent]=useState(false);
  const[emailF,setEmailF]=useState({cur:"",new:""});
  const[emailErr,setEmailErr]=useState("");
  const[emailOk,setEmailOk]=useState(false);
  const[delEmail,setDelEmail]=useState("");
  const[delPw,setDelPw]=useState("");
  const[delErr,setDelErr]=useState("");
  const[delConfirm,setDelConfirm]=useState(false);
  const[delLoading,setDelLoading]=useState(false);
  const[toast,setToast]=useState("");
  const[editCat,setEditCat]=useState(null);
  const[openSubcat,setOpenSubcat]=useState(null);
  const[pendingTags,setPendingTags]=useState({});
  const flash=m=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const[accountEditOpen,setAccountEditOpen]=useState(false);
  const[appSettingsOpen,setAppSettingsOpen]=useState(false);

  const startEdit=(catKey)=>{setPendingTags({[catKey]:[...(profile[catKey]||[])]});setEditCat(catKey);setOpenSubcat(null);};
  const togglePending=(catKey,opt)=>{const cur=pendingTags[catKey]||[];setPendingTags({...pendingTags,[catKey]:cur.includes(opt)?cur.filter(x=>x!==opt):[...cur,opt]});};
  const saveEdit=()=>{if(!editCat)return;const np={...profile,[editCat]:pendingTags[editCat]||[]};setProfile(np);setEditCat(null);flash("Tallennettu ✓");};
  const cancelEdit=()=>{setEditCat(null);setOpenSubcat(null);};

  // Muokkaustila — yksittäinen kategoria
  if(editCat){
    const cat=PROFILE_CATS.find(c=>c.key===editCat);
    if(!cat)return null;
    const curTags=pendingTags[editCat]||[];
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <button onClick={cancelEdit} style={{background:"none",border:"none",color:S.rd,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:FF}}>← Takaisin</button>
          <span style={{fontSize:17,fontWeight:700,color:S.ink}}>{cat.icon} {cat.label}</span>
        </div>
        {cat.subcats.map(sub=>{
          const selInSub=curTags.filter(t=>sub.options.includes(t)).length;
          const isOpen=openSubcat===sub.label;
          return(
            <div key={sub.label} style={{...card(),padding:0,overflow:"hidden",marginBottom:8}}>
              <button onClick={()=>setOpenSubcat(isOpen?null:sub.label)}
                style={{width:"100%",padding:"12px 14px",background:S.wh,border:"none",textAlign:"left",fontSize:13,fontWeight:600,color:S.ink,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:FF}}>
                <span>{sub.label}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {selInSub>0&&<span style={{background:S.rs,color:S.rd,fontSize:10,fontWeight:700,borderRadius:10,padding:"2px 8px"}}>{selInSub} valittu</span>}
                  <span style={{color:S.mut,fontSize:12}}>{isOpen?"▲":"▶"}</span>
                </div>
              </button>
              {isOpen&&(
                <div style={{padding:"12px 14px",borderTop:"1px solid "+S.brd,background:S.bg,display:"flex",flexWrap:"wrap",gap:8}}>
                  {sub.options.map(opt=>{
                    const sel=curTags.includes(opt);
                    return(
                      <button key={opt} onClick={()=>togglePending(editCat,opt)}
                        style={{padding:"8px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FF,border:"1.5px solid "+(sel?S.rose:S.brd),background:sel?S.rs:S.wh,color:sel?S.rd:S.ink,transition:"all 0.15s"}}>
                        {sel&&"✓ "}{opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {curTags.length>0&&(
          <div style={{...card(S.rs,S.brd),padding:12,marginBottom:8}}>
            <p style={{fontSize:11,color:S.mut,margin:"0 0 6px",fontWeight:600}}>Valitut ({curTags.length}):</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {curTags.map(t=>(
                <span key={t} style={{background:S.wh,color:S.rd,borderRadius:14,padding:"5px 10px",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,border:"1px solid "+S.brd}}>
                  {t}
                  <button onClick={()=>togglePending(editCat,t)} style={{background:"none",border:"none",cursor:"pointer",color:S.mut,fontSize:10,padding:0}}>✕</button>
                </span>
              ))}
            </div>
          </div>
        )}
        <button onClick={saveEdit} style={{...btn(S.rose),width:"100%",padding:"13px 0",fontSize:14,marginTop:4}}>✓ Valmis — tallenna valinnat</button>
        <button onClick={cancelEdit} style={{width:"100%",padding:"10px 0",background:"none",border:"none",color:S.mut,fontSize:12,cursor:"pointer",fontFamily:FF,marginTop:6}}>Peruuta muutokset</button>
      </div>
    );
  }

  // Data-export
  const exportData=()=>{
    const data={nimi:auth.name,sahkoposti:auth.email,ostohistoria:hist,profiili:profile,budjetti:budgetD,kokonaissaasto:savings,vietyAika:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="shoppailu-plus-tiedot.json";a.click();URL.revokeObjectURL(url);
  };

  // Katselutila
  // Kategoriat järjestyksessä: Kosmetiikka, Hiukset, Tyyli
  const ORDERED_CATS=[PROFILE_CATS[1],PROFILE_CATS[0],PROFILE_CATS[2]];
  const sectionLabel=(icon,text)=>(
    <div style={{fontSize:12,fontWeight:700,color:S.mut,letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:8,marginTop:20,paddingBottom:4,borderBottom:"1px solid "+S.brd}}>{icon} {text}</div>
  );

  return(
    <div>
      {toast&&<div style={{...card(S.gs,S.grn),marginBottom:10,padding:10}}><span style={{fontWeight:600,fontSize:12,color:S.grn}}>✓ {toast}</span></div>}
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:16}}>👤 Oma profiili</h2>

      {/* ── 1. SHOPPAILU PLUS ── */}
      <div onClick={onGoPlus} style={{background:"linear-gradient(135deg,#2B1B2E,#4A1A7A,#7B3FBE,#9D4EDD)",borderRadius:18,padding:"14px 16px",marginBottom:4,cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
        <div style={{fontSize:28,filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.3))"}}>👑</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,color:"#fff"}}>Shoppailu <span style={{color:"#FFD700"}}>PLUS+</span></div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.65)",marginTop:2}}>{isPlus?"Tilauksesi on aktiivinen":`${PLUS_PRICE} · Peru milloin tahansa`}</div>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.8)",fontWeight:500,flexShrink:0}}>{isPlus?"Hallitse →":"Aktivoi →"}</div>
      </div>

      {/* ── 2. OSTOKSET JA TALOUS ── */}
      {sectionLabel("🛍️","Ostokset ja talous")}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
        {[
          {icon:"📈",label:"Säästetty",val:eur(savings),color:S.grn,onClick:onGoSaastot},
          {icon:"🛍️",label:"Ostokset",val:hist.length+" kpl",color:S.rose,onClick:onGoOstokset},
          {icon:"📋",label:"Ostoslista",val:listN+" tuotetta",color:S.ink,onClick:onGoOstoslista},
          {icon:"💳",label:"Budjetti",val:eur(budgetD),sub:spentMonth>budgetD?"⚠️ "+eur(spentMonth)+" käytetty":eur(spentMonth)+" käytetty",subColor:spentMonth>budgetD?S.rose:S.mut,color:S.at,onClick:onGoBudjetti},
        ].map(({icon,label,val,sub,subColor,color,onClick})=>(
          <div key={label} onClick={onClick} style={{...card(),padding:"12px 14px",marginBottom:0,cursor:onClick?"pointer":"default"}}>
            <div style={{fontSize:16,marginBottom:4}}>{icon}</div>
            <div style={{fontSize:11,color:S.mut,marginBottom:2}}>{label}</div>
            <div style={{fontSize:15,fontWeight:600,color}}>{val}</div>
            {sub&&<div style={{fontSize:10,color:subColor||S.mut,marginTop:2}}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── 3. OMA TYYLI JA KAUNEUS ── */}
      {sectionLabel("✨","Oma tyyli ja kauneus")}
      {ORDERED_CATS.map(cat=>{
        const tags=profile[cat.key]||[];
        return(
          <div key={cat.key} style={{...card(),marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:tags.length>0?10:0}}>
              <span style={{fontSize:13,fontWeight:700,color:S.ink}}>{cat.icon} {cat.label}</span>
              <button onClick={()=>startEdit(cat.key)} style={{background:"none",border:"1px solid "+S.brd,borderRadius:10,padding:"5px 13px",fontSize:11.5,color:S.rd,cursor:"pointer",fontFamily:FF,fontWeight:600}}>Muokkaa</button>
            </div>
            {tags.length===0&&<p style={{fontSize:11,color:S.mut,margin:0}}>Ei valintoja — paina Muokkaa lisätäksesi.</p>}
            {tags.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {tags.map(t=><span key={t} style={{background:S.rs,color:S.rd,borderRadius:14,padding:"5px 10px",fontSize:11,fontWeight:600}}>{t}</span>)}
            </div>}
          </div>
        );
      })}

      {/* ── 4. HENKILÖTIEDOT ── */}
      {sectionLabel("👤","Henkilötiedot")}
      <div style={{...card(),padding:"14px 16px",marginBottom:4}}>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:S.mut,marginBottom:8}}>Sukupuoli {!profile.sukupuoli&&<span style={{color:S.rose,fontSize:11}}>* pakollinen</span>}</div>
          <div style={{display:"flex",gap:8}}>
            {[["Nainen","👩"],["Mies","👨"]].map(([g,icon])=>(
              <button key={g} onClick={()=>{const np={...profile,sukupuoli:g};setProfile(np);}}
                style={{flex:1,padding:"10px 0",borderRadius:14,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:FF,
                  border:"2px solid "+(profile.sukupuoli===g?S.rose:S.brd),
                  background:profile.sukupuoli===g?S.rs:S.wh,
                  color:profile.sukupuoli===g?S.rd:S.ink,transition:"all 0.15s"}}>
                {icon} {g}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:S.mut,marginBottom:8}}>Ikäryhmä <span style={{fontWeight:400,fontSize:11}}>(valinnainen)</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {["alle 18","18–25","26–35","36–45","46–55","56+"].map(a=>(
              <button key={a} onClick={()=>{const np={...profile,ikaryhma:profile.ikaryhma===a?"":a};setProfile(np);}}
                style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FF,
                  border:"1.5px solid "+(profile.ikaryhma===a?S.rose:S.brd),
                  background:profile.ikaryhma===a?S.rs:S.wh,
                  color:profile.ikaryhma===a?S.rd:S.ink,transition:"all 0.15s"}}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. OMAT MITAT JA TIEDOT ── */}
      {sectionLabel("📏","Omat mitat ja tiedot")}
      <div style={{...card(),padding:0,marginBottom:4}}>
        {MITAT_FIELDS.map(([l,k,u],idx)=>{
          const raw=profile.mitat?.[k]||"";
          const safeVal=(raw.includes('@')||raw.length>50)?"":raw;
          return(
            <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:idx<MITAT_FIELDS.length-1?"1px solid "+S.brd:"none"}}>
              <span style={{fontSize:12.5,color:S.ink}}>{l}</span>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <input value={safeVal} onChange={e=>setM(k,e.target.value)} placeholder="—"
                  style={{fontFamily:"monospace",textAlign:"right",outline:"none",border:"none",background:"transparent",fontSize:13,color:S.ink,width:80}}/>
                {u&&<span style={{fontSize:11,color:S.mut}}>{u}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{fontSize:10.5,color:S.mut,marginTop:4,marginBottom:4}}>Kaikki kentät ovat vapaaehtoisia ja yksityisiä.</p>

      {/* ── 6. OMIEN TIETOJEN MUOKKAAMINEN ── */}
      {sectionLabel("🔧","Omien tietojen muokkaaminen")}
      <div style={{...card(),padding:0,overflow:"hidden",marginBottom:4}}>
        {/* Accordion-otsikko */}
        <button onClick={()=>{setAccountEditOpen(!accountEditOpen);if(accountEditOpen)setSettingsOpen(null);}}
          style={{width:"100%",padding:"13px 16px",background:S.wh,border:"none",textAlign:"left",fontSize:13,color:S.ink,cursor:"pointer",fontFamily:FF,display:"flex",justifyContent:"space-between",alignItems:"center",fontWeight:500}}>
          <span>Muokkaa tilitietoja</span>
          <span style={{color:S.mut,fontSize:13}}>{accountEditOpen?"▲":"▶"}</span>
        </button>
        {accountEditOpen&&<div style={{borderTop:"1px solid "+S.brd}}>
          {/* Muokkaa nimeä */}
          <button onClick={()=>setSettingsOpen(settingsOpen==="edit"?null:"edit")}
            style={{width:"100%",padding:"12px 16px",background:S.bg,border:"none",borderBottom:"1px solid "+S.brd,textAlign:"left",fontSize:12.5,color:S.ink,cursor:"pointer",fontFamily:FF,display:"flex",justifyContent:"space-between"}}>
            <span>✏️ Muokkaa nimeä</span><span style={{color:S.mut}}>{settingsOpen==="edit"?"▲":"▶"}</span>
          </button>
          {settingsOpen==="edit"&&<div style={{padding:"12px 16px",background:S.wh,borderBottom:"1px solid "+S.brd}}>
            <input value={nameF} onChange={e=>setNameF(e.target.value)} placeholder="Nimi" style={{...inp,width:"100%",marginBottom:8}}/>
            <button onClick={async()=>{if(onNameChange)await onNameChange(nameF);flash("Nimi päivitetty.");}} style={{...btn(S.ink),width:"100%"}}>Tallenna</button>
          </div>}

          {auth.loggedIn&&<>
            {/* Vaihda salasana */}
            <button onClick={()=>{setSettingsOpen(settingsOpen==="pw"?null:"pw");setPwErr("");setPwResetSent(false);}}
              style={{width:"100%",padding:"12px 16px",background:S.bg,border:"none",borderBottom:"1px solid "+S.brd,textAlign:"left",fontSize:12.5,color:S.ink,cursor:"pointer",fontFamily:FF,display:"flex",justifyContent:"space-between"}}>
              <span>🔑 Vaihda salasana</span><span style={{color:S.mut}}>{settingsOpen==="pw"?"▲":"▶"}</span>
            </button>
            {settingsOpen==="pw"&&<div style={{padding:"12px 16px",background:S.wh,borderBottom:"1px solid "+S.brd}}>
              <input type="password" value={pwF.cur} onChange={e=>{setPwF({...pwF,cur:e.target.value});setPwErr("");}} placeholder="Nykyinen salasana" style={{...inp,width:"100%",marginBottom:6}}/>
              <button onClick={async()=>{if(!auth.email)return;try{await sendPasswordResetEmail(fbAuth,auth.email);setPwResetSent(true);setPwErr("");}catch{setPwErr("Virhe. Yritä uudelleen.");}}} style={{background:"none",border:"none",color:S.mut,fontSize:11.5,textDecoration:"underline",cursor:"pointer",fontFamily:FF,marginBottom:10,padding:0}}>Unohtuiko salasanasi?</button>
              {pwResetSent&&<p style={{fontSize:11,color:S.grn,marginBottom:8}}>✓ Palautuslinkki lähetetty sähköpostiisi.</p>}
              <input type="password" value={pwF.new1} onChange={e=>{setPwF({...pwF,new1:e.target.value});setPwErr("");}} placeholder="Uusi salasana (väh. 6 merkkiä)" style={{...inp,width:"100%",marginBottom:6}}/>
              <input type="password" value={pwF.new2} onChange={e=>{setPwF({...pwF,new2:e.target.value});setPwErr("");}} placeholder="Vahvista uusi salasana" style={{...inp,width:"100%",marginBottom:8}}/>
              {pwErr&&<p style={{fontSize:11,color:S.rose,marginBottom:6}}>{pwErr}</p>}
              <button disabled={!pwF.cur||pwF.new1.length<6||pwF.new1!==pwF.new2} onClick={async()=>{
                if(pwF.new1!==pwF.new2){setPwErr("Uudet salasanat eivät täsmää.");return;}
                const err=await changePassword(pwF.cur,pwF.new1);
                if(err){setPwErr(err);}else{setPwF({cur:"",new1:"",new2:""});setPwErr("");flash("Salasana vaihdettu ✓");}
              }} style={{...btn(!pwF.cur||pwF.new1.length<6||pwF.new1!==pwF.new2?S.brd:S.ink,!pwF.cur||pwF.new1.length<6||pwF.new1!==pwF.new2?S.mut:S.wh),width:"100%"}}>Vaihda salasana</button>
            </div>}

            {/* Vaihda sähköposti */}
            <button onClick={()=>{setSettingsOpen(settingsOpen==="email"?null:"email");setEmailErr("");setEmailOk(false);}}
              style={{width:"100%",padding:"12px 16px",background:S.bg,border:"none",borderBottom:"1px solid "+S.brd,textAlign:"left",fontSize:12.5,color:S.ink,cursor:"pointer",fontFamily:FF,display:"flex",justifyContent:"space-between"}}>
              <span>📧 Vaihda sähköposti</span><span style={{color:S.mut}}>{settingsOpen==="email"?"▲":"▶"}</span>
            </button>
            {settingsOpen==="email"&&<div style={{padding:"12px 16px",background:S.wh,borderBottom:"1px solid "+S.brd}}>
              <p style={{fontSize:11,color:S.mut,marginBottom:8}}>Nykyinen: <strong>{auth.email}</strong></p>
              <input type="password" value={emailF.cur} onChange={e=>{setEmailF({...emailF,cur:e.target.value});setEmailErr("");}} placeholder="Nykyinen salasana" style={{...inp,width:"100%",marginBottom:6}}/>
              <input type="email" value={emailF.new} onChange={e=>{setEmailF({...emailF,new:e.target.value});setEmailErr("");}} placeholder="Uusi sähköpostiosoite" style={{...inp,width:"100%",marginBottom:8}}/>
              {emailErr&&<p style={{fontSize:11,color:S.rose,marginBottom:6}}>{emailErr}</p>}
              {emailOk&&<p style={{fontSize:11,color:S.grn,marginBottom:6}}>✓ Vahvistuslinkki lähetetty uuteen sähköpostiin. Avaa se vahvistaaksesi vaihdon.</p>}
              <button disabled={!emailF.cur||!emailF.new} onClick={async()=>{
                const err=await changeEmail(emailF.cur,emailF.new);
                if(err){setEmailErr(err);}else{setEmailOk(true);setEmailF({cur:"",new:""});}
              }} style={{...btn(!emailF.cur||!emailF.new?S.brd:S.ink,!emailF.cur||!emailF.new?S.mut:S.wh),width:"100%"}}>Lähetä vahvistuslinkki uuteen sähköpostiin</button>
            </div>}
          </>}

          {/* Poista tili — erotettu punaisella reunalla */}
          <div style={{borderTop:"2px solid "+S.rs}}>
            <button onClick={()=>{setSettingsOpen(settingsOpen==="del"?null:"del");setDelEmail("");setDelPw("");setDelErr("");}}
              style={{width:"100%",padding:"12px 16px",background:"#FFF5F7",border:"none",textAlign:"left",fontSize:12.5,color:S.rose,cursor:"pointer",fontFamily:FF,display:"flex",justifyContent:"space-between",fontWeight:600}}>
              <span>🗑️ Poista tili</span><span style={{color:S.rose}}>{settingsOpen==="del"?"▲":"▶"}</span>
            </button>
            {settingsOpen==="del"&&<div style={{padding:"12px 16px",background:"#FFF5F7"}}>
              <p style={{fontSize:11.5,color:S.rose,marginBottom:8}}>⚠️ Poistaa profiilin, suosikit, ostoslistan ja historian pysyvästi.</p>
              {auth.loggedIn&&<><input value={delEmail} onChange={e=>{setDelEmail(e.target.value);setDelErr("");}} placeholder="Sähköpostiosoite" type="email" style={{...inp,width:"100%",marginBottom:8}}/><input type="password" value={delPw} onChange={e=>{setDelPw(e.target.value);setDelErr("");}} placeholder="Salasana" style={{...inp,width:"100%",marginBottom:8}}/></>}
              {delErr&&<p style={{fontSize:11,color:S.rose,marginBottom:6}}>{delErr}</p>}
              <button disabled={auth.loggedIn&&(!delPw||!delEmail)} onClick={async()=>{
                if(auth.loggedIn){
                  setDelLoading(true);setDelErr("");
                  const err=await deleteAccount(delEmail,delPw,true);
                  setDelLoading(false);
                  if(err){setDelErr(err);}else{setDelConfirm(true);}
                }else{setDelConfirm(true);}
              }} style={{...btn((auth.loggedIn&&(!delPw||!delEmail))?S.brd:S.rose,(auth.loggedIn&&(!delPw||!delEmail))?S.mut:S.wh),width:"100%"}}>
                {delLoading?"⏳ Tarkistetaan…":"Poista tili pysyvästi"}
              </button>
              {delConfirm&&(
                <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(43,27,46,0.7)",backdropFilter:"blur(4px)",padding:24}}>
                  <div style={{background:S.wh,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:360,boxShadow:"0 20px 50px rgba(0,0,0,0.3)"}}>
                    <div style={{fontSize:36,textAlign:"center",marginBottom:12}}>⚠️</div>
                    <div style={{fontSize:17,fontWeight:700,color:S.ink,textAlign:"center",marginBottom:8}}>Poistetaanko tilisi varmasti?</div>
                    <p style={{fontSize:13,color:S.mut,textAlign:"center",lineHeight:1.6,marginBottom:24}}>Tilin poistaminen on pysyvää, eikä sitä voi perua. Kaikki tietosi poistetaan.</p>
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={()=>setDelConfirm(false)} style={{flex:1,...btn(S.brd,S.ink),padding:"11px 0"}}>Peruuta</button>
                      <button onClick={async()=>{
                        setDelLoading(true);
                        const err=await deleteAccount(delEmail,delPw,false);
                        setDelLoading(false);
                        if(err){setDelConfirm(false);setDelErr(err);}
                      }} style={{flex:1,...btn(S.rose,S.wh),padding:"11px 0"}}>
                        {delLoading?"⏳ Poistetaan…":"Poista tili"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>}
          </div>
        </div>}
      </div>

      {/* ── 7. TILIN PERUSTIEDOT ── */}
      {sectionLabel("ℹ️","Tilin perustiedot")}
      {auth.loggedIn&&<div style={{...card(),padding:"14px 16px",marginBottom:4}}>
        {[
          {label:"Nimi",val:auth.name||"—"},
          {label:"Sähköposti",val:auth.email||"—"},
          {label:"Tila",val:isPlus?"👑 PLUS+":"FREE",valColor:isPlus?"#7B3FBE":S.mut,valBg:isPlus?"#F0E6FF":S.rs},
          {label:"Sähköposti",val:auth.emailVerified?"✓ Vahvistettu":"⚠️ Vahvistamatta",valColor:auth.emailVerified?S.grn:S.rose},
          {label:"Jäsen alkaen",val:memberSince||"—"},
        ].map(({label,val,valColor,valBg},i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<4?"1px solid "+S.brd:"none"}}>
            <span style={{fontSize:12,color:S.mut}}>{label}</span>
            {valBg
              ? <span style={{fontSize:11,fontWeight:700,color:valColor||S.ink,background:valBg,borderRadius:10,padding:"2px 9px"}}>{val}</span>
              : <span style={{fontSize:12.5,fontWeight:600,color:valColor||S.ink}}>{val}</span>
            }
          </div>
        ))}
      </div>}

      {/* ── 8. KIRJAUDU ULOS ── */}
      <button onClick={onLogout} style={{width:"100%",...btn(S.brd,S.ink),padding:"13px 0",fontSize:13,marginBottom:4,marginTop:4}}>Kirjaudu ulos</button>

      {/* ── 9. SOVELLUKSEN ASETUKSET ── */}
      {sectionLabel("⚙️","Sovelluksen asetukset")}
      <div style={{...card(),padding:0,overflow:"hidden",marginBottom:12}}>
        <button onClick={()=>setAppSettingsOpen(!appSettingsOpen)}
          style={{width:"100%",padding:"13px 16px",background:S.wh,border:"none",textAlign:"left",fontSize:13,color:S.ink,cursor:"pointer",fontFamily:FF,display:"flex",justifyContent:"space-between",alignItems:"center",fontWeight:500}}>
          <span>⚙️ Asetukset</span>
          <span style={{color:S.mut,fontSize:13}}>{appSettingsOpen?"▲":"▶"}</span>
        </button>
        {appSettingsOpen&&<div style={{borderTop:"1px solid "+S.brd}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",borderBottom:"1px solid "+S.brd}}>
            <div>
              <div style={{fontSize:12.5,color:S.ink,fontWeight:500}}>💸 Budjettivaroitus</div>
              <div style={{fontSize:11,color:S.mut,marginTop:1}}>Ilmoita kun kuukausibudjetti ylittyy</div>
            </div>
            <button onClick={()=>setProfile({...profile,alertBudget:!profile.alertBudget})}
              style={{width:44,height:24,borderRadius:12,background:profile.alertBudget?S.grn:S.brd,border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <span style={{position:"absolute",top:3,left:profile.alertBudget?22:3,width:18,height:18,borderRadius:9,background:S.wh,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
            </button>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px"}}>
            <div>
              <div style={{fontSize:12.5,color:S.ink,fontWeight:500}}>📥 Lataa omat tiedot</div>
              <div style={{fontSize:11,color:S.mut,marginTop:1}}>Vie historia ja profiili JSON-tiedostona</div>
            </div>
            <button onClick={exportData} style={{...btn(S.ink),fontSize:11,padding:"6px 12px"}}>Lataa</button>
          </div>
        </div>}
      </div>

      {/* Sovelluksen tiedot */}
      <div style={{textAlign:"center",padding:"12px 0 8px",borderTop:"1px solid "+S.brd,marginTop:4}}>
        <div style={{fontSize:13,fontWeight:600,color:S.ink}}>Shoppailu <span style={{color:S.rose}}>PLUS</span></div>
        <div style={{fontSize:10.5,color:S.mut,marginTop:3}}>Versio 1.0 · Tietosuoja · Käyttöehdot</div>
        <div style={{fontSize:10,color:S.brd,marginTop:4}}>© 2026 Shoppailu PLUS. Kaikki oikeudet pidätetään.</div>
      </div>
    </div>
  );
}

/* ── AUTH ── */
function Auth({onSkip,unverifiedUser,onUnverifiedCleared}) {
  const[mode,setMode]=useState("register");
  const[f,setF]=useState({name:"",email:"",pw:""});
  const[stayLoggedIn,setStayLoggedIn]=useState(false);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[resetSent,setResetSent]=useState(false);
  // verifyPending: {email, pw?} — pw voi puuttua jos käyttäjä avasi sovelluksen uudelleen
  const[verifyPending,setVerifyPending]=useState(null);
  const[resendCooldown,setResendCooldown]=useState(0);
  const resendTimerRef=useRef(null);
  const[resendOk,setResendOk]=useState(false);

  // Jos unverifiedUser saapuu propseissa (sovelluksen uudelleenavauksessa), näytä vahvistusnäkymä heti
  useEffect(()=>{
    if(unverifiedUser&&!verifyPending){
      setVerifyPending({email:unverifiedUser.email}); // ei pw — käytetään fbAuth.currentUser
    }
  },[unverifiedUser]);

  const s=(k,v)=>{setF({...f,[k]:v});setError("");};
  const ERRS={
    "auth/email-already-in-use":"Sähköposti on jo käytössä.",
    "auth/invalid-email":"Tarkista sähköpostiosoite.",
    "auth/weak-password":"Salasanan on oltava vähintään 6 merkkiä.",
    "auth/user-not-found":"Tiliä ei löydy.",
    "auth/wrong-password":"Väärä salasana.",
    "auth/invalid-credential":"Väärä sähköposti tai salasana.",
  };

  const startResendCooldown=()=>{
    if(resendTimerRef.current)clearInterval(resendTimerRef.current);
    setResendCooldown(60);
    let cd=60;
    resendTimerRef.current=setInterval(()=>{
      cd--;setResendCooldown(cd);
      if(cd<=0){clearInterval(resendTimerRef.current);resendTimerRef.current=null;}
    },1000);
  };

  const submit=async()=>{
    // Validointi ennen Firebase-kutsua
    if(mode==="register"){
      const missing=[];
      if(!f.name.trim())missing.push("nimi");
      if(!f.email.trim())missing.push("sähköposti");
      if(f.pw.length<6)missing.push("salasana (väh. 6 merkkiä)");
      if(missing.length>0){
        setError("Puuttuvia tietoja — täytä: "+missing.join(", ")+".");
        return;
      }
    }
    setLoading(true);setError("");setResetSent(false);
    try{
      if(mode==="register"){
        // localStorage jotta vahvistamaton tili säilyy sovelluksen sulkemisen jälkeen
        await setPersistence(fbAuth,browserLocalPersistence);
        _suppressAuthChange=true; // Blokeeraa kaikki auth-muutokset rekisteröintivirran ajaksi
        try{
          let cred;
          try{
            cred=await createUserWithEmailAndPassword(fbAuth,f.email,f.pw);
          }catch(e){
            if(e.code==="auth/email-already-in-use"){
              // Tili on jo olemassa — tarkista onko vahvistettu
              try{
                const existing=await signInWithEmailAndPassword(fbAuth,f.email,f.pw);
                await existing.user.reload();
                if(!existing.user.emailVerified){
                  // Vahvistamaton tili — ohjaa vahvistusprosessiin (ei poisteta tiliä)
                  await signOut(fbAuth);
                  _suppressAuthChange=false;
                  setVerifyPending({email:f.email,pw:f.pw});
                  setLoading(false);return;
                }else{
                  await signOut(fbAuth);
                  setError("Tällä sähköpostiosoitteella on jo vahvistettu käyttäjätili. Kirjaudu sisään.");
                  setLoading(false);return;
                }
              }catch(e2){
                if(e2.code==="auth/wrong-password"||e2.code==="auth/invalid-credential"){
                  setError("Tällä sähköpostiosoitteella on jo tili. Kirjaudu sisään tai palauta salasana.");
                }else{
                  setError(ERRS[e2.code]||"Virhe. Yritä uudelleen.");
                }
                setLoading(false);return;
              }
            }else{
              throw e;
            }
          }
          await fbUpdateProfile(cred.user,{displayName:f.name.trim()});
          await sendEmailVerification(cred.user);
          // Ei signOut — käyttäjä pidetään kirjautuneena Firebaseen (mutta blokattuna sovelluksesta)
          // Näin reload näyttää vahvistusnäkymän automaattisesti onAuthStateChanged kautta
          setVerifyPending({email:f.email,pw:f.pw});
        }finally{
          _suppressAuthChange=false; // Vapautetaan aina — myös virhetilanteessa
        }
      }else{
        await setPersistence(fbAuth,stayLoggedIn?browserLocalPersistence:browserSessionPersistence);
        const cred=await signInWithEmailAndPassword(fbAuth,f.email,f.pw);
        // Reload pakottaa tuoreen emailVerified-arvon — vanhentunut cache voi näyttää false vaikka on vahvistettu
        await cred.user.reload();
        if(!cred.user.emailVerified){
          // Ei signOut — pidetään kirjautuneena jotta reload tunnistaa vahvistamattoman käyttäjän
          setVerifyPending({email:f.email,pw:f.pw,blocked:true});
        }
        // Jos emailVerified=true, onAuthStateChanged hoitaa loppuosan
      }
    }catch(e){setError(ERRS[e.code]||"Virhe. Yritä uudelleen.");}
    setLoading(false);
  };

  // Hae tai kirjaudu käyttäjäksi vahvistustoimintoja varten
  // Jos fbAuth.currentUser on olemassa (sovelluksen uudelleenavauksessa), käytetään sitä suoraan
  // Jos verifyPending.pw on tallennettu (tuore rekisteröinti/kirjautuminen), käytetään sitä
  const getVerifyUser=async()=>{
    const current=fbAuth.currentUser;
    if(current&&current.email===verifyPending.email){
      await current.reload();
      return{user:current,signedInNow:false};
    }
    if(!verifyPending.pw)throw new Error("no_pw");
    const cred=await signInWithEmailAndPassword(fbAuth,verifyPending.email,verifyPending.pw);
    await cred.user.reload();
    return{user:cred.user,signedInNow:true};
  };

  const resendVerification=async()=>{
    if(resendCooldown>0)return;
    setLoading(true);setResendOk(false);setError("");
    try{
      const{user,signedInNow}=await getVerifyUser();
      if(user.emailVerified){
        // Käyttäjä on jo vahvistanut — päästetään sisään
        if(onUnverifiedCleared)onUnverifiedCleared();
        setVerifyPending(null);
        setLoading(false);return;
      }
      try{
        await sendEmailVerification(user);
        if(signedInNow)await signOut(fbAuth);
        setResendOk(true);
        startResendCooldown();
      }catch(e2){
        if(signedInNow)await signOut(fbAuth);
        if(e2.code==="auth/too-many-requests"){
          setError("Liian monta yritystä. Odota hetki ennen uudelleenlähetystä.");
          startResendCooldown();
        }else{
          setError("Viestin lähetys epäonnistui. Yritä hetken kuluttua uudelleen.");
        }
      }
    }catch(e){
      if(e.message==="no_pw"){
        setError("Kirjaudu sisään ensin, jotta voimme lähettää uuden vahvistusviestin.");
        setVerifyPending(null);setMode("login");
      }else if(e.code==="auth/invalid-credential"||e.code==="auth/wrong-password"){
        setError("Väärä salasana. Yritä kirjautua sisään uudelleen.");
        setVerifyPending(null);setMode("login");
      }else if(e.code==="auth/too-many-requests"){
        setError("Liian monta yritystä. Odota hetki.");
        startResendCooldown();
      }else{
        setError("Virhe: "+(e.message||e.code||"tuntematon virhe"));
      }
    }
    setLoading(false);
  };

  const checkVerification=async()=>{
    setLoading(true);setError("");
    try{
      const{user,signedInNow}=await getVerifyUser();
      if(user.emailVerified){
        // Vahvistus onnistui — onAuthStateChanged hoitaa siirtymän sovellukseen
        if(onUnverifiedCleared)onUnverifiedCleared();
        setVerifyPending(null);
      }else{
        if(signedInNow)await signOut(fbAuth);
        setError("Sähköpostiosoitetta ei ole vielä vahvistettu. Klikkaa sähköpostissa olevaa vahvistuslinkkiä.");
      }
    }catch(e){
      if(e.message==="no_pw"){
        // Ei salasanaa eikä aktiivista sessiota — pyydä kirjautumaan
        setError("Kirjaudu sisään tarkistaaksesi vahvistuksen.");
        setVerifyPending(null);setMode("login");
      }else{
        setError("Virhe. Tarkista sähköposti ja salasana.");
      }
    }
    setLoading(false);
  };

  const resetPw=async()=>{
    if(!f.email){setError("Kirjoita sähköpostiosoite ensin.");return;}
    try{await sendPasswordResetEmail(fbAuth,f.email);setResetSent(true);setError("");}
    catch{setError("Virhe. Tarkista sähköpostiosoite.");}
  };

  // Sähköpostin vahvistus odottaa
  if(verifyPending){
    return(
      <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 24px",background:S.bg,fontFamily:FF}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:48,marginBottom:12}}>✉️</div>
          <div style={{fontSize:20,fontWeight:700,color:S.ink,marginBottom:8}}>
            Vahvista sähköpostiosoitteesi
          </div>
          <p style={{fontSize:13,color:S.mut,lineHeight:1.6,marginBottom:4}}>
            Lähetimme vahvistuslinkin osoitteeseen<br/>
            <strong style={{color:S.ink}}>{verifyPending.email}</strong>
          </p>
        </div>
        <div style={{background:S.wh,borderRadius:16,padding:"16px 18px",marginBottom:16,border:"1px solid "+S.brd}}>
          {[
            "Avaa sähköpostisi",
            "Etsi viesti lähettäjältä Shoppailu PLUS",
            "Paina vahvistuslinkkiä viestissä",
            "Tule takaisin ja kirjaudu sisään",
          ].map((step,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:i<3?12:0}}>
              <div style={{width:24,height:24,borderRadius:12,background:S.rose,color:S.wh,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
              <span style={{fontSize:13,color:S.ink}}>{step}</span>
            </div>
          ))}
        </div>
        <div style={{background:"#FFFBEA",borderRadius:12,padding:"10px 14px",marginBottom:16,border:"1px solid #F0D060"}}>
          <p style={{fontSize:12,color:"#7A6000",margin:0,lineHeight:1.5}}>
            💡 Jos et löydä viestiä, tarkista <strong>roskapostikansio</strong> sekä Tarjoukset/Muut-kansiot.
          </p>
        </div>
        {resendOk&&<div style={{background:"#F0FAF0",borderRadius:10,padding:"8px 12px",marginBottom:12,textAlign:"center",border:"1px solid "+S.grn}}>
          <span style={{fontSize:12,color:S.grn,fontWeight:600}}>✓ Vahvistusviesti lähetetty uudelleen!</span>
        </div>}
        {error&&<p style={{fontSize:12,color:S.rose,marginBottom:8,textAlign:"center"}}>{error}</p>}
        <button onClick={checkVerification} disabled={loading}
          style={{...btn(S.rose,S.wh),width:"100%",padding:"12px 0",marginBottom:10}}>
          {loading?"⏳ Tarkistetaan…":"✓ Olen vahvistanut sähköpostini"}
        </button>
        <button onClick={resendVerification} disabled={resendCooldown>0||loading}
          style={{...btn(resendCooldown>0?S.brd:S.ink,resendCooldown>0?S.mut:S.wh),width:"100%",padding:"12px 0",marginBottom:10}}>
          {loading?"⏳ Lähetetään…":resendCooldown>0?`Lähetä uudelleen (${resendCooldown}s)`:"Lähetä vahvistusviesti uudelleen"}
        </button>
        <button onClick={async()=>{
          if(!verifyPending?.email){setVerifyPending(null);setMode("login");return;}
          try{await sendPasswordResetEmail(fbAuth,verifyPending.email);setError("");setResendOk(false);
            alert("Salasanan palautuslinkki lähetetty: "+verifyPending.email);}
          catch{setError("Virhe salasanan palautuksessa. Yritä uudelleen.");}
        }} style={{background:"none",border:"none",color:S.mut,fontSize:12,textDecoration:"underline",cursor:"pointer",fontFamily:FF,display:"block",width:"100%",textAlign:"center",marginBottom:8}}>
          Unohditko salasanasi?
        </button>
        <button onClick={()=>{if(onUnverifiedCleared)onUnverifiedCleared();setVerifyPending(null);setMode("login");setError("");}}
          style={{background:"none",border:"none",color:S.mut,fontSize:12.5,textDecoration:"underline",cursor:"pointer",fontFamily:FF,textAlign:"center"}}>
          ← Takaisin kirjautumiseen
        </button>
      </div>
    );
  }

  const ok=mode==="register"?f.name.trim()&&f.email&&f.pw.length>=6:f.email&&f.pw;
  return(
    <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 24px",background:S.bg,fontFamily:FF}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:26,fontWeight:700,color:S.ink}}>Shoppailu <span style={{color:S.rose}}>PLUS</span></div>
        <p style={{fontSize:13,color:S.mut,marginTop:4}}>{mode==="register"?"Luo tili":"Kirjaudu sisään"}</p>
      </div>
      <div style={{display:"flex",borderRadius:24,padding:4,background:S.rs,marginBottom:20}}>
        {[["register","Luo tili"],["login","Kirjaudu"]].map(([k,l])=><button key={k} onClick={()=>{setMode(k);setError("");setResetSent(false);}} style={{flex:1,borderRadius:20,padding:"8px 0",background:mode===k?S.wh:"transparent",border:"none",fontWeight:600,fontSize:13,color:S.ink,cursor:"pointer"}}>{l}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {mode==="register"&&<input value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Nimi" style={inp}/>}
        <input value={f.email} onChange={e=>s("email",e.target.value)} placeholder="Sähköposti" style={inp} type="email"/>
        <input type="password" value={f.pw} onChange={e=>s("pw",e.target.value)}
          placeholder={mode==="register"?"Salasana (väh. 6 merkkiä)":"Salasana"} style={inp}
          onKeyDown={e=>e.key==="Enter"&&ok&&!loading&&submit()}/>
      </div>
      {mode==="login"&&<label style={{display:"flex",alignItems:"center",gap:10,marginTop:14,cursor:"pointer",userSelect:"none"}}>
        <input type="checkbox" checked={stayLoggedIn} onChange={e=>setStayLoggedIn(e.target.checked)}
          style={{width:18,height:18,accentColor:S.rose,cursor:"pointer",flexShrink:0}}/>
        <span style={{fontSize:13,color:S.ink,fontFamily:FF}}>Pysy kirjautuneena</span>
      </label>}
      {error&&<p style={{fontSize:12,color:S.rose,marginTop:8,textAlign:"center"}}>{error}</p>}
      {resetSent&&<p style={{fontSize:12,color:S.grn,marginTop:8,textAlign:"center"}}>✓ Palautuslinkki lähetetty sähköpostiisi!</p>}
      <button disabled={!ok||loading} onClick={submit} style={{...btn(ok&&!loading?S.rose:S.brd,ok&&!loading?S.wh:S.mut),width:"100%",marginTop:20,padding:"12px 0",fontSize:14}}>
        {loading?"⏳ Ladataan…":mode==="register"?"Luo tili":"Kirjaudu"}
      </button>
      {mode==="login"&&<button onClick={resetPw} style={{background:"none",border:"none",color:S.mut,fontSize:12,textDecoration:"underline",marginTop:12,cursor:"pointer",fontFamily:FF}}>Unohditko salasanan?</button>}
    </div>
  );
}

/* PLUS-UPSELL POPUP */
function PlusUpsellPopup({onClose,onActivate}) {
  return(
    <div style={{position:"fixed",inset:0,zIndex:202,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(43,27,46,0.75)",backdropFilter:"blur(6px)",padding:24}}>
      <style>{`@keyframes puFade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.pu-card{animation:puFade 0.4s cubic-bezier(.22,.8,.36,1) both;}@keyframes puShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}.pu-btn{background:linear-gradient(135deg,#C8960A,#FFD700,#FFBA08,#FFD700,#C8960A)!important;background-size:300% 300%!important;animation:puShimmer 2.5s ease infinite!important;color:#3A2000!important;border:none!important;border-radius:16px!important;padding:14px 0!important;width:100%!important;font-size:15px!important;font-weight:600!important;cursor:pointer!important;font-family:inherit!important;box-shadow:0 4px 18px rgba(200,150,10,0.4)!important;}`}</style>
      <div className="pu-card" style={{background:S.wh,borderRadius:24,padding:"28px 22px",width:"100%",maxWidth:380,boxShadow:"0 24px 60px rgba(43,27,46,0.25)",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:"none",border:"none",fontSize:18,color:S.mut,cursor:"pointer",fontFamily:FF,lineHeight:1,padding:4}}>✕</button>
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:44,marginBottom:6,filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.12))"}}>👑</div>
          <div style={{fontSize:19,fontWeight:700,color:S.ink,marginBottom:4}}>Shoppailu <span style={{color:"#C8960A"}}>PLUS+</span></div>
          <div style={{display:"inline-block",background:"linear-gradient(135deg,#1FA463,#27AE7A)",borderRadius:12,padding:"6px 16px",marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:"0.02em"}}>✨ 7 päivän ilmainen kokeilu</span>
          </div>
          <div style={{fontSize:24,fontWeight:700,fontFamily:"monospace",color:S.ink}}>{PLUS_PRICE_SHORT}<span style={{fontSize:13,fontWeight:400,color:S.mut}}>/kk</span></div>
          <div style={{fontSize:11,color:S.mut,marginTop:2}}>Peru milloin tahansa</div>
        </div>
        <div style={{...card(S.bg,S.brd),padding:"12px 14px",marginBottom:16}}>
          {[
            ["♾️","Rajattomat haut kuukaudessa"],
            ["✨","AI-suunnittelija kaikilla työkaluilla"],
            ["🏷️","Alennuskoodihaku kaupan sivuilta"],
            ["📈","Toteutunut säästö -seuranta"],
            ["🎯","Henkilökohtaiset tuotesuositukset"],
          ].map(([icon,text])=>(
            <div key={text} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:17,flexShrink:0}}>{icon}</span>
              <span style={{fontSize:13,color:S.ink,lineHeight:1.3}}>{text}</span>
            </div>
          ))}
        </div>
        <button className="pu-btn" onClick={onActivate}>Aloita ilmainen kokeilu →</button>
        <button onClick={onClose} style={{width:"100%",background:"none",border:"none",color:S.mut,fontSize:12,cursor:"pointer",fontFamily:FF,padding:"8px 0",marginTop:2}}>Jatka ilmaisella versiolla</button>
      </div>
    </div>
  );
}

/* PROFIILIN TÄYDENNYS -POPUP */
function ProfileSetupPopup({onSave,onSkip}) {
  const[gender,setGender]=useState("");
  const[age,setAge]=useState("");
  const AGES=["alle 18","18–25","26–35","36–45","46–55","56+"];
  return(
    <div style={{position:"fixed",inset:0,zIndex:201,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(43,27,46,0.72)",backdropFilter:"blur(6px)",padding:24}}>
      <style>{`@keyframes psFade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}.ps-card{animation:psFade 0.4s cubic-bezier(.22,.8,.36,1) both;}`}</style>
      <div className="ps-card" style={{background:S.wh,borderRadius:24,padding:"28px 22px",width:"100%",maxWidth:380,boxShadow:"0 24px 60px rgba(43,27,46,0.22)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:44,marginBottom:8}}>👤</div>
          <div style={{fontSize:18,fontWeight:700,color:S.ink,marginBottom:6}}>Täydennä profiilisi</div>
          <p style={{fontSize:13,color:S.mut,lineHeight:1.5,margin:0}}>Valitse sukupuoli, jotta AI-suunnittelija voi suositella sopivia tuotteita.</p>
        </div>

        <div style={{fontSize:12,fontWeight:700,color:S.mut,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Sukupuoli <span style={{color:S.rose}}>*</span></div>
        <div style={{display:"flex",gap:10,marginBottom:20}}>
          {[["Nainen","👩"],["Mies","👨"]].map(([g,icon])=>(
            <button key={g} onClick={()=>setGender(g)}
              style={{flex:1,padding:"14px 0",borderRadius:16,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:FF,
                border:"2px solid "+(gender===g?S.rose:S.brd),
                background:gender===g?S.rs:S.wh,
                color:gender===g?S.rd:S.ink,transition:"all 0.15s"}}>
              <div style={{fontSize:26,marginBottom:4}}>{icon}</div>{g}
            </button>
          ))}
        </div>

        <div style={{fontSize:12,fontWeight:700,color:S.mut,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Ikäryhmä <span style={{fontSize:10,fontWeight:400}}>(valinnainen)</span></div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:24}}>
          {AGES.map(a=>(
            <button key={a} onClick={()=>setAge(age===a?"":a)}
              style={{padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FF,
                border:"1.5px solid "+(age===a?S.rose:S.brd),
                background:age===a?S.rs:S.wh,
                color:age===a?S.rd:S.ink,transition:"all 0.15s"}}>
              {a}
            </button>
          ))}
        </div>

        <button disabled={!gender} onClick={()=>onSave(gender,age)}
          style={{...btn(!gender?S.brd:S.rose,!gender?S.mut:S.wh),width:"100%",padding:"13px 0",fontSize:14,marginBottom:8}}>
          ✓ Valmis — tallenna
        </button>
        <button onClick={onSkip}
          style={{width:"100%",background:"none",border:"none",color:S.mut,fontSize:12,cursor:"pointer",fontFamily:FF,padding:"6px 0"}}>
          Täydennä myöhemmin
        </button>
      </div>
    </div>
  );
}

/* ── MAIN APP ── */
function App() {
  const[fbUser,setFbUser]=useState(undefined);
  const[unverifiedUser,setUnverifiedUser]=useState(null); // kirjautunut mutta sähköposti vahvistamatta
  const[skipped,setSkipped]=useState(false);
  const[userName,setUserName]=useState("");
  const[showWelcome,setShowWelcome]=useState(false);
  const welcomeShownRef=useRef(false);
  const[scr,setScr]=useState("koti");
  const[isPlus,setIsPlus]=useState(false);
  const[freeLeft,setFreeLeft]=useState(FREE_MONTHLY_LIMIT);
  const[subscription,setSubscription]=useState({status:"free",startDate:null,nextBillingDate:null,cancelledDate:null,validUntil:null});
  const plusUpsellRef=useRef(false);
  const[showPlusUpsell,setShowPlusUpsell]=useState(false);
  const[favs,setFavs]=useState([]);
  const[list,setList]=useState([]);
  const[savings,setSavings]=useState(0);
  const[hist,setHist]=useState([]);
  const[profile,setProfileState]=useState({hiuksetTags:[],kosmetiikkaTags:[],tyyliTags:[],mitat:{},budjetti:200,sukupuoli:"",ikaryhma:""});
  const[showProfileSetup,setShowProfileSetup]=useState(false);
  const[budgetD,setBudgetD]=useState(200);
  const[behavior,setBehavior]=useState({lastResults:[]});
  const[recommItem,setRecommItem]=useState(null);
  const[profileRecs,setProfileRecs]=useState([]);
  const[prevScr,setPrevScr]=useState(null);

  useEffect(()=>{
    const unsub=onAuthStateChanged(fbAuth,async user=>{
      // Blokeeraa rekisteröintivirran aikana — estää kaikki profiilivilahdukset
      if(_suppressAuthChange)return;
      // Vahvistamaton käyttäjä: pidä kirjautuneena Firebaseen mutta estä sovellukseen pääsy
      // Reload pakottaa tuoreen emailVerified-arvon (cache voi olla vanhentunut)
      if(user&&!user.emailVerified){
        try{await user.reload();}catch{}
        if(!user.emailVerified){
          setUnverifiedUser(user); // näytetään vahvistusnäkymä Auth-komponentissa
          setFbUser(null);
          return;
        }
      }
      setUnverifiedUser(null);
      setFbUser(user);
      if(user){
        try{
          const snap=await getDoc(doc(fbDb,'users',user.uid));
          const curMonth=new Date().toISOString().slice(0,7);
          if(snap.exists()){
            const d=snap.data();
            setUserName(d.name||user.displayName||user.email.split("@")[0]);
            if(d.profile){
              const p={...d.profile};
              // Sanitoi mitat: poista arvot joissa on @ (sähköposti) tai yli 50 merkkiä (väärä data)
              if(p.mitat){
                const cleanMitat={};
                Object.entries(p.mitat).forEach(([k,v])=>{
                  if(typeof v==='string'&&(v.includes('@')||v.length>50)){}
                  else cleanMitat[k]=v;
                });
                if(JSON.stringify(cleanMitat)!==JSON.stringify(p.mitat)){
                  p.mitat=cleanMitat;
                  setDoc(doc(fbDb,'users',user.uid),{profile:p},{merge:true}).catch(console.error);
                }else p.mitat=cleanMitat;
              }
              setProfileState(p);
              if(!p.sukupuoli) setShowProfileSetup(true);
            }else{
              setShowProfileSetup(true);
            }
            if(d.favs)setFavs(d.favs);
            if(d.list)setList(d.list);
            if(d.hist)setHist(d.hist);
            if(d.savings!=null)setSavings(d.savings);
            if(d.budgetD!=null)setBudgetD(d.budgetD);
            if(d.subscription){
              const sub=d.subscription;
              setSubscription(sub);
              // isPlus = aktiivinen tilaus tai peruttu mutta vielä voimassa
              const plusActive=sub.status==="active"||(sub.status==="cancelled"&&sub.validUntil&&new Date(sub.validUntil)>new Date());
              setIsPlus(!!plusActive);
            }else if(d.isPlus!=null){
              // Migraatio: vanha boolean → uusi subscription-rakenne
              if(d.isPlus){
                const sub={status:"active",startDate:new Date().toISOString(),nextBillingDate:new Date(Date.now()+30*24*60*60*1000).toISOString(),cancelledDate:null,validUntil:null};
                setSubscription(sub);
                setDoc(doc(fbDb,'users',user.uid),{subscription:sub},{merge:true}).catch(console.error);
              }
              setIsPlus(d.isPlus);
            }
            if(d.behavior)setBehavior(d.behavior);
            // Palauta tai resetoi kuukausittainen ilmaishakujen määrä
            if(d.freeResetMonth&&d.freeResetMonth===curMonth&&d.freeLeft!=null){
              setFreeLeft(d.freeLeft);
            }else{
              // Uusi kuukausi — resetoi 10:een
              setFreeLeft(FREE_MONTHLY_LIMIT);
              setDoc(doc(fbDb,'users',user.uid),{freeLeft:FREE_MONTHLY_LIMIT,freeResetMonth:curMonth},{merge:true}).catch(console.error);
            }
          }else{
            const name=user.displayName||user.email.split("@")[0];
            setUserName(name);
            await setDoc(doc(fbDb,'users',user.uid),{
              name,profile:{hiuksetTags:[],kosmetiikkaTags:[],tyyliTags:[],mitat:{},budjetti:200,sukupuoli:"",ikaryhma:""},
              favs:[],list:[],hist:[],savings:0,budgetD:200,isPlus:false,behavior:{lastResults:[]},
              freeLeft:FREE_MONTHLY_LIMIT,freeResetMonth:curMonth
            });
            setShowProfileSetup(true);
          }
        // Näytä tervetulotoivotus kerran per session
        if(!welcomeShownRef.current){welcomeShownRef.current=true;setShowWelcome(true);}
        }catch(e){console.error(e);}
      }else{
        setUserName("");setFavs([]);setList([]);setHist([]);setSavings(0);
        setProfileState({hiuksetTags:[],kosmetiikkaTags:[],tyyliTags:[],mitat:{},budjetti:200});
        setBudgetD(200);setIsPlus(false);setSubscription({status:"free",startDate:null,nextBillingDate:null,cancelledDate:null,validUntil:null});setBehavior({lastResults:[]});setRecommItem(null);
      }
    });
    return unsub;
  },[]);

  // Profiilipohjainen suositushaku — päivittyy automaattisesti kun profiili muuttuu
  const profileTagsKey=[
    ...(profile.hiuksetTags||[]),
    ...(profile.kosmetiikkaTags||[]),
    ...(profile.tyyliTags||[])
  ].join(',');
  useEffect(()=>{
    if(!profileTagsKey){setProfileRecs([]);return;}
    let cancelled=false;
    // Dynaamisesti kerätään kaikki tägit profiilista (ei kovakoodattuja kategorioita)
    const allTagArrays=Object.entries(profile)
      .filter(([k,v])=>k!=='mitat'&&k!=='budjetti'&&Array.isArray(v)&&v.length>0)
      .map(([_,v])=>v[0]);
    const term=allTagArrays.filter(Boolean).slice(0,3).join(' ');
    if(!term)return;
    searchProducts(term).then(d=>{
      if(cancelled)return;
      if(d.ok&&d.results) setProfileRecs(d.results.slice(0,20));
    });
    return()=>{cancelled=true;};
  },[profileTagsKey]);

  const uid=fbUser?.uid;
  const save=(data)=>{if(!uid)return;setDoc(doc(fbDb,'users',uid),data,{merge:true}).catch(console.error);};

  const navigate=(s)=>{setPrevScr(scr);setScr(s);};

  const useFree=()=>{
    if(!isPlus){
      const n=Math.max(0,freeLeft-1);
      setFreeLeft(n);
      save({freeLeft:n,freeResetMonth:new Date().toISOString().slice(0,7)});
    }
  };

  const toggleFav=(item)=>{
    const nf=favs.some(x=>x.link===item.link)?favs.filter(x=>x.link!==item.link):[...favs,item];
    setFavs(nf);save({favs:nf});
  };

  const addList=(item)=>{
    const price=item.price||0;
    const newSpent=hist.reduce((s,p)=>s+(p.price||0),0)+list.reduce((s,it)=>s+(it.price||0),0)+price;
    if(price>0&&newSpent>profile.budjetti)alert(`⚠️ Tämä ostos ylittäisi kuukausibudjettisi (${eur(profile.budjetti)}). Yhteensä tulisi ${eur(newSpent)}.`);
    const nl=[...list,{...item,addedAt:Date.now()}];
    setList(nl);save({list:nl});
    // Seuraa ostoslistalle lisäys suosituksia varten
    trackBehavior(item);
  };

  const goPlus=()=>navigate("plus");

  const activatePlus=()=>{
    const now=new Date();
    const sub={status:"active",startDate:now.toISOString(),nextBillingDate:new Date(now.getTime()+30*24*60*60*1000).toISOString(),cancelledDate:null,validUntil:null};
    setSubscription(sub);setIsPlus(true);
    save({subscription:sub,isPlus:true});
  };

  const cancelPlus=()=>{
    const sub={...subscription,status:"cancelled",cancelledDate:new Date().toISOString(),validUntil:subscription.nextBillingDate};
    setSubscription(sub);
    // isPlus pysyy true kunnes validUntil menee ohi
    const stillPlus=sub.validUntil&&new Date(sub.validUntil)>new Date();
    setIsPlus(!!stillPlus);
    save({subscription:sub,isPlus:!!stillPlus});
  };

  const reactivatePlus=()=>{
    const now=new Date();
    const sub={status:"active",startDate:subscription.startDate||now.toISOString(),nextBillingDate:new Date(now.getTime()+30*24*60*60*1000).toISOString(),cancelledDate:null,validUntil:null};
    setSubscription(sub);setIsPlus(true);
    save({subscription:sub,isPlus:true});
  };

  const markBought=(i)=>{
    const it=list[i];
    const price=it.price||0;
    // Säästö: previousPrice (Optimoi-tulos) tai savedAmount (vertailun maxPrice-delta) tai 0
    const fromPrev=it.previousPrice&&it.previousPrice>price?it.previousPrice-price:0;
    const fromSaved=it.savedAmount&&it.savedAmount>0?it.savedAmount:0;
    const rawSaved=fromPrev>0?fromPrev:fromSaved;
    const savedAmount=Math.max(0,Math.min(rawSaved,price>0?price*2:rawSaved));
    const ns=Number((savings+(savedAmount>0?savedAmount:0)).toFixed(2));
    const nh=[{date:today(),name:it.title,store:it.store,price,savedAmount,source:"app"},...hist].slice(0,50);
    const nl=list.filter((_,j)=>j!==i);
    setSavings(ns);setHist(nh);setList(nl);
    save({savings:ns,hist:nh,list:nl});
  };

  const saveProfile=(newProfile)=>{setProfileState(newProfile);save({profile:newProfile});};

  const saveBudget=(val)=>{
    const v=val??budgetD;
    const np={...profile,budjetti:v};
    setProfileState(np);save({profile:np,budgetD:v});
  };

  const trackBehavior=(item)=>{
    if(!item)return;
    const nl=[item,...(behavior.lastResults||[]).filter(x=>x.title!==item.title)].slice(0,20);
    const nb={...behavior,lastResults:nl};
    setBehavior(nb);save({behavior:nb});
  };

  const changePassword=async(currentPw,newPw)=>{
    if(!fbUser)return"Kirjaudu sisään ensin.";
    try{
      const credential=EmailAuthProvider.credential(fbUser.email,currentPw);
      await reauthenticateWithCredential(fbUser,credential);
      await updatePassword(fbUser,newPw);
      return null;
    }catch(e){
      if(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")return"Nykyinen salasana on väärä.";
      if(e.code==="auth/requires-recent-login")return"Kirjaudu ulos ja uudelleen sisään.";
      return"Virhe. Yritä uudelleen.";
    }
  };

  const changeEmail=async(currentPw,newEmail)=>{
    if(!fbUser)return"Kirjaudu sisään ensin.";
    try{
      const credential=EmailAuthProvider.credential(fbUser.email,currentPw);
      await reauthenticateWithCredential(fbUser,credential);
      await verifyBeforeUpdateEmail(fbUser,newEmail);
      return null;
    }catch(e){
      if(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")return"Nykyinen salasana on väärä.";
      if(e.code==="auth/email-already-in-use")return"Sähköposti on jo käytössä.";
      if(e.code==="auth/invalid-email")return"Tarkista sähköpostiosoite.";
      if(e.code==="auth/requires-recent-login")return"Kirjaudu ulos ja uudelleen sisään.";
      return"Virhe. Yritä uudelleen.";
    }
  };

  const deleteAccount=async(email,password,dryRun=false)=>{
    if(!fbUser){
      if(!dryRun){
        setSkipped(false);setFavs([]);setList([]);setHist([]);
        setProfileState({hiuksetTags:[],kosmetiikkaTags:[],tyyliTags:[],mitat:{},budjetti:200});
        setBudgetD(200);setSavings(0);setIsPlus(false);setSubscription({status:"free",startDate:null,nextBillingDate:null,cancelledDate:null,validUntil:null});
      }
      return null;
    }
    if(email&&email.toLowerCase()!==fbUser.email.toLowerCase())return"Sähköpostiosoite ei täsmää.";
    try{
      const credential=EmailAuthProvider.credential(fbUser.email,password);
      await reauthenticateWithCredential(fbUser,credential);
      if(dryRun)return null; // Vain tunnistetietojen tarkistus — ei vielä poisteta
      await setDoc(doc(fbDb,'users',fbUser.uid),{});
      await deleteUser(fbUser);
      return null;
    }catch(e){
      if(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")return"Väärä salasana.";
      return"Virhe. Yritä uudelleen.";
    }
  };

  const onNameChange=async(name)=>{
    if(fbUser)await fbUpdateProfile(fbUser,{displayName:name}).catch(console.error);
    setUserName(name);save({name});
  };

  const onLogout=async()=>{await signOut(fbAuth);setSkipped(false);};

  const nowM=new Date();
  const spent=hist.filter(p=>{const pts=(p.date||"").split(".");return pts.length>=3&&parseInt(pts[1])-1===nowM.getMonth()&&parseInt(pts[2])===nowM.getFullYear();}).reduce((s,p)=>s+(p.price||0),0);
  const saveHist=(nh)=>{setHist(nh);save({hist:nh});};

  const NAV=[["koti","🏠","Koti"],["haku","🔍","Haku"],["ostoslista","📋","Ostoslista"],["ai","✨","AI"],["plus","👑","PLUS+"],["profiili","👤","Profiili"]];

  if(fbUser===undefined)return<div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:S.bg}}><Spinner label="Ladataan…"/></div>;
  if(!fbUser)return<Auth onSkip={()=>{}} unverifiedUser={unverifiedUser} onUnverifiedCleared={()=>setUnverifiedUser(null)}/>;

  const auth={loggedIn:!!fbUser,name:userName||fbUser?.displayName||fbUser?.email?.split("@")[0]||"",email:fbUser?.email||"",memberSince:fbUser?.metadata?.creationTime||null,emailVerified:fbUser?.emailVerified||false};

  const handleRecomm=(item)=>{setRecommItem(item);navigate("haku");};

  const potentialSavings=list.reduce((s,it)=>s+(it.savedAmount||0),0);

  // Keep-alive: kaikki näkymät mountataan kerran, vain CSS-näkyvyys vaihtuu.
  // State säilyy navigoinnin yli eikä resetoidu.
  const SCREENS=[
    ["koti",     <ScreenKoti go={navigate} listN={list.length} favN={favs.length} spent={spent} budget={profile.budjetti} savings={savings} potentialSavings={potentialSavings} goPlus={goPlus} alertBudget={!!profile.alertBudget} profileRecs={profileRecs} behavior={behavior} onRecomm={handleRecomm}/>],
    ["haku",     <ScreenHaku isPlus={isPlus} freeLeft={freeLeft} useFree={useFree} favs={favs} toggleFav={toggleFav} addList={addList} goPlus={goPlus} recommItem={recommItem} onClearRecomm={()=>setRecommItem(null)} onTrackSearch={trackBehavior}/>],
    ["skannaa",  <ScreenSkannaa isPlus={isPlus} freeLeft={freeLeft} useFree={useFree} favs={favs} toggleFav={toggleFav} addList={addList} goPlus={goPlus}/>],
    ["ai",       <ScreenAI isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList} profile={profile}/>],
    ["suositukset",<ScreenSuositukset behavior={behavior} profileRecs={profileRecs} onRecomm={handleRecomm}/>],
    ["ostoslista",<ScreenOstoslista list={list} setList={(nl)=>{setList(nl);save({list:nl});}} markBought={markBought} toggleFav={toggleFav} isPlus={isPlus} goPlus={goPlus} go={navigate}/>],
    ["suosikit", <ScreenSuosikit favs={favs} toggleFav={toggleFav} addList={addList} isPlus={isPlus} goPlus={goPlus}/>],
    ["saastot",  <ScreenSaasto savings={savings} hist={hist} isPlus={isPlus} goPlus={goPlus}/>],
    ["ostokset", <ScreenOstokset hist={hist} saveHist={saveHist}/>],
    ["budjetti", <ScreenBudjetti budgetD={budgetD} setBudgetD={setBudgetD} saveBudget={saveBudget} hist={hist}/>],
    ["plus",     <ScreenPlus subscription={subscription} onActivate={activatePlus} onCancel={cancelPlus} onReactivate={reactivatePlus}/>],
    ["profiili", <ScreenProfiili profile={profile} setProfile={saveProfile} auth={auth} onNameChange={onNameChange} changePassword={changePassword} changeEmail={changeEmail} onLogout={onLogout} hist={hist} savings={savings} listN={list.length} isPlus={isPlus} budgetD={budgetD} setBudgetD={setBudgetD} saveBudget={saveBudget} deleteAccount={deleteAccount} onGoPlus={()=>navigate("plus")} onGoSaastot={()=>navigate("saastot")} onGoOstokset={()=>navigate("ostokset")} onGoBudjetti={()=>navigate("budjetti")} onGoOstoslista={()=>navigate("ostoslista")}/>],
  ];

  return(
    <div style={{maxWidth:480,margin:"0 auto",fontFamily:"system-ui, sans-serif",background:S.bg,minHeight:"100vh",position:"relative"}}>
      <style>{`
        @keyframes logoGlow{0%,100%{text-shadow:0 0 6px rgba(232,68,127,0.2),0 0 0px rgba(157,78,221,0)}50%{text-shadow:0 0 14px rgba(232,68,127,0.35),0 0 8px rgba(157,78,221,0.18)}}
        .logo-plus{animation:logoGlow 3s ease-in-out infinite;color:#E8447F;}
      `}</style>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 16px 8px"}}>
        <div style={{minWidth:80}}>
          {scr!=="koti"&&prevScr&&(
            <button onClick={()=>{const p=prevScr;setPrevScr(null);setScr(p);}} style={{background:"none",border:"none",color:S.rd,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FF,padding:"4px 6px"}}>← Takaisin</button>
          )}
        </div>
        <button onClick={()=>navigate("koti")} style={{background:"none",border:"none",cursor:"pointer"}}>
          <span style={{fontSize:20,fontWeight:700,color:S.ink}}>Shoppailu <span className="logo-plus">PLUS</span></span>
        </button>
        <button onClick={()=>{if(isPlus){const sub={status:"free",startDate:null,nextBillingDate:null,cancelledDate:null,validUntil:null};setSubscription(sub);setIsPlus(false);save({subscription:sub,isPlus:false});}else{activatePlus();}}} style={{background:isPlus?S.ink:S.rs,color:isPlus?S.wh:S.rd,border:"none",borderRadius:20,padding:"5px 12px",fontWeight:700,fontSize:11,cursor:"pointer",minWidth:60}}>{isPlus?"👑 PLUS+":"FREE"} ↻</button>
      </div>

      {/* Sisältö — keep-alive: kaikki näkymät mountattu, vain näkyvyys vaihtuu */}
      <div style={{padding:"8px 16px",paddingBottom:100}}>
        {SCREENS.map(([k,el])=>(
          <div key={k} style={{display:scr===k?"block":"none"}}>{el}</div>
        ))}
      </div>

      {/* Welcome splash */}
      {showWelcome&&(()=>{
        const firstName=(userName||"").split(" ")[0].trim();
        return(
          <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(43,27,46,0.72)",backdropFilter:"blur(6px)",padding:24}}>
            <style>{`
              @keyframes wlcFade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
              .welcome-card{animation:wlcFade 0.45s cubic-bezier(.22,.8,.36,1) both;}
              @keyframes wlcShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
              .wlc-btn{background:linear-gradient(135deg,#C8960A,#FFD700,#FFBA08,#FFD700,#C8960A)!important;background-size:300% 300%!important;animation:wlcShimmer 2.5s ease infinite!important;color:#3A2000!important;border:none!important;border-radius:16px!important;padding:14px 0!important;width:100%!important;font-size:15px!important;font-weight:500!important;cursor:pointer!important;font-family:inherit!important;box-shadow:0 4px 18px rgba(200,150,10,0.4)!important;}
            `}</style>
            <div className="welcome-card" style={{background:"linear-gradient(145deg,#C22E68,#E8447F,#F06292,#E8447F,#C22E68)",borderRadius:24,padding:"32px 28px",textAlign:"center",width:"100%",maxWidth:380,boxShadow:"0 24px 60px rgba(194,46,104,0.45)"}}>
              <div style={{fontSize:52,marginBottom:10,filter:"drop-shadow(0 3px 10px rgba(0,0,0,0.3))"}}>👑</div>
              <div style={{fontSize:20,fontWeight:600,color:"#fff",marginBottom:4}}>Shoppailu PLUS</div>
              <div style={{width:40,height:2,background:"rgba(255,255,255,0.2)",borderRadius:1,margin:"14px auto"}}/>
              <div style={{fontSize:22,fontWeight:600,color:"#fff",marginBottom:6,lineHeight:1.3}}>
                ✨ Tervetuloa takaisin{firstName?", "+firstName:""}!
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",marginBottom:28,lineHeight:1.5}}>
                Valmiina säästämään?
              </div>
              <button className="wlc-btn" onClick={()=>{setShowWelcome(false);if(!isPlus&&!plusUpsellRef.current){plusUpsellRef.current=true;setShowPlusUpsell(true);}}}>Aloita shoppailu</button>
            </div>
          </div>
        );
      })()}

      {/* Plus-upsell — näytetään welcomen ja profiilin täydennyksen jälkeen */}
      {!showWelcome&&!showProfileSetup&&showPlusUpsell&&!isPlus&&(
        <PlusUpsellPopup
          onClose={()=>setShowPlusUpsell(false)}
          onActivate={()=>{setShowPlusUpsell(false);navigate("plus");}}
        />
      )}

      {/* Profiilin täydennyspopup — näytetään welcomen jälkeen jos sukupuoli puuttuu */}
      {!showWelcome&&showProfileSetup&&fbUser&&(
        <ProfileSetupPopup
          onSave={(sukupuoli,ikaryhma)=>{
            const np={...profile,sukupuoli,ikaryhma:ikaryhma||""};
            setProfileState(np);
            save({profile:np});
            setShowProfileSetup(false);
          }}
          onSkip={()=>setShowProfileSetup(false)}
        />
      )}

      {/* Alapalkki */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,display:"flex",background:S.wh,borderTop:"1.5px solid "+S.brd,paddingBottom:"env(safe-area-inset-bottom,8px)",zIndex:100,boxShadow:"0 -2px 16px rgba(43,27,46,0.09)"}}>
        {NAV.map(([k,icon,label])=>(
          <button key={k} onClick={()=>navigate(k)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:"10px 1px 8px",background:"none",border:"none",cursor:"pointer",position:"relative",minWidth:0,overflow:"visible",borderTop:scr===k?"2.5px solid "+S.rose:"2.5px solid transparent",transition:"border-color 0.15s"}}>
            <span style={{fontSize:22,lineHeight:"1",display:"block",flexShrink:0}}>{icon}</span>
            <span style={{fontSize:11,fontWeight:700,color:scr===k?S.rose:S.mut,lineHeight:1.1,textAlign:"center",whiteSpace:"nowrap",display:"block",overflow:"visible"}}>
              {label}
            </span>
            {k==="ostoslista"&&list.length>0&&<span style={{position:"absolute",top:4,right:"8%",background:S.rose,color:S.wh,fontSize:8,width:14,height:14,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontWeight:700}}>{list.length}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
