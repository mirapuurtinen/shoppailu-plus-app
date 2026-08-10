const { useState, useRef } = React;

const API = "https://shoppailu-plus-backend-msd9.vercel.app";

const eur = (n) => n != null ? n.toFixed(2).replace(".", ",") + " €" : "—";

function App() {
  const [screen, setScreen] = useState("haku");
  const [isPlus, setIsPlus] = useState(false);
  const [freeLeft, setFreeLeft] = useState(10);
  const [favs, setFavs] = useState([]);
  const [list, setList] = useState([]);
  const [hist, setHist] = useState([]);

  const toggleFav = (item) => setFavs(f => f.some(x => x.link === item.link) ? f.filter(x => x.link !== item.link) : [...f, item]);
  const addList = (item) => setList(l => [...l, { ...item, addedAt: Date.now() }]);
  const useFree = () => { if (!isPlus) setFreeLeft(n => Math.max(0, n - 1)); };
  const markBought = (i) => {
    const it = list[i];
    setHist(h => [{ date: new Date().toLocaleDateString("fi-FI"), name: it.title, store: it.store, price: it.price }, ...h]);
    setList(l => l.filter((_, j) => j !== i));
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "system-ui, sans-serif", background: "#FFF8F3", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 16px 10px" }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#2B1B2E" }}>Shoppailu <span style={{ color: "#E8447F" }}>PLUS</span></span>
        <button onClick={() => setIsPlus(!isPlus)} style={{ background: isPlus ? "#2B1B2E" : "#FFE0EE", color: isPlus ? "#fff" : "#C22E68", border: "none", borderRadius: 20, padding: "5px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          {isPlus ? "👑 PLUS+" : "FREE"} ↻
        </button>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #F0DCE6", padding: "0 8px" }}>
        {[["haku", "🔍 Haku"], ["lista", "📋 Lista (" + list.length + ")"], ["fav", "❤️ Suosikit"], ["historia", "📊 Historia"]].map(([k, l]) => (
          <button key={k} onClick={() => setScreen(k)} style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", borderBottom: screen === k ? "2px solid #E8447F" : "2px solid transparent", color: screen === k ? "#E8447F" : "#8A7A86", fontWeight: screen === k ? 700 : 400, fontSize: 12, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: "12px 16px", paddingBottom: 40 }}>
        {screen === "haku" && <SearchScreen isPlus={isPlus} freeLeft={freeLeft} useFree={useFree} toggleFav={toggleFav} addList={addList} favs={favs} goPlus={() => setScreen("plus")} />}
        {screen === "lista" && <ListScreen list={list} setList={setList} markBought={markBought} toggleFav={toggleFav} />}
        {screen === "fav" && <FavScreen favs={favs} toggleFav={toggleFav} addList={addList} />}
        {screen === "historia" && <HistScreen hist={hist} />}
        {screen === "plus" && <PlusScreen isPlus={isPlus} toggle={() => setIsPlus(!isPlus)} />}
      </div>
    </div>
  );
}

function SearchScreen({ isPlus, freeLeft, useFree, toggleFav, addList, favs, goPlus }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const run = async (text) => {
    const query = (text || q).trim();
    if (!query) return;
    if (!isPlus && freeLeft <= 0) { setError("Free-hakukerrat käytetty tältä kuulta. Aktivoi Plus."); return; }
    setLoading(true); setData(null); setError(null);
    try {
      const res = await fetch(API + "/api/search?q=" + encodeURIComponent(query) + "&gl=fi&hl=fi");
      const json = await res.json();
      if (!json.ok) { setError(json.error); }
      else { setData(json); useFree(); }
    } catch (e) { setError("Yhteys backendiin epäonnistui: " + e.message); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && run()}
          placeholder="Kirjoita tuote, esim. Lumene CC Cream"
          style={{ flex: 1, padding: "12px 14px", borderRadius: 14, border: "1.5px solid #F0DCE6", fontSize: 14, outline: "none", background: "#fff" }} />
        <button onClick={() => run()} disabled={loading}
          style={{ padding: "12px 20px", borderRadius: 14, border: "none", background: (!isPlus && freeLeft <= 0) ? "#F0DCE6" : "#E8447F", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {loading ? "⏳" : "Hae"}
        </button>
      </div>

      {!isPlus && <p style={{ fontSize: 12, color: "#8A7A86", marginBottom: 8 }}>Ilmaisia hakuja jäljellä: {freeLeft}/10</p>}
      <p style={{ fontSize: 11, color: "#8A7A86", marginBottom: 12 }}>Tulokset haetaan reaaliajassa Google Shoppingista. Hinnat ja saatavuus voivat muuttua.</p>

      {loading && <div style={{ textAlign: "center", padding: 40, color: "#E8447F" }}>⏳ Haetaan oikeita hintoja internetistä…</div>}
      {error && <div style={{ background: "#FFF3D1", color: "#92720B", padding: 12, borderRadius: 14, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      {data && data.results && (
        <div>
          <p style={{ fontSize: 12, color: "#8A7A86", marginBottom: 8 }}>{data.resultCount} tulosta — halvimmasta kalleimpaan</p>
          {data.results.length === 0 && <p style={{ color: "#8A7A86", fontSize: 13 }}>Ei tuloksia. Kokeile toista hakusanaa.</p>}
          {data.results.map((item, i) => (
            <ResultCard key={i} item={item} rank={i} toggleFav={toggleFav} addList={addList} isFav={favs.some(f => f.link === item.link)} isPlus={isPlus} goPlus={goPlus} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ item, rank, toggleFav, addList, isFav, isPlus, goPlus }) {
  const [codesOpen, setCodesOpen] = useState(false);
  const [codes, setCodes] = useState(null);
  const [codesLoading, setCodesLoading] = useState(false);

  const domain = (() => { try { return new URL(item.link).hostname.replace(/^www\./, ""); } catch { return null; } })();

  const loadCodes = async () => {
    if (!isPlus) return goPlus();
    setCodesOpen(true); if (codes) return;
    setCodesLoading(true);
    try {
      const res = await fetch(API + "/api/codes?domain=" + encodeURIComponent(domain));
      setCodes(await res.json());
    } catch (e) { setCodes({ error: e.message }); }
    setCodesLoading(false);
  };

  const bg = rank === 0 ? "#DFF7E9" : rank === 1 ? "#FFF3D1" : "#fff";
  const bc = rank === 0 ? "#1FA463" : rank === 1 ? "#FFC940" : "#F0DCE6";
  const badge = rank === 0 ? "🏷️ Halvin" : rank === 1 ? "🏷️ 2. halvin" : null;

  return (
    <div style={{ background: bg, border: "1.5px solid " + bc, borderRadius: 16, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        {item.image && <img src={item.image} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", background: "#FFE0EE" }} onError={e => { e.target.style.display = "none"; }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {badge && <span style={{ background: rank === 0 ? "#1FA463" : "#92720B", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "2px 8px", display: "inline-block", marginBottom: 4 }}>{badge}</span>}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2B1B2E", lineHeight: 1.3 }}>{item.title}</div>
          {item.store && <div style={{ fontSize: 11, color: "#8A7A86", marginTop: 2 }}>🏪 {item.store}</div>}
          {item.delivery && <div style={{ fontSize: 10.5, color: "#8A7A86" }}>🚚 {item.delivery}</div>}
          {item.rating && <div style={{ fontSize: 10.5, color: "#8A7A86" }}>⭐ {item.rating}{item.ratingCount ? " (" + item.ratingCount + ")" : ""}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {item.price != null
            ? <div style={{ fontSize: 16, fontWeight: 700, color: "#2B1B2E", fontFamily: "monospace" }}>{eur(item.price)}</div>
            : <div style={{ fontSize: 11, color: "#8A7A86" }}>Hinta ei saatavilla</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {item.link
          ? <a href={item.link} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", background: "#2B1B2E", color: "#fff", borderRadius: 10, padding: "7px 0", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>🔗 Tuotesivulle</a>
          : <span style={{ flex: 1, textAlign: "center", background: "#F0DCE6", color: "#8A7A86", borderRadius: 10, padding: "7px 0", fontSize: 12 }}>Ei linkkiä</span>}
        <button onClick={() => addList(item)} style={{ background: "#FFE0EE", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", fontSize: 12 }} title="Ostoslistalle">📋</button>
        <button onClick={() => toggleFav(item)} style={{ background: isFav ? "#C22E68" : "#FFE0EE", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", fontSize: 12, color: isFav ? "#fff" : "#C22E68" }} title="Suosikkeihin">{isFav ? "💗" : "🤍"}</button>
      </div>

      {domain && (
        <button onClick={loadCodes} style={{ width: "100%", marginTop: 8, background: "#fff", border: "1px solid #F0DCE6", borderRadius: 10, padding: "6px 0", fontSize: 11, color: "#C22E68", fontWeight: 600, cursor: "pointer" }}>
          🏷️ Alennuskoodeja: {domain} {!isPlus && "🔒"}
        </button>
      )}

      {codesOpen && isPlus && (
        <div style={{ marginTop: 8, background: "#FFF8F3", borderRadius: 10, padding: 10 }}>
          {codesLoading && <div style={{ textAlign: "center", color: "#E8447F", fontSize: 12 }}>⏳ Haetaan…</div>}
          {!codesLoading && codes?.error && <p style={{ fontSize: 11, color: "#92720B" }}>{codes.error}</p>}
          {!codesLoading && codes?.results?.length === 0 && <p style={{ fontSize: 11, color: "#8A7A86" }}>Ei kampanjamainintoja kaupan {domain} sivuilta.</p>}
          {!codesLoading && codes?.results?.map((c, i) => (
            <a key={i} href={c.link} target="_blank" rel="noreferrer" style={{ display: "block", background: "#fff", borderRadius: 8, padding: 8, marginBottom: 6, textDecoration: "none" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#2B1B2E" }}>{c.title}</div>
              <div style={{ fontSize: 10, color: "#8A7A86" }}>{c.snippet}</div>
            </a>
          ))}
          <p style={{ fontSize: 9.5, color: "#8A7A86", marginTop: 4 }}>Haettu kaupan omalta sivulta. Tarkista voimassaolo kassalla.</p>
        </div>
      )}
    </div>
  );
}

function ListScreen({ list, setList, markBought, toggleFav }) {
  if (list.length === 0) return <p style={{ color: "#8A7A86", fontSize: 13, marginTop: 20 }}>Ostoslista on tyhjä. Lisää tuotteita hausta.</p>;
  const total = list.reduce((s, it) => s + (it.price || 0), 0);
  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #F0DCE6", borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#8A7A86" }}>Yhteensä</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "#2B1B2E" }}>{eur(total)}</div>
      </div>
      {list.map((it, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #F0DCE6", borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {it.image && <img src={it.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#2B1B2E" }}>{it.title}</div>
              {it.store && <div style={{ fontSize: 11, color: "#8A7A86" }}>{it.store}</div>}
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "#2B1B2E", marginTop: 4 }}>{eur(it.price)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => markBought(i)} style={{ flex: 1, background: "#2B1B2E", color: "#fff", border: "none", borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✅ Ostettu</button>
            {it.link && <a href={it.link} target="_blank" rel="noreferrer" style={{ background: "#FFE0EE", borderRadius: 8, padding: "6px 10px", fontSize: 11, textDecoration: "none" }}>🔗</a>}
            <button onClick={() => { toggleFav(it); setList(l => l.filter((_, j) => j !== i)); }} style={{ background: "#FFE0EE", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>❤️</button>
            <button onClick={() => setList(l => l.filter((_, j) => j !== i))} style={{ background: "#FFF8F3", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FavScreen({ favs, toggleFav, addList }) {
  if (favs.length === 0) return <p style={{ color: "#8A7A86", fontSize: 13, marginTop: 20 }}>Ei suosikkeja. Lisää tuotteita hausta.</p>;
  return (
    <div>
      {favs.map((it, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #F0DCE6", borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2B1B2E" }}>{it.title}</div>
          {it.store && <div style={{ fontSize: 11, color: "#8A7A86" }}>{it.store}</div>}
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "#2B1B2E", marginTop: 4 }}>{eur(it.price)}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {it.link && <a href={it.link} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", background: "#2B1B2E", color: "#fff", borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>🔗 Tuotesivulle</a>}
            <button onClick={() => addList(it)} style={{ background: "#FFE0EE", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>📋</button>
            <button onClick={() => toggleFav(it)} style={{ background: "#FFF8F3", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>✕ Poista</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistScreen({ hist }) {
  if (hist.length === 0) return <p style={{ color: "#8A7A86", fontSize: 13, marginTop: 20 }}>Ei ostohistoriaa. Merkitse tuote ostetuksi ostoslistalla.</p>;
  const total = hist.reduce((s, p) => s + (p.price || 0), 0);
  return (
    <div>
      <div style={{ background: "#DFF7E9", borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#1FA463" }}>Tämän kuukauden ostokset</div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "#1FA463" }}>{eur(total)}</div>
      </div>
      {hist.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "#fff", border: "1px solid #F0DCE6", borderRadius: 10, padding: 10, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#2B1B2E" }}>{p.date} {p.name}</div>
            <div style={{ fontSize: 10.5, color: "#8A7A86" }}>{p.store}</div>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "monospace", color: "#2B1B2E" }}>{eur(p.price)}</span>
        </div>
      ))}
    </div>
  );
}

function PlusScreen({ isPlus, toggle }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#2B1B2E" }}>Osta fiksummin, säästä ja saa enemmän.</h2>
      <div style={{ background: "#fff", border: "1px solid #F0DCE6", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "monospace", color: "#2B1B2E" }}>4,99 € <span style={{ fontSize: 12, fontWeight: 400, color: "#8A7A86" }}>/kk</span></div>
        <div style={{ marginTop: 12 }}>
          {["Rajattomat live-hakukerrat", "Alennuskoodihaku kaupan omilta sivuilta", "Ostoslistan optimointi tuorein hinnoin", "AI-suunnittelija (tulossa)"].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "#1FA463" }}>✓</span>
              <span style={{ fontSize: 12.5, color: "#2B1B2E" }}>{f}</span>
            </div>
          ))}
        </div>
        <button onClick={toggle} style={{ width: "100%", marginTop: 14, padding: "12px 0", borderRadius: 12, border: "none", background: isPlus ? "#F0DCE6" : "#E8447F", color: isPlus ? "#8A7A86" : "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {isPlus ? "Palaa Free-näkymään" : "Aktivoi Plus"}
        </button>
      </div>
    </div>
  );
}

window.App = App;
