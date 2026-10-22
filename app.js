/* ============================================================
   ALBERTO ASTRO - App astronomica (v9 - Open-Meteo)
   ============================================================ */
'use strict';

window.__appLoaded = false;

const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const norm360 = x => ((x % 360) + 360) % 360;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hasAstro = () => typeof Astronomy !== 'undefined';

const state = {
  lat: parseFloat(localStorage.getItem('albertoastro_lat')) || 41.9028,
  lon: parseFloat(localStorage.getItem('albertoastro_lon')) || 12.4964,
  baseTime: new Date(), currentTime: new Date(),
  camAlt: 45, camAz: 0, fov: 80,
  clouds: 0, target: null, sqm: 21.0,
  gpsLiveWatchId: null, gpsLiveActive: false, gpsAccuracy: null,
  catalogFilter: 'all', catalogDetailObj: null,
  weatherMap: null, weatherMarker: null,
  owmApiKey: localStorage.getItem('albertoastro_owm_key') || '',
  weatherTimer: null, radarLayer: null,
  astroFetched: false,
  activeWeatherLayer: 'clouds'
};
const _planetCache = { key: null, data: null };

// ... (Tutti gli array STARS, MESSIER, NEBULAE_EXTRA, CONSTELLATIONS e le funzioni astronomiche getLST, getAltAz, calcPlanetsPrecise, getExactMoonData, getSunTimesPure, getNightWindow, getMoonRiseSet, getMoonPathSVG, estimateSQM, sqmToDesc rimangono INVARIATI. Copiali dal tuo file precedente.)

// ---------- UI ----------
function switchTab(id,btn){
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(el=>el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(btn)btn.classList.add('active');
  if(id==='tab-sky'){readInputs();state.currentTime=new Date(state.baseTime);_planetCache.key=null;document.getElementById('timeSlider').value=0;onSliderChange();resetView();}
  if(id==='tab-tonight'){readInputs();renderTonight();}
  if(id==='tab-catalog')renderCatalog();
  if(id==='tab-weather'){
    initWeatherMap();
    setTimeout(()=>{
      if(state.weatherMap)state.weatherMap.invalidateSize();
      centerWeatherMap();
    }, 200);
    fetchAstroWeather(); // Questa ora usa Open-Meteo
    if(state.owmApiKey)fetchWeather();
  }
}
// ... (toggleNightMode, readInputs, updateAll, loadCity, applyCoordinates, getIPLocation, getLocation, toggleGPSLive, renderSkyQuality, renderSunMoon, renderQuality, renderTonight, buildCatalog, setCatalogFilter, renderCatalog, openCatDetail, closeCatDetail, catDetailGoto rimangono INVARIATI)

// ---------- MAPPA CIELO (INVARIATA) ----------
// ... (Tutte le funzioni da const canvas fino a setTimeOffset rimangono INVARIATE)

// ---------- MODALE SOLARE (INVARIATA) ----------
// ... (openSolarModal, closeSolarModal rimangono INVARIATE)

// ---------- LOGO (INVARIATO) ----------
// ... (handleLogoUpload rimane INVARIATO)


// ---------- METEO: MAPPA E DATI ----------

function initWeatherMap(){
  const el=document.getElementById('weather-map');
  if(!el || typeof L==='undefined'){console.warn('Leaflet o #weather-map mancanti');return;}
  if(state.weatherMap){
    state.weatherMap.invalidateSize();
    centerWeatherMap();
    return;
  }
  try{
    state.weatherMap=L.map('weather-map',{
      center:[state.lat,state.lon],
      zoom:8,
      minZoom:2,
      maxZoom:10,
      zoomControl:true
    });

    // BASE MAPPA IN BIANCO E NERO (CartoDB Positron) - Risparmia dati e pulito
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
      attribution:'&copy; OpenStreetMap &copy; CartoDB',
      maxZoom:19
    }).addTo(state.weatherMap);

    state.weatherMarker=L.marker([state.lat,state.lon]).addTo(state.weatherMap)
      .bindPopup(`📍 ${state.lat.toFixed(4)}, ${state.lon.toFixed(4)}`).openPopup();
    
    updateWeatherLayer();
    setTimeout(()=>state.weatherMap.invalidateSize(), 100);
  }catch(e){console.error('initWeatherMap err',e);}
}

function updateWeatherLayer(){
  if(!state.weatherMap) return;
  if(state.radarLayer){
    state.weatherMap.removeLayer(state.radarLayer);
    state.radarLayer=null;
  }
  
  const layerType = state.activeWeatherLayer;
  // Se non c'è la chiave OWM, non possiamo mostrare i layer meteo sovrapposti.
  // I dati testuali di Open-Meteo funzionano comunque.
  if(!state.owmApiKey){
    console.warn('OWM key mancante per layer mappa:', layerType);
    return;
  }

  let url='';
  switch(layerType){
    case 'clouds': url=`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`; break;
    case 'wind': url=`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`; break;
    case 'temp': url=`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`; break;
    case 'pressure': url=`https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`; break;
    default: return;
  }

  state.radarLayer=L.tileLayer(url,{
    attribution:'&copy; OpenWeatherMap',
    maxZoom:8, // Limite per evitare errori di zoom
    opacity:0.7
  }).addTo(state.weatherMap);
}

function centerWeatherMap(){
  if(!state.weatherMap) return;
  state.weatherMap.setView([state.lat,state.lon], 8);
  if(state.weatherMarker){
    state.weatherMarker.setLatLng([state.lat,state.lon]);
    state.weatherMarker.setPopupContent(`📍 ${state.lat.toFixed(4)}, ${state.lon.toFixed(4)}`);
  }
  setTimeout(()=>state.weatherMap.invalidateSize(), 100);
}

function setWeatherLayer(layer, btn){
  state.activeWeatherLayer = layer;
  document.querySelectorAll('#weatherLayers .weather-tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  updateWeatherLayer();
}

// ---------- METEO: OPEN-METEO (Sostituisce 7Timer) ----------
async function fetchAstroWeather(){
  const card = document.getElementById('astro-weather-card');
  if(!card) return;
  card.innerHTML = '<div style="color:var(--muted);padding:10px">⏳ Caricamento dati meteo da Open-Meteo...</div>';

  try {
    // Richiediamo i dati orari per le prossime 24 ore per avere una visione completa
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&hourly=temperature_2m,cloud_cover,visibility,wind_speed_10m,wind_gusts_10m&forecast_days=2&timezone=auto`;
    
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (!data.hourly || !data.hourly.time) throw new Error('Dati orari non disponibili');

    // Troviamo l'indice corrispondente all'ora attuale (o la più vicina)
    const now = new Date();
    let bestIndex = 0;
    let minDiff = Infinity;
    data.hourly.time.forEach((t, i) => {
      const diff = Math.abs(new Date(t) - now);
      if (diff < minDiff) { minDiff = diff; bestIndex = i; }
    });

    const current = {
      temp: data.hourly.temperature_2m[bestIndex],
      clouds: data.hourly.cloud_cover[bestIndex],
      visibility: data.hourly.visibility[bestIndex],
      wind: data.hourly.wind_speed_10m[bestIndex],
      gusts: data.hourly.wind_gusts_10m[bestIndex]
    };

    // Determiniamo i colori in base ai valori
    const cloudColor = current.clouds < 30 ? 'var(--ok)' : (current.clouds < 70 ? 'var(--warn)' : 'var(--bad)');
    const visColor = current.visibility > 20000 ? 'var(--ok)' : (current.visibility > 10000 ? 'var(--warn)' : 'var(--bad)');
    const windColor = current.wind < 15 ? 'var(--ok)' : (current.wind < 30 ? 'var(--warn)' : 'var(--bad)');

    // Nota: Open-Meteo non fornisce "Seeing" o "Trasparenza" diretti.
    // Usiamo la visibilità come proxy per la trasparenza e le raffiche per la stabilità.
    card.innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>☁️ Nuvole</label>
          <div class="val" style="font-size:16px;color:${cloudColor};">${current.clouds.toFixed(0)}%</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>👁️ Visibilità</label>
          <div class="val" style="font-size:16px;color:${visColor};">${(current.visibility/1000).toFixed(1)} km</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>💨 Vento (10m)</label>
          <div class="val" style="font-size:16px;color:${windColor};">${current.wind.toFixed(0)} km/h</div>
          <div style="font-size:10px;color:var(--muted);">Raffiche: ${current.gusts.toFixed(0)} km/h</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>🌡️ Temperatura</label>
          <div class="val" style="font-size:16px;">${current.temp.toFixed(1)}°C</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;text-align:right;">
        Dati Open-Meteo (modelli nazionali) · Lat ${state.lat.toFixed(3)}, Lon ${state.lon.toFixed(3)}
      </div>`;
    
    state.astroFetched = true;
  } catch(e) {
    console.warn('Open-Meteo err', e);
    card.innerHTML = `<div style="color:var(--bad);padding:10px">❌ Open-Meteo: ${e.message}.<br>
      <button class="btn btn-ghost" style="margin-top:8px;font-size:12px;padding:6px 12px" onclick="fetchAstroWeather()">Riprova</button></div>`;
  }
}

function startWeatherAutoUpdate(){
  if(state.weatherTimer)clearInterval(state.weatherTimer);
  state.weatherTimer=setInterval(()=>{
    if(document.getElementById('tab-weather').classList.contains('active')){
      fetchAstroWeather();
      if(state.owmApiKey)fetchWeather();
    }
  },10*60*1000);
}

// ... (fetchWeather per OWM rimane INVARIATA)
// ... (initApp e gli event listener finali rimangono INVARIATI)
