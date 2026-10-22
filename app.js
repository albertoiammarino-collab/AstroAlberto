/* ============================================================
   ALBERTO ASTRO - App astronomica (v4 - meteo astronomico)
   ============================================================ */
'use strict';

window.__appLoaded = false;

// ---------- UTILS ----------
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const norm360 = x => ((x % 360) + 360) % 360;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hasAstro = () => typeof Astronomy !== 'undefined';

// ---------- STATO ----------
const state = {
  lat: 41.9028, lon: 12.4964,
  baseTime: new Date(), currentTime: new Date(),
  camAlt: 45, camAz: 0, fov: 80,
  clouds: 0, target: null, sqm: 21.0,
  gpsLiveWatchId: null, gpsLiveActive: false, gpsAccuracy: null,
  catalogFilter: 'all', catalogDetailObj: null,
  weatherMap: null,
  owmApiKey: localStorage.getItem('albertoastro_owm_key') || '',
  weatherTimer: null, radarLayer: null,
  // Nuovi campi per meteo astronomico
  seeing: null, transparency: null, astroCloud: null,
  astroInit: null
};
const _planetCache = { key: null, data: null };

const PLANET_NAMES = ["Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune"];
const PLANET_SYMBOLS = {Mercury:"☿",Venus:"♀",Mars:"♂",Jupiter:"♃",Saturn:"♄",Uranus:"♅",Neptune:"♆"};
const PLANET_COLORS = {Mercury:"#a8a8a8",Venus:"#f0e68c",Mars:"#ff6347",Jupiter:"#ffd700",Saturn:"#f4e4a1",Uranus:"#87ceeb",Neptune:"#4169e1"};
const PLANET_IT = {Mercury:"Mercurio",Venus:"Venere",Mars:"Marte",Jupiter:"Giove",Saturn:"Saturno",Uranus:"Urano",Neptune:"Nettuno"};

// ... (STARS, MESSIER, NEBULAE_EXTRA, CONSTELLATIONS rimangono invariati; per brevità non li ripeto, copia quelli del tuo file precedente)

// ---------- FUNZIONI ASTRONOMICHE (invariate) ----------
// ... (getLST, getAltAz, calcPlanetsPrecise, getExactMoonData, getSunTimesPure, getNightWindow, getMoonRiseSet, getMoonPathSVG, estimateSQM, sqmToDesc rimangono identiche)

// ---------- UI ----------
function switchTab(id,btn){
  // ... (invariato)
}
function toggleNightMode(){
  // ... (invariato)
}
function readInputs(){
  // ... (invariato)
}
function updateAll(){
  // ... (invariato)
}
function loadCity(){
  // ... (invariato)
}

// ---------- GPS ----------
function applyCoordinates(lat,lon,city,accuracy){
  // ... (invariato, ma aggiungi la centratura della mappa)
  // Dopo aver impostato state.lat/lon:
  if(state.weatherMap){
    state.weatherMap.setView([state.lat,state.lon],8);
    if(state.radarLayer)addRadarLayer();
  }
}
// ... (getIPLocation, getLocation, toggleGPSLive invariati)

// ---------- RENDER ----------
// ... (renderSkyQuality, renderSunMoon, renderQuality, renderTonight invariati)

// ---------- CATALOGO (invariato) ----------
// ...

// ---------- MAPPA CIELO (invariata) ----------
// ...

// ---------- METEO ----------
function saveOwmKey(){
  // ... (invariato)
}
function initWeatherMap(){
  if(state.weatherMap){state.weatherMap.setView([state.lat,state.lon],8);return;}
  const el=document.getElementById('weather-map');
  if(!el||typeof L==='undefined')return;
  try{
    state.weatherMap=L.map('weather-map',{center:[state.lat,state.lon],zoom:8,zoomControl:true});
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
      attribution:'Tiles &copy; Esri',maxZoom:19
    }).addTo(state.weatherMap);
    L.marker([state.lat,state.lon]).addTo(state.weatherMap).bindPopup(`📍 ${state.lat.toFixed(4)}, ${state.lon.toFixed(4)}`).openPopup();
    if(state.owmApiKey)addRadarLayer();
  }catch(e){console.warn('weatherMap err',e);}
}
function addRadarLayer(){
  if(!state.owmApiKey||!state.weatherMap)return;
  if(state.radarLayer)state.weatherMap.removeLayer(state.radarLayer);
  // Layer nuvole
  state.radarLayer = L.tileLayer(
    `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`,
    {attribution:'&copy; OpenWeatherMap', maxZoom:19, opacity:0.7}
  ).addTo(state.weatherMap);
}
async function fetchWeather(){
  const m=document.getElementById('msg-weather');
  if(!state.owmApiKey){
    m.innerText='⚠️ Inserisci prima la API Key OpenWeatherMap.';
    m.className='msg';m.style.color='var(--warn)';
    // Chiama comunque 7Timer per i dati astronomici
    fetchAstroWeather();
    return;
  }
  m.innerText='Caricamento...';m.className='msg';m.style.color='';
  try{
    const url=`https://api.openweathermap.org/data/2.5/forecast?lat=${state.lat}&lon=${state.lon}&appid=${state.owmApiKey}&units=metric&lang=it`;
    const res=await fetch(url);
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    const list=data.list.slice(0,8);
    const clouds=list.map(i=>i.clouds.all);
    const temps=list.map(i=>i.main.temp);
    const hums=list.map(i=>i.main.humidity);
    const winds=list.map(i=>i.wind.speed*3.6);
    const avg=clouds.reduce((a,b)=>a+b,0)/clouds.length;
    state.clouds=avg;
    document.getElementById('weather-grid').innerHTML=`
      <div class="card"><label>Nuvole (24h)</label><div class="val">${avg.toFixed(0)}%</div></div>
      <div class="card"><label>Temp (min)</label><div class="val">${Math.min(...temps).toFixed(1)}°C</div></div>
      <div class="card"><label>Umidità (max)</label><div class="val">${Math.max(...hums).toFixed(0)}%</div></div>
      <div class="card"><label>Vento (max)</label><div class="val">${Math.max(...winds).toFixed(0)}km/h</div></div>`;
    renderQuality();
    if(state.weatherMap){
      state.weatherMap.setView([state.lat,state.lon],8);
      if(state.radarLayer)addRadarLayer();
    }
    m.innerText='✅ Meteo aggiornato.';m.className='msg success';m.style.color='';
  }catch(e){
    m.innerText='❌ Errore: '+e.message;m.className='msg';m.style.color='var(--bad)';
  }
  // Chiama sempre 7Timer per seeing/trasparenza
  fetchAstroWeather();
}

// ---------- 7TIMER: METEO ASTRONOMICO ----------
async function fetchAstroWeather(){
  const card=document.getElementById('astro-weather-card');
  if(!card) return;
  card.innerHTML = '<div style="color:var(--muted);padding:10px">Caricamento dati astronomici...</div>';
  try{
    const url = `https://www.7timer.info/bin/api.pl?lon=${state.lon}&lat=${state.lat}&product=astro&output=json`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    if(!data.dataseries || data.dataseries.length===0){
      card.innerHTML = '<div style="color:var(--muted);padding:10px">Dati astronomici non disponibili per questa posizione.</div>';
      return;
    }
    // Prendi il primo timepoint (condizioni attuali)
    const now = data.dataseries[0];
    state.astroCloud = now.cloudcover;
    state.seeing = now.seeing;
    state.transparency = now.transparency;
    state.astroInit = data.init;

    const cloudMap = {1:'Sereno (0-6%)',2:'Poco nuvoloso (6-19%)',3:'Parzialmente nuvoloso (19-31%)',4:'Nuvoloso (31-44%)',5:'Molto nuvoloso (44-56%)',6:'Coperto (56-69%)',7:'Coperto (69-81%)',8:'Coperto (81-94%)',9:'Totalmente coperto (94-100%)'};
    const seeingMap = {1:'Eccellente (≤0.5")',2:'Buono (0.5-0.75")',3:'Discreto (0.75-1")',4:'Mediocre (1-1.25")',5:'Scarso (1.25-1.5")',6:'Scarso (1.5-2")',7:'Molto scarso (2-2.5")',8:'Pessimo (>2.5")'};
    const transpMap = {1:'Eccellente (≤0.3 mag)',2:'Buona (0.3-0.6 mag)',3:'Discreta (0.6-1.0 mag)',4:'Mediocre (1.0-1.5 mag)',5:'Scarsa (1.5-2.0 mag)',6:'Scarsa (2.0-3.0 mag)',7:'Molto scarsa (3.0-4.0 mag)',8:'Pessima (>4.0 mag)'};

    const seeingLabel = seeingMap[now.seeing] || 'N/D';
    const transpLabel = transpMap[now.transparency] || 'N/D';
    const cloudLabel = cloudMap[now.cloudcover] || 'N/D';

    // Determina colore per il seeing (1-2 verde, 3-4 giallo, 5-8 rosso)
    const seeingColor = now.seeing <= 2 ? 'var(--ok)' : (now.seeing <= 4 ? 'var(--warn)' : 'var(--bad)');
    const transpColor = now.transparency <= 2 ? 'var(--ok)' : (now.transparency <= 4 ? 'var(--warn)' : 'var(--bad)');

    card.innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
        <div class="card" style="padding:14px;background:var(--bg2);">
          <label>☁️ Nuvolosità</label>
          <div class="val" style="font-size:16px;">${cloudLabel}</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);">
          <label>🌪️ Seeing</label>
          <div class="val" style="font-size:16px;color:${seeingColor};">${seeingLabel}</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);">
          <label>🔭 Trasparenza</label>
          <div class="val" style="font-size:16px;color:${transpColor};">${transpLabel}</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;text-align:right;">
        Dati 7Timer! — Init: ${data.init} UTC
      </div>
    `;
    // Aggiorna anche il punteggio qualità con il seeing
    renderQuality();
  }catch(e){
    console.warn('7Timer err',e);
    card.innerHTML = `<div style="color:var(--bad);padding:10px">❌ Errore dati astronomici: ${e.message}</div>`;
  }
}

function startWeatherAutoUpdate(){
  if(state.weatherTimer)clearInterval(state.weatherTimer);
  state.weatherTimer=setInterval(()=>{
    if(document.getElementById('tab-weather').classList.contains('active'))fetchWeather();
  },10*60*1000);
}

// ---------- INIT ----------
function initApp(){
  try{
    const now=new Date();
    const off=now.getTimezoneOffset()*60000;
    const iso=new Date(now-off).toISOString().slice(0,16);
    document.getElementById('date').value=iso.split('T')[0];
    document.getElementById('time').value=iso.split('T')[1];
    const savedLogo=localStorage.getItem('albertoastro_logo');
    if(savedLogo){
      document.getElementById('logoImg').src=savedLogo;
      document.getElementById('logoImg').style.display='block';
      document.getElementById('logoFallback').style.display='none';
    }
    if(state.owmApiKey)document.getElementById('owm-api-key').value=state.owmApiKey;
    readInputs();
    renderSunMoon();
    renderSkyQuality();
    renderQuality();
    renderCatalog();
    initWeatherMap();
    startWeatherAutoUpdate();
    // Centra la mappa sulla posizione GPS all'avvio
    getLocation();
    console.log('✅ Alberto Astro caricata. Astronomy:', hasAstro(), 'Leaflet:', typeof L);
    window.__appLoaded = true;
  }catch(e){
    console.error('❌ Init error:', e);
    var b = document.getElementById('js-error-banner');
    if(b){b.style.display='block';b.textContent='❌ Errore inizializzazione: '+e.message;}
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', initApp);
}else{
  initApp();
}
