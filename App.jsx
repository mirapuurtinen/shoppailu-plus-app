const { useState, useRef } = React;
const API = "https://shoppailu-plus-backend-msd9.vercel.app";
const eur = n => n != null ? n.toFixed(2).replace(".",",") + " €" : "—";
const today = () => new Date().toLocaleDateString("fi-FI");
const domOf = u => { try { return new URL(u).hostname.replace(/^www\./,""); } catch { return null; } };

/* ── Styles ── */
const S = {
  bg:"#FFF8F3",ink:"#2B1B2E",rose:"#E8447F",rd:"#C22E68",rs:"#FFE0EE",
  yel:"#FFC940",ys:"#FFF3D1",at:"#92720B",grn:"#1FA463",gs:"#DFF7E9",
  mut:"#8A7A86",brd:"#F0DCE6",wh:"#FFFFFF"
};
const card = (bg,bc) => ({background:bg||S.wh,border:"1.5px solid "+(bc||S.brd),borderRadius:16,padding:12,marginBottom:10});
const btn = (bg,c) => ({background:bg,color:c||S.wh,border:"none",borderRadius:12,padding:"8px 16px",fontWeight:600,fontSize:12,cursor:"pointer"});
const inp = {flex:1,padding:"12px 14px",borderRadius:14,border:"1.5px solid "+S.brd,fontSize:14,outline:"none",background:S.wh,fontFamily:"inherit"};
const chip = (active) => ({background:active?S.ink:S.wh,color:active?S.wh:S.ink,border:"1px solid "+(active?S.ink:S.brd),borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:500,cursor:"pointer"});

/* ── API ── */
async function liveSearch(q) {
  try {
    const r = await fetch(API+"/api/search?q="+encodeURIComponent(q)+"&gl=fi&hl=fi");
    return await r.json();
  } catch(e) { return {ok:false,error:"Yhteys epäonnistui: "+e.message,results:[]}; }
}
async function liveCodes(domain) {
  try {
    const r = await fetch(API+"/api/codes?domain="+encodeURIComponent(domain));
    return await r.json();
  } catch(e) { return {ok:false,error:e.message,results:[]}; }
}

/* ── Ingredients dictionary ── */
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

/* ── Small components ── */
function Spinner({label}) { return <div style={{textAlign:"center",padding:40,color:S.rose}}>⏳ {label||"Haetaan oikeita hintoja internetistä…"}</div>; }
function Err({msg}) { return <div style={{background:S.ys,color:S.at,padding:12,borderRadius:14,fontSize:13,marginBottom:12}}>⚠️ {msg}</div>; }

function ResultCard({item,rank,toggleFav,addList,isFav,isPlus,goPlus}) {
  const[codesOpen,setCodesOpen]=useState(false);
  const[codes,setCodes]=useState(null);
  const[codesLoading,setCodesLoading]=useState(false);
  const domain=domOf(item.link);
  const loadCodes=async()=>{
    if(!isPlus)return goPlus();
    setCodesOpen(true);if(codes)return;
    setCodesLoading(true);setCodes(await liveCodes(domain));setCodesLoading(false);
  };
  const bg=rank===0?S.gs:rank===1?S.ys:S.wh;
  const bc=rank===0?S.grn:rank===1?S.yel:S.brd;
  const badge=rank===0?"🏷️ Halvin":rank===1?"🏷️ 2. halvin":null;

  return(
    <div style={card(bg,bc)}>
      <div style={{display:"flex",gap:10}}>
        {item.image&&<img src={item.image} alt="" style={{width:56,height:56,borderRadius:12,objectFit:"cover",background:S.rs}} onError={e=>{e.target.style.display="none"}}/>}
        <div style={{flex:1,minWidth:0}}>
          {badge&&<span style={{background:rank===0?S.grn:S.at,color:S.wh,fontSize:10,fontWeight:700,borderRadius:10,padding:"2px 8px",display:"inline-block",marginBottom:4}}>{badge}</span>}
          <div style={{fontSize:13,fontWeight:600,color:S.ink,lineHeight:1.3}}>{item.title}</div>
          {item.store&&<div style={{fontSize:11,color:S.mut,marginTop:2}}>🏪 {item.store}</div>}
          {item.delivery&&<div style={{fontSize:10.5,color:S.mut}}>🚚 {item.delivery}</div>}
          {item.rating&&<div style={{fontSize:10.5,color:S.mut}}>⭐ {item.rating}{item.ratingCount?" ("+item.ratingCount+")":""}</div>}
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          {item.price!=null?<div style={{fontSize:16,fontWeight:700,color:S.ink,fontFamily:"monospace"}}>{eur(item.price)}</div>:<div style={{fontSize:11,color:S.mut}}>Hinta ei saatavilla</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginTop:10}}>
        {item.link?<a href={item.link} target="_blank" rel="noreferrer" style={{...btn(S.ink),flex:1,textAlign:"center",textDecoration:"none"}}>🔗 Tuotesivulle</a>:<span style={{...btn(S.brd,S.mut),flex:1,textAlign:"center"}}>Ei linkkiä</span>}
        <button onClick={()=>addList(item)} style={btn(S.rs,S.rd)} title="Ostoslistalle">📋</button>
        <button onClick={()=>toggleFav(item)} style={btn(isFav?S.rd:S.rs,isFav?S.wh:S.rd)} title="Suosikkeihin">{isFav?"💗":"🤍"}</button>
      </div>
      {domain&&<button onClick={loadCodes} style={{width:"100%",marginTop:8,background:S.wh,border:"1px solid "+S.brd,borderRadius:10,padding:"6px 0",fontSize:11,color:S.rd,fontWeight:600,cursor:"pointer"}}>🏷️ Alennuskoodeja: {domain} {!isPlus&&"🔒"}</button>}
      {codesOpen&&isPlus&&(
        <div style={{marginTop:8,background:S.bg,borderRadius:10,padding:10}}>
          {codesLoading&&<Spinner label="Haetaan kaupan sivulta…"/>}
          {!codesLoading&&codes?.results?.length===0&&<p style={{fontSize:11,color:S.mut}}>Ei kampanjamainintoja kaupan {domain} sivuilta.</p>}
          {!codesLoading&&codes?.results?.map((c,i)=><a key={i} href={c.link} target="_blank" rel="noreferrer" style={{display:"block",background:S.wh,borderRadius:8,padding:8,marginBottom:6,textDecoration:"none"}}><div style={{fontSize:11,fontWeight:600,color:S.ink}}>{c.title}</div><div style={{fontSize:10,color:S.mut}}>{c.snippet}</div></a>)}
          {!codesLoading&&codes?.results?.length>0&&<p style={{fontSize:9.5,color:S.mut,marginTop:4}}>Haettu kaupan omalta sivulta. Tarkista voimassaolo kassalla.</p>}
        </div>
      )}
    </div>
  );
}

function Results({data,loading,isPlus,goPlus,favs,toggleFav,addList}) {
  if(loading)return <Spinner/>;
  if(!data)return null;
  if(!data.ok)return <Err msg={data.error}/>;
  if(data.results.length===0)return <p style={{color:S.mut,fontSize:13,marginTop:12}}>Ei tuloksia. Kokeile toista hakusanaa.</p>;
  return(
    <div style={{marginTop:8}}>
      <p style={{fontSize:12,color:S.mut,marginBottom:8}}>{data.resultCount||data.results.length} tulosta — oikeat hinnat Google Shoppingista</p>
      {data.results.map((item,i)=><ResultCard key={i} item={item} rank={i} toggleFav={toggleFav} addList={addList} isFav={favs.some(f=>f.link===item.link)} isPlus={isPlus} goPlus={goPlus}/>)}
    </div>
  );
}

/* ── SCREENS ── */

/* KOTI */
function ScreenKoti({go,listN,favN,spent,budget,savings}) {
  return(
    <div>
      <h1 style={{fontSize:24,fontWeight:700,color:S.ink,lineHeight:1.2,margin:"0 0 6px"}}>Osta fiksummin.<br/>Säästä enemmän.</h1>
      <p style={{fontSize:13.5,color:S.mut,marginBottom:16}}>Hae oikeita hintoja suomalaisista verkkokaupoista — reaaliajassa.</p>
      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <button onClick={()=>go("haku")} style={{flex:1,...card(S.ink,S.ink),cursor:"pointer",border:"none"}}><div style={{fontSize:18}}>🔍</div><div style={{color:S.wh,fontWeight:600,fontSize:14,marginTop:6}}>Hae tuote</div><div style={{color:"#C9BAC4",fontSize:11.5}}>Nimi tai brändi</div></button>
        <button onClick={()=>go("skannaa")} style={{flex:1,...card(S.rose,S.rose),cursor:"pointer",border:"none"}}><div style={{fontSize:18}}>📷</div><div style={{color:S.wh,fontWeight:600,fontSize:14,marginTop:6}}>Skannaa</div><div style={{color:S.rs,fontSize:11.5}}>Linkki</div></button>
      </div>
      <div style={card()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,fontWeight:600,color:S.ink}}>Toteutunut säästö</span><span>📈</span></div>
        <div style={{fontSize:24,fontWeight:700,fontFamily:"monospace",color:S.grn,marginTop:4}}>{eur(savings)}</div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:12}}>
        <button onClick={()=>go("ostoslista")} style={{flex:1,...card(),cursor:"pointer"}}><span style={{fontSize:16}}>📋</span><div style={{fontWeight:600,fontSize:13,color:S.ink}}>Ostoslista</div><div style={{fontSize:11,color:S.mut}}>{listN} tuotetta</div></button>
        <button onClick={()=>go("suosikit")} style={{flex:1,...card(),cursor:"pointer"}}><span style={{fontSize:16}}>❤️</span><div style={{fontWeight:600,fontSize:13,color:S.ink}}>Suosikit</div><div style={{fontSize:11,color:S.mut}}>{favN} tuotetta</div></button>
      </div>
      <button onClick={()=>go("ai")} style={{width:"100%",...card(),cursor:"pointer",background:"linear-gradient(120deg,"+S.rs+","+S.ys+")",textAlign:"left"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{background:S.wh,borderRadius:12,padding:8}}>✨</div>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13.5,color:S.ink}}>AI-suunnittelija</div><div style={{fontSize:11,color:S.mut}}>Ainesosahaku, vertailu, asun etsiminen — live-datalla</div></div>
          <span style={{...btn(S.ink),fontSize:10,padding:"3px 9px"}}>Plus</span>
        </div>
      </button>
      <div style={{...card(),marginTop:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span>💳</span><span style={{fontWeight:600,fontSize:13,color:S.ink}}>Kuukausibudjetti</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:18,fontWeight:700,fontFamily:"monospace",color:S.ink}}>{eur(spent)}</span><span style={{fontSize:13,fontFamily:"monospace",color:S.mut}}>/ {eur(budget)}</span></div>
        <div style={{width:"100%",height:8,borderRadius:4,background:S.brd,marginTop:8}}><div style={{height:8,borderRadius:4,background:spent>budget?S.rose:S.grn,width:Math.min(100,(spent/budget)*100)+"%"}}/></div>
      </div>
    </div>
  );
}

/* HAKU */
function ScreenHaku({isPlus,freeLeft,useFree,favs,toggleFav,addList,goPlus}) {
  const[q,setQ]=useState("");const[cat,setCat]=useState(null);const[sub,setSub]=useState(null);
  const[loading,setLoading]=useState(false);const[data,setData]=useState(null);const[history,setHistory]=useState([]);
  const CATS=[["hiukset","🧴 Hiukset"],["kosmetiikka","💄 Kosmetiikka"],["tyyli","👗 Tyyli"]];
  const SUBS={hiukset:["shampoo","hoitoaine","naamio","hiusöljy"],kosmetiikka:["puhdistus","seerumi","aurinkosuoja","meikkivoide"],tyyli:["mekko","kengät","asuste"]};
  const run=async(text)=>{
    const query=(text||q).trim();if(!query)return;
    if(!isPlus&&freeLeft<=0)return;
    setQ(query);if(!history.includes(query))setHistory([query,...history].slice(0,8));
    setLoading(true);setData(null);
    let full=sub?query+" "+sub:query;
    if(cat)full+=" "+(cat==="hiukset"?"hiustuote":cat==="kosmetiikka"?"kosmetiikka":"vaate");
    const d=await liveSearch(full);setData(d);setLoading(false);if(d.ok)useFree();
  };
  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>🔍 Hae tuote</h2>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="Kirjoita tuote, esim. Lumene CC Cream" style={inp}/>
        <button onClick={()=>run()} disabled={loading||(!isPlus&&freeLeft<=0)} style={btn((!isPlus&&freeLeft<=0)?S.brd:S.rose)}>{loading?"⏳":"Hae"}</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        {CATS.map(([k,l])=><button key={k} onClick={()=>{setCat(cat===k?null:k);setSub(null);}} style={chip(cat===k)}>{l}</button>)}
      </div>
      {cat&&SUBS[cat]&&<div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>{SUBS[cat].map(s=><button key={s} onClick={()=>setSub(sub===s?null:s)} style={{...chip(sub===s),background:sub===s?S.rd:S.rs,color:sub===s?S.wh:S.rd,border:"1px solid "+(sub===s?S.rd:S.brd)}}>{s}</button>)}</div>}
      {!isPlus&&<p style={{fontSize:12,color:S.mut,marginBottom:6}}>Ilmaisia hakuja jäljellä: {freeLeft}/10</p>}
      {!q&&history.length>0&&<div style={{marginBottom:12}}><p style={{fontSize:12,fontWeight:600,color:S.mut,marginBottom:6}}>Hakuhistoria</p><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{history.map(h=><button key={h} onClick={()=>run(h)} style={{background:S.rs,color:S.rd,border:"none",borderRadius:14,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>{h}</button>)}</div></div>}
      <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
    </div>
  );
}

/* SKANNAA */
function ScreenSkannaa({isPlus,freeLeft,useFree,favs,toggleFav,addList,goPlus}) {
  const[url,setUrl]=useState("");const[loading,setLoading]=useState(false);const[data,setData]=useState(null);
  const guessName=u=>{try{return new URL(u).pathname.split("/").filter(Boolean).pop().replace(/[-_]/g," ").replace(/\.(html?|php)$/i,"");}catch{return u;}};
  const run=async()=>{if(!url.trim()||(!isPlus&&freeLeft<=0))return;setLoading(true);setData(null);const d=await liveSearch(guessName(url));setData(d);setLoading(false);if(d.ok)useFree();};
  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>📷 Skannaa</h2>
      <p style={{fontSize:13,color:S.mut,marginBottom:12}}>Liitä tuotteen linkki — sovellus päättelee tuotenimen ja hakee oikeat hinnat.</p>
      <div style={card()}>
        <div style={{fontWeight:600,fontSize:13,color:S.ink,marginBottom:8}}>🔗 Tuotelinkki</div>
        <div style={{display:"flex",gap:8}}>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." style={{...inp,fontSize:12.5}}/>
          <button onClick={run} disabled={loading||(!isPlus&&freeLeft<=0)} style={btn((!isPlus&&freeLeft<=0)?S.brd:S.ink)}>{loading?"⏳":"Hae"}</button>
        </div>
      </div>
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
    {k:"ainesosa",l:"🧪 Ainesosahaku"},
    {k:"paras",l:"✨ Paras tuote minulle"},
    {k:"vertailu",l:"⚖️ Tuotevertailu"},
    {k:"vastaava",l:"🔄 Vastaava tuote"},
    {k:"luonnollinen",l:"💬 Luonnollisen kielen haku"},
    {k:"asu",l:"👗 Asun etsiminen"},
  ];
  const cp={isPlus,goPlus,favs,toggleFav,addList};
  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>✨ AI-suunnittelija</h2>
      {!tool&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{tools.map(t=><button key={t.k} onClick={()=>setTool(t.k)} style={{...card(),cursor:"pointer",textAlign:"left"}}><div style={{fontWeight:600,fontSize:12,color:S.ink}}>{t.l}</div></button>)}</div>}
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
  const run=async()=>{if(!q.trim())return;setLoading(true);setData(await liveSearch(q));setLoading(false);};
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
  const[cat,setCat]=useState(null);const[loading,setLoading]=useState(false);const[data,setData]=useState(null);
  const run=async()=>{
    const tags=cat==="hiukset"?profile.hiuksetTags:cat==="kosmetiikka"?profile.kosmetiikkaTags:cat==="tyyli"?profile.tyyliTags:[...(profile.hiuksetTags||[]),...(profile.kosmetiikkaTags||[]),...(profile.tyyliTags||[])];
    if(!tags||!tags.length){setData({ok:false,error:"Täytä ensin profiilisi valinnat."});return;}
    setLoading(true);setData(await liveSearch(tags[0]+(cat?" "+cat:"")));setLoading(false);
  };
  return(<div><ToolHeader label="Paras tuote minulle" back={back}/>
    <div style={{display:"flex",gap:6,marginBottom:10}}>{[["hiukset","🧴"],["kosmetiikka","💄"],["tyyli","👗"]].map(([k,e])=><button key={k} onClick={()=>setCat(cat===k?null:k)} style={chip(cat===k)}>{e} {k}</button>)}</div>
    <button onClick={run} style={{...btn(S.ink),width:"100%",marginBottom:10}}>Hae suositus profiilini mukaan</button>
    <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
  </div>);
}

function VertailuTool({back,isPlus,goPlus,favs,toggleFav,addList}) {
  const[qa,setQa]=useState("");const[qb,setQb]=useState("");const[loading,setLoading]=useState(false);const[da,setDa]=useState(null);const[db,setDb]=useState(null);
  const run=async()=>{if(!qa.trim()||!qb.trim())return;setLoading(true);const[a,b]=await Promise.all([liveSearch(qa),liveSearch(qb)]);setDa(a);setDb(b);setLoading(false);};
  return(<div><ToolHeader label="Tuotevertailu" back={back}/>
    <input value={qa} onChange={e=>setQa(e.target.value)} placeholder="Tuote A" style={{...inp,width:"100%",marginBottom:8}}/>
    <input value={qb} onChange={e=>setQb(e.target.value)} placeholder="Tuote B" style={{...inp,width:"100%",marginBottom:8}}/>
    <button onClick={run} style={{...btn(S.ink),width:"100%",marginBottom:10}}>Vertaa</button>
    {loading&&<Spinner/>}
    {!loading&&da&&<><p style={{fontWeight:600,fontSize:12,color:S.mut,marginBottom:4}}>Tuote A</p><Results data={da} loading={false} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/></>}
    {!loading&&db&&<><p style={{fontWeight:600,fontSize:12,color:S.mut,marginBottom:4,marginTop:12}}>Tuote B</p><Results data={db} loading={false} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/></>}
  </div>);
}

function VastaavaTool({back,isPlus,goPlus,favs,toggleFav,addList}) {
  const[q,setQ]=useState("");const[loading,setLoading]=useState(false);const[data,setData]=useState(null);
  const run=async()=>{if(!q.trim())return;setLoading(true);setData(await liveSearch(q));setLoading(false);};
  return(<div><ToolHeader label="Vastaava tuote" back={back}/>
    <p style={{fontSize:12.5,color:S.mut,marginBottom:8}}>Kirjoita tuote — näytämme vaihtoehdot eri kaupoista.</p>
    <div style={{display:"flex",gap:8,marginBottom:8}}><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="esim. Moroccanoil Treatment 100ml" style={{...inp,fontSize:13}}/><button onClick={run} style={btn(S.ink)}>🔍</button></div>
    <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
  </div>);
}

function LuonnollinenTool({back,isPlus,goPlus,favs,toggleFav,addList}) {
  const[q,setQ]=useState("");const[loading,setLoading]=useState(false);const[data,setData]=useState(null);
  const run=async()=>{if(!q.trim())return;setLoading(true);const d=await liveSearch(q);
    const pm=q.toLowerCase().match(/(\d+[.,]?\d*)\s*€/);
    if(pm&&d.ok){const max=parseFloat(pm[1].replace(",","."));d.results=d.results.filter(x=>x.price!=null&&x.price<=max);d.resultCount=d.results.length;}
    setData(d);setLoading(false);};
  return(<div><ToolHeader label="Luonnollisen kielen haku" back={back}/>
    <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="Kosteuttava shampoo max 9,90 €" style={{...inp,width:"100%",marginBottom:8}}/>
    <button onClick={run} style={{...btn(S.ink),width:"100%",marginBottom:10}}>Kysy AI-suunnittelijalta</button>
    <Results data={data} loading={loading} isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList}/>
  </div>);
}

function AsuTool({back,isPlus,goPlus,favs,toggleFav,addList,profile}) {
  const[budget,setBudget]=useState(80);const[loading,setLoading]=useState(false);const[picks,setPicks]=useState(null);
  const run=async()=>{setLoading(true);const kw=(profile.tyyliTags||[])[0]||"asukokonaisuus";const d=await liveSearch(kw+" vaate");
    if(d.ok){let t=0;const c=[];for(const it of d.results.sort((a,b)=>(a.price||999)-(b.price||999))){if(t+(it.price||999)<=budget){c.push(it);t+=it.price||0;}}setPicks({chosen:c,total:t});}else setPicks({error:d.error});
    setLoading(false);};
  return(<div><ToolHeader label="Asun etsiminen" back={back}/>
    {profile.mitat?.vaatekoko&&<p style={{fontSize:11.5,color:S.mut,marginBottom:8}}>Vaatekokosi: {profile.mitat.vaatekoko}</p>}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:12.5}}>Budjetti</span><input type="range" min={20} max={300} value={budget} onChange={e=>setBudget(+e.target.value)} style={{flex:1}}/><span style={{fontWeight:700,fontFamily:"monospace",fontSize:13}}>{eur(budget)}</span></div>
    <button onClick={run} style={{...btn(S.ink),width:"100%",marginBottom:10}}>Hae asukokonaisuus</button>
    {loading&&<Spinner/>}
    {!loading&&picks?.error&&<Err msg={picks.error}/>}
    {!loading&&picks?.chosen&&<>{picks.chosen.length===0&&<p style={{fontSize:12.5,color:S.mut}}>Budjetti ei riittänyt.</p>}{picks.chosen.map((it,i)=><ResultCard key={i} item={it} rank={null} toggleFav={toggleFav} addList={addList} isFav={favs.some(f=>f.link===it.link)} isPlus={isPlus} goPlus={goPlus}/>)}{picks.total>0&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontWeight:600,fontSize:12.5}}>Yhteensä</span><span style={{fontWeight:700,fontFamily:"monospace",fontSize:14}}>{eur(picks.total)}</span></div>}</>}
  </div>);
}

/* OSTOSLISTA */
function ScreenOstoslista({list,setList,markBought,toggleFav,isPlus,goPlus}) {
  const[optimizing,setOptimizing]=useState(false);
  const total=list.reduce((s,it)=>s+(it.price||0),0);
  const remove=i=>setList(list.filter((_,j)=>j!==i));
  const optimize=async()=>{setOptimizing(true);const u=[...list];
    for(let i=0;i<u.length;i++){const r=await liveSearch(u[i].title);if(r.ok&&r.results.length){const c=r.results.reduce((a,b)=>((b.price||999)<(a.price||999)?b:a));if((c.price||999)<(u[i].price||999))u[i]={...u[i],...c,previousPrice:u[i].price};}}
    setList(u);setOptimizing(false);};
  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>📋 Ostoslista</h2>
      {list.length===0&&<p style={{color:S.mut,fontSize:13}}>Tyhjä. Lisää tuotteita hausta.</p>}
      {list.length>0&&<div style={card()}><div style={{fontSize:12,color:S.mut}}>Yhteensä</div><div style={{fontSize:20,fontWeight:700,fontFamily:"monospace",color:S.ink}}>{eur(total)}</div></div>}
      {list.map((it,i)=>(
        <div key={i} style={card()}>
          <div style={{display:"flex",gap:10}}>
            {it.image&&<img src={it.image} alt="" style={{width:44,height:44,borderRadius:10,objectFit:"cover"}} onError={e=>{e.target.style.display="none"}}/>}
            <div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:600,color:S.ink}}>{it.title}</div>{it.store&&<div style={{fontSize:11,color:S.mut}}>{it.store}</div>}
              <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:4}}>
                {it.previousPrice>it.price&&<span style={{fontSize:11.5,color:S.mut,textDecoration:"line-through"}}>{eur(it.previousPrice)}</span>}
                <span style={{fontSize:15,fontWeight:700,fontFamily:"monospace",color:it.previousPrice>it.price?S.grn:S.ink}}>{eur(it.price)}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <button onClick={()=>markBought(i)} style={{flex:1,...btn(S.ink),fontSize:11}}>✅ Ostettu</button>
            {it.link&&<a href={it.link} target="_blank" rel="noreferrer" style={{...btn(S.rs,S.rd),textDecoration:"none",fontSize:11}}>🔗</a>}
            <button onClick={()=>{toggleFav(it);remove(i);}} style={{...btn(S.rs,S.rd),fontSize:11}}>❤️</button>
            <button onClick={()=>remove(i)} style={{...btn(S.bg,S.mut),fontSize:11}}>✕</button>
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

/* PLUS */
function ScreenPlus({isPlus,toggle}) {
  return(
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.ink}}>Osta fiksummin, säästä ja saa enemmän.</h2>
      <div style={{...card(),marginTop:16,padding:16}}>
        <div style={{fontSize:26,fontWeight:700,fontFamily:"monospace",color:S.ink}}>4,99 € <span style={{fontSize:12,fontWeight:400,color:S.mut}}>/kk</span></div>
        <div style={{marginTop:12}}>
          {["Rajattomat live-hakukerrat","AI-suunnittelija kaikilla työkaluilla","Alennuskoodihaku kaupan omilta sivuilta","Ostoslistan optimointi tuorein hinnoin"].map(f=><div key={f} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{color:S.grn}}>✓</span><span style={{fontSize:12.5,color:S.ink}}>{f}</span></div>)}
        </div>
        <button onClick={toggle} style={{width:"100%",marginTop:14,...btn(isPlus?S.brd:S.rose,isPlus?S.mut:S.wh),padding:"12px 0",fontSize:14}}>{isPlus?"Palaa Free-näkymään":"Aktivoi Plus"}</button>
      </div>
    </div>
  );
}

/* PROFIILI */
const HO=["ohuet hiukset","paksut hiukset","kuivat hiukset","rasvoittuva hiuspohja","kiharat hiukset","värjätyt hiukset","vaurioituneet hiukset"];
const KO=["herkkä iho","normaali iho","rasvoittuva iho","kuiva iho","yhdistelmäiho","aknealtis iho","kypsyvä iho"];
const TO=["arkikäyttö","klassikko","minimalistinen","boheemi","urheilullinen","juhlava"];

function ScreenProfiili({profile,setProfile,auth,setAuth,hist,budgetD,setBudgetD,saveBudget,exportData,deleteAccount}) {
  const setM=(k,v)=>setProfile({...profile,mitat:{...profile.mitat,[k]:v}});
  const tog=(g,t)=>{const c=profile[g]||[];setProfile({...profile,[g]:c.includes(t)?c.filter(x=>x!==t):[...c,t]});};
  const spent=hist.reduce((s,p)=>s+p.price,0);
  const[settingsOpen,setSettingsOpen]=useState(null);
  const[nameF,setNameF]=useState(auth.name);const[emailF,setEmailF]=useState("");const[pwF,setPwF]=useState("");
  const[toast,setToast]=useState("");
  const flash=m=>{setToast(m);setSettingsOpen(null);setTimeout(()=>setToast(""),3000);};

  return(
    <div>
      <h2 style={{fontSize:21,fontWeight:700,color:S.ink,marginBottom:12}}>👤 Oma profiili</h2>
      {auth.loggedIn&&<div style={{...card(),display:"flex",alignItems:"center",gap:12,marginBottom:16}}><div style={{width:40,height:40,borderRadius:20,background:S.rs,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👤</div><div><div style={{fontWeight:600,fontSize:13,color:S.ink}}>{auth.name}</div><div style={{fontSize:11,color:S.mut}}>{auth.email}</div></div></div>}

      <h3 style={{fontSize:14,fontWeight:600,color:S.ink,marginBottom:8}}>🧴 Hiukset</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>{HO.map(o=><button key={o} onClick={()=>tog("hiuksetTags",o)} style={chip((profile.hiuksetTags||[]).includes(o))}>{o}</button>)}</div>
      <h3 style={{fontSize:14,fontWeight:600,color:S.ink,marginBottom:8}}>💄 Kosmetiikka</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>{KO.map(o=><button key={o} onClick={()=>tog("kosmetiikkaTags",o)} style={chip((profile.kosmetiikkaTags||[]).includes(o))}>{o}</button>)}</div>
      <h3 style={{fontSize:14,fontWeight:600,color:S.ink,marginBottom:8}}>👗 Tyyli</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>{TO.map(o=><button key={o} onClick={()=>tog("tyyliTags",o)} style={chip((profile.tyyliTags||[]).includes(o))}>{o}</button>)}</div>

      <h3 style={{fontSize:14,fontWeight:600,color:S.ink,marginBottom:8}}>📏 Omat mitat</h3>
      <div style={card()}>
        {[["Pituus","pituus","cm"],["Rinnanympärys","rinta","cm"],["Vyötärö","vyotaro","cm"],["Lantio","lantio","cm"],["Vaatekoko","vaatekoko",""],["Kengän koko","kengankoko",""],["Ihon sävy","ihonsavy",""],["Hiusten väri","hiustenvari",""]].map(([l,k,u])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+S.brd}}>
            <span style={{fontSize:12.5,color:S.ink}}>{l}</span>
            <div style={{display:"flex",alignItems:"center",gap:4}}><input value={profile.mitat?.[k]||""} onChange={e=>setM(k,e.target.value)} placeholder="—" style={{fontFamily:"monospace",textAlign:"right",outline:"none",border:"none",background:"transparent",fontSize:13,color:S.ink,width:70}}/>{u&&<span style={{fontSize:11,color:S.mut}}>{u}</span>}</div>
          </div>
        ))}
      </div>
      <p style={{fontSize:10.5,color:S.mut,marginTop:6,marginBottom:16}}>Kaikki kentät ovat vapaaehtoisia ja yksityisiä.</p>

      <h3 style={{fontSize:14,fontWeight:600,color:S.ink,marginBottom:8}}>💳 Budjetti</h3>
      <div style={card()}>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:S.mut}}>Kuukausibudjetti</span><div style={{display:"flex",alignItems:"center",gap:4}}><input type="number" value={budgetD} onChange={e=>setBudgetD(+e.target.value)} style={{fontFamily:"monospace",textAlign:"right",outline:"none",border:"none",background:"transparent",fontSize:14,color:S.ink,width:60}}/><span style={{fontFamily:"monospace",fontSize:13,color:S.mut}}>€</span></div></div>
        <div style={{width:"100%",height:8,borderRadius:4,background:S.brd,marginTop:8}}><div style={{height:8,borderRadius:4,background:spent>budgetD?S.rose:S.grn,width:Math.min(100,(spent/budgetD)*100)+"%"}}/></div>
        <p style={{fontSize:11,color:S.mut,marginTop:6}}>{eur(spent)} käytetty · jäljellä {eur(Math.max(0,budgetD-spent))}</p>
        <button onClick={saveBudget} style={{...btn(S.ink),width:"100%",marginTop:10}}>Tallenna</button>
        <p style={{fontSize:10.5,color:S.mut,marginTop:6}}>Kerromme, jos ostos ylittäisi budjetin – emme estä ostamista.</p>
      </div>

      <h3 style={{fontSize:14,fontWeight:600,color:S.ink,marginTop:16,marginBottom:8}}>Ostohistoria</h3>
      {hist.length===0&&<p style={{fontSize:12,color:S.mut}}>Ei ostoksia — merkitse tuote ostetuksi ostoslistalla.</p>}
      {hist.map((p,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",...card(),padding:10}}><div><div style={{fontSize:12,fontWeight:600,color:S.ink}}>{p.date} {p.name}</div><div style={{fontSize:10.5,color:S.mut}}>{p.store}</div></div><span style={{fontFamily:"monospace",fontWeight:700,fontSize:12.5,color:S.ink}}>{eur(p.price)}</span></div>)}

      <div style={{...card(S.rs,S.rd),marginTop:16,padding:14}}>
        <div style={{fontWeight:600,fontSize:12.5,color:S.rd}}>⚙️ Asetukset ja tietosuoja</div>
        <p style={{fontSize:11,color:S.rd,marginTop:6}}>Mitat, ostohistoria, budjetti ja suosikit ovat yksityisiä. Voit poistaa tietosi milloin tahansa.</p>
      </div>

      {toast&&<div style={{...card(S.gs,S.grn),marginTop:10,padding:10}}><span style={{fontWeight:600,fontSize:12,color:S.grn}}>✓ {toast}</span></div>}
      <div style={{...card(),marginTop:10,overflow:"hidden",padding:0}}>
        <button onClick={()=>setSettingsOpen(settingsOpen==="edit"?null:"edit")} style={{width:"100%",padding:"12px 14px",background:S.wh,border:"none",borderBottom:"1px solid "+S.brd,textAlign:"left",fontSize:12.5,color:S.ink,cursor:"pointer"}}>Muokkaa henkilötietoja ▾</button>
        {settingsOpen==="edit"&&<div style={{padding:12,background:S.bg}}>
          <input value={nameF} onChange={e=>setNameF(e.target.value)} placeholder="Nimi" style={{...inp,width:"100%",marginBottom:8}}/>
          <button onClick={()=>{setAuth({...auth,name:nameF});flash("Tiedot päivitetty.");}} style={{...btn(S.ink),width:"100%"}}>Tallenna</button>
        </div>}
        <button onClick={()=>setSettingsOpen(settingsOpen==="email"?null:"email")} style={{width:"100%",padding:"12px 14px",background:S.wh,border:"none",borderBottom:"1px solid "+S.brd,textAlign:"left",fontSize:12.5,color:S.ink,cursor:"pointer"}}>Vaihda sähköposti ▾</button>
        {settingsOpen==="email"&&<div style={{padding:12,background:S.bg}}>
          <p style={{fontSize:11,color:S.mut,marginBottom:6}}>Nykyinen: {auth.email}</p>
          <input value={emailF} onChange={e=>setEmailF(e.target.value)} placeholder="Uusi sähköposti" style={{...inp,width:"100%",marginBottom:8}}/>
          <button disabled={!emailF.includes("@")} onClick={()=>{setAuth({...auth,email:emailF});setEmailF("");flash("Sähköposti vaihdettu.");}} style={{...btn(emailF.includes("@")?S.ink:S.brd,emailF.includes("@")?S.wh:S.mut),width:"100%"}}>Vaihda</button>
        </div>}
        <button onClick={()=>setSettingsOpen(settingsOpen==="pw"?null:"pw")} style={{width:"100%",padding:"12px 14px",background:S.wh,border:"none",borderBottom:"1px solid "+S.brd,textAlign:"left",fontSize:12.5,color:S.ink,cursor:"pointer"}}>Vaihda salasana ▾</button>
        {settingsOpen==="pw"&&<div style={{padding:12,background:S.bg}}>
          <input type="password" value={pwF} onChange={e=>setPwF(e.target.value)} placeholder="Uusi salasana (väh. 8 merkkiä)" style={{...inp,width:"100%",marginBottom:8}}/>
          <button disabled={pwF.length<8} onClick={()=>{setPwF("");flash("Salasana vaihdettu.");}} style={{...btn(pwF.length>=8?S.ink:S.brd,pwF.length>=8?S.wh:S.mut),width:"100%"}}>Vaihda</button>
        </div>}
        <button onClick={exportData} style={{width:"100%",padding:"12px 14px",background:S.wh,border:"none",borderBottom:"1px solid "+S.brd,textAlign:"left",fontSize:12.5,color:S.ink,cursor:"pointer"}}>Lataa tietoni ↗</button>
        <button onClick={()=>setSettingsOpen(settingsOpen==="del"?null:"del")} style={{width:"100%",padding:"12px 14px",background:S.wh,border:"none",textAlign:"left",fontSize:12.5,color:S.rose,cursor:"pointer"}}>Poista tili ▾</button>
        {settingsOpen==="del"&&<div style={{padding:12,background:S.bg}}>
          <p style={{fontSize:11.5,color:S.rose,marginBottom:8}}>Poistaa profiilin, suosikit, ostoslistan ja historian pysyvästi.</p>
          <button onClick={deleteAccount} style={{...btn(S.rose),width:"100%"}}>Vahvista poisto</button>
        </div>}
      </div>
    </div>
  );
}

/* ── AUTH ── */
function Auth({onDone,onSkip}) {
  const[mode,setMode]=useState("register");
  const[f,setF]=useState({name:"",email:"",phone:"",pw:""});
  const s=(k,v)=>setF({...f,[k]:v});
  const ok=mode==="login"?f.email&&f.pw:f.name&&f.email&&f.pw;
  return(
    <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 24px",background:S.bg,fontFamily:"system-ui, sans-serif"}}>
      <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:26,fontWeight:700,color:S.ink}}>Shoppailu <span style={{color:S.rose}}>PLUS</span></div><p style={{fontSize:13,color:S.mut,marginTop:4}}>{mode==="register"?"Luo tili":"Kirjaudu"}</p></div>
      <div style={{display:"flex",borderRadius:24,padding:4,background:S.rs,marginBottom:20}}>
        {[["register","Luo tili"],["login","Kirjaudu"]].map(([k,l])=><button key={k} onClick={()=>setMode(k)} style={{flex:1,borderRadius:20,padding:"8px 0",background:mode===k?S.wh:"transparent",border:"none",fontWeight:600,fontSize:13,color:S.ink,cursor:"pointer"}}>{l}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {mode==="register"&&<input value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Nimi" style={inp}/>}
        <input value={f.email} onChange={e=>s("email",e.target.value)} placeholder="Sähköposti" style={inp}/>
        {mode==="register"&&<input value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="Puhelin (valinnainen)" style={inp}/>}
        <input type="password" value={f.pw} onChange={e=>s("pw",e.target.value)} placeholder="Salasana" style={inp}/>
      </div>
      <button disabled={!ok} onClick={()=>onDone({name:f.name||f.email.split("@")[0],email:f.email,phone:f.phone})} style={{...btn(ok?S.rose:S.brd,ok?S.wh:S.mut),width:"100%",marginTop:20,padding:"12px 0",fontSize:14}}>{mode==="register"?"Luo tili":"Kirjaudu"}</button>
      <button onClick={onSkip} style={{background:"none",border:"none",color:S.mut,fontSize:12.5,textDecoration:"underline",marginTop:16,cursor:"pointer"}}>Jatka ilman kirjautumista</button>
    </div>
  );
}

/* ── MAIN APP ── */
function App() {
  const[auth,setAuth]=useState({loggedIn:false,name:"",email:"",phone:""});
  const[skipped,setSkipped]=useState(false);
  const[scr,setScr]=useState("koti");
  const[menuOpen,setMenuOpen]=useState(false);
  const[isPlus,setIsPlus]=useState(false);
  const[freeLeft,setFreeLeft]=useState(10);
  const[favs,setFavs]=useState([]);
  const[list,setList]=useState([]);
  const[savings,setSavings]=useState(0);
  const[hist,setHist]=useState([]);
  const[profile,setProfile]=useState({hiuksetTags:[],kosmetiikkaTags:[],tyyliTags:[],mitat:{},budjetti:200});
  const[budgetD,setBudgetD]=useState(200);

  const useFree=()=>{if(!isPlus)setFreeLeft(n=>Math.max(0,n-1));};
  const toggleFav=item=>setFavs(f=>f.some(x=>x.link===item.link)?f.filter(x=>x.link!==item.link):[...f,item]);
  const addList=item=>setList(l=>[...l,{...item,addedAt:Date.now()}]);
  const goPlus=()=>setScr("plus");
  const markBought=i=>{const it=list[i];setHist(h=>[{date:today(),name:it.title,store:it.store,price:it.price},...h]);setList(l=>l.filter((_,j)=>j!==i));};
  const saveBudget=()=>setProfile(p=>({...p,budjetti:budgetD}));
  const exportData=()=>{const d={profiili:profile,suosikit:favs,ostoslista:list,ostohistoria:hist};const b=new Blob([JSON.stringify(d,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="shoppailu-plus.json";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);};
  const deleteAccount=()=>{setAuth({loggedIn:false,name:"",email:"",phone:""});setSkipped(false);setFavs([]);setList([]);setHist([]);setProfile({hiuksetTags:[],kosmetiikkaTags:[],tyyliTags:[],mitat:{},budjetti:200});setBudgetD(200);setSavings(0);setIsPlus(false);};
  const spent=hist.reduce((s,p)=>s+p.price,0);

  const MENU=[["koti","🏠 Koti"],["haku","🔍 Haku"],["skannaa","📷 Skannaa"],["ai","✨ AI-suunnittelija"],["ostoslista","📋 Ostoslista"],["suosikit","❤️ Suosikit"],["plus","👑 Shoppailu PLUS"],["profiili","👤 Oma profiili"]];
  const NAV=[["koti","🏠","Koti"],["haku","🔍","Haku"],["skannaa","📷","Skannaa"],["ai","✨","AI"],["ostoslista","📋","Lista"],["plus","👑","PLUS+"],["profiili","👤","Profiili"]];

  if(!auth.loggedIn&&!skipped)return <Auth onDone={u=>setAuth({loggedIn:true,...u})} onSkip={()=>setSkipped(true)}/>;

  let content;
  if(scr==="koti")content=<ScreenKoti go={setScr} listN={list.length} favN={favs.length} spent={spent} budget={profile.budjetti} savings={savings}/>;
  else if(scr==="haku")content=<ScreenHaku isPlus={isPlus} freeLeft={freeLeft} useFree={useFree} favs={favs} toggleFav={toggleFav} addList={addList} goPlus={goPlus}/>;
  else if(scr==="skannaa")content=<ScreenSkannaa isPlus={isPlus} freeLeft={freeLeft} useFree={useFree} favs={favs} toggleFav={toggleFav} addList={addList} goPlus={goPlus}/>;
  else if(scr==="ai")content=<ScreenAI isPlus={isPlus} goPlus={goPlus} favs={favs} toggleFav={toggleFav} addList={addList} profile={profile}/>;
  else if(scr==="ostoslista")content=<ScreenOstoslista list={list} setList={setList} markBought={markBought} toggleFav={toggleFav} isPlus={isPlus} goPlus={goPlus}/>;
  else if(scr==="suosikit")content=<ScreenSuosikit favs={favs} toggleFav={toggleFav} addList={addList} isPlus={isPlus} goPlus={goPlus}/>;
  else if(scr==="plus")content=<ScreenPlus isPlus={isPlus} toggle={()=>setIsPlus(!isPlus)}/>;
  else if(scr==="profiili")content=<ScreenProfiili profile={profile} setProfile={setProfile} auth={auth} setAuth={setAuth} hist={hist} budgetD={budgetD} setBudgetD={setBudgetD} saveBudget={saveBudget} exportData={exportData} deleteAccount={deleteAccount}/>;

  return(
    <div style={{maxWidth:480,margin:"0 auto",fontFamily:"system-ui, sans-serif",background:S.bg,minHeight:"100vh",position:"relative"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <button onClick={()=>setMenuOpen(true)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer"}}>☰</button>
        <button onClick={()=>setScr("koti")} style={{background:"none",border:"none",cursor:"pointer"}}><span style={{fontSize:20,fontWeight:700,color:S.ink}}>Shoppailu <span style={{color:S.rose}}>PLUS</span></span></button>
        <button onClick={()=>setIsPlus(!isPlus)} style={{background:isPlus?S.ink:S.rs,color:isPlus?S.wh:S.rd,border:"none",borderRadius:20,padding:"5px 12px",fontWeight:700,fontSize:11,cursor:"pointer"}}>{isPlus?"👑 PLUS+":"FREE"} ↻</button>
      </div>

      {/* Content */}
      <div style={{padding:"8px 16px",paddingBottom:80}}>{content}</div>

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,display:"flex",justifyContent:"space-around",background:S.wh,borderTop:"1px solid "+S.brd,paddingBottom:"env(safe-area-inset-bottom)",maxWidth:480,margin:"0 auto",zIndex:40}}>
        {NAV.map(([k,icon,label])=>(
          <button key={k} onClick={()=>setScr(k)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 0",background:"none",border:"none",cursor:"pointer",position:"relative"}}>
            <span style={{fontSize:16}}>{icon}</span>
            <span style={{fontSize:9.5,fontWeight:scr===k?700:400,color:scr===k?S.rose:S.mut}}>{label}</span>
            {k==="ostoslista"&&list.length>0&&<span style={{position:"absolute",top:2,right:"25%",background:S.rose,color:S.wh,fontSize:9,width:15,height:15,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace"}}>{list.length}</span>}
          </button>
        ))}
      </div>

      {/* Menu drawer */}
      {menuOpen&&<div style={{position:"fixed",inset:0,zIndex:50,display:"flex"}}>
        <div style={{flex:1,background:"rgba(0,0,0,0.3)"}} onClick={()=>setMenuOpen(false)}/>
        <div style={{width:280,height:"100%",background:S.wh,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"24px 20px 16px"}}><span style={{fontSize:18,fontWeight:700,color:S.ink}}>Valikko</span><button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer"}}>✕</button></div>
          {MENU.map(([k,l])=><button key={k} onClick={()=>{setScr(k);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",background:"none",border:"none",fontSize:15,color:S.ink,cursor:"pointer",textAlign:"left"}}>{l}<span style={{marginLeft:"auto",color:S.mut}}>›</span></button>)}
        </div>
      </div>}
    </div>
  );
}

window.App = App;
