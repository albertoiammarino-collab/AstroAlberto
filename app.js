/* ============================================================
   ALBERTO ASTRO - App astronomica (v13)
   SETUP API ASTRONOMIA VISUALE:
   - Meteoblue astro-1h        → seeing, jetstream, badlayer
   - Open-Meteo forecast        → nubi low/mid/high, umidità, vento, temp
   - Open-Meteo air-quality     → dust, pollini
   - SQM + Bortle (statico)     → inquinamento luminoso interpolato
   - Radar RainViewer           → precipitazioni (no key)
   - 7Timer! RIMOSSO
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
  clouds: 0, target: null, sqm: 21.0, bortle: 4,
  gpsLiveWatchId: null, gpsLiveActive: false, gpsAccuracy: null,
  catalogFilter: 'all', catalogDetailObj: null,
  weatherMap: null, weatherMarker: null,
  owmApiKey: localStorage.getItem('albertoastro_owm_key') || '',
  mbApiKey: localStorage.getItem('albertoastro_mb_key') || '',
  weatherTimer: null, radarLayer: null, rainViewerLayer: null,
  astroFetched: false,
  activeWeatherLayer: 'clouds',
  lastWeather: null
};
const _planetCache = { key: null, data: null };

const PLANET_NAMES = ["Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune"];
const PLANET_SYMBOLS = {Mercury:"☿",Venus:"♀",Mars:"♂",Jupiter:"♃",Saturn:"♄",Uranus:"♅",Neptune:"♆"};
const PLANET_COLORS = {Mercury:"#a8a8a8",Venus:"#f0e68c",Mars:"#ff6347",Jupiter:"#ffd700",Saturn:"#f4e4a1",Uranus:"#87ceeb",Neptune:"#4169e1"};
const PLANET_IT = {Mercury:"Mercurio",Venus:"Venere",Mars:"Marte",Jupiter:"Giove",Saturn:"Saturno",Uranus:"Urano",Neptune:"Nettuno"};

const STARS = [
  {n:"Polaris",ra:37.95,dec:89.26,mag:1.98},{n:"Kochab",ra:222.68,dec:74.16,mag:2.08},
  {n:"Dubhe",ra:165.93,dec:61.75,mag:1.79},{n:"Merak",ra:165.46,dec:56.38,mag:2.37},
  {n:"Phecda",ra:178.46,dec:53.69,mag:2.44},{n:"Megrez",ra:183.86,dec:57.03,mag:3.31},
  {n:"Alioth",ra:193.51,dec:55.96,mag:1.77},{n:"Mizar",ra:200.98,dec:54.93,mag:2.23},
  {n:"Alkaid",ra:206.88,dec:49.31,mag:1.86},{n:"Betelgeuse",ra:88.79,dec:7.41,mag:0.42},
  {n:"Rigel",ra:78.63,dec:-8.20,mag:0.13},{n:"Bellatrix",ra:81.28,dec:6.35,mag:1.64},
  {n:"Mintaka",ra:83.00,dec:-0.30,mag:2.23},{n:"Alnilam",ra:84.05,dec:-1.20,mag:1.69},
  {n:"Alnitak",ra:85.19,dec:-1.94,mag:1.77},{n:"Saiph",ra:86.94,dec:-9.67,mag:2.07},
  {n:"Caph",ra:2.29,dec:59.15,mag:2.28},{n:"Schedar",ra:10.13,dec:56.54,mag:2.24},
  {n:"Gamma Cas",ra:14.18,dec:60.72,mag:2.47},{n:"Ruchbah",ra:21.45,dec:60.24,mag:2.68},
  {n:"Deneb",ra:310.36,dec:45.28,mag:1.25},{n:"Sadr",ra:305.56,dec:40.26,mag:2.23},
  {n:"Vega",ra:279.23,dec:38.78,mag:0.03},{n:"Altair",ra:297.70,dec:8.87,mag:0.76},
  {n:"Arturo",ra:213.92,dec:19.18,mag:-0.05},{n:"Capella",ra:79.17,dec:45.99,mag:0.08},
  {n:"Aldebaran",ra:68.98,dec:16.51,mag:0.86},{n:"Castore",ra:113.65,dec:31.89,mag:1.58},
  {n:"Pollux",ra:116.33,dec:28.03,mag:1.14},{n:"Regolo",ra:152.09,dec:11.97,mag:1.35},
  {n:"Spica",ra:201.30,dec:-11.16,mag:0.97},{n:"Antares",ra:247.35,dec:-26.43,mag:0.96},
  {n:"Alpheratz",ra:2.10,dec:29.09,mag:2.06},{n:"Mirach",ra:17.43,dec:35.62,mag:2.07},
  {n:"Almach",ra:30.97,dec:42.33,mag:2.10},{n:"Mirfak",ra:51.08,dec:49.86,mag:1.79},
  {n:"Algol",ra:47.04,dec:40.96,mag:2.09},{n:"Hamal",ra:31.79,dec:23.46,mag:2.00},
  {n:"Sirio",ra:101.29,dec:-16.72,mag:-1.46},{n:"Procyon",ra:114.83,dec:5.22,mag:0.34},
  {n:"Achernar",ra:24.43,dec:-57.24,mag:0.46},{n:"Fomalhaut",ra:344.41,dec:-29.62,mag:1.17},
  {n:"Acrux",ra:186.65,dec:-63.10,mag:0.77},{n:"Mimosa",ra:191.93,dec:-59.69,mag:1.25},
  {n:"Hadar",ra:210.96,dec:-60.37,mag:0.61},{n:"Rigil Kent",ra:219.90,dec:-60.83,mag:-0.27},
  {n:"Canopo",ra:95.99,dec:-52.70,mag:-0.74},{n:"Miaplacidus",ra:138.30,dec:-69.72,mag:1.67},
  {n:"Avior",ra:125.63,dec:-59.51,mag:1.86},{n:"Gacrux",ra:187.79,dec:-57.11,mag:1.59},
  {n:"Shaula",ra:263.40,dec:-37.10,mag:1.62},{n:"Sargas",ra:264.33,dec:-42.99,mag:1.84},
  {n:"Wezen",ra:107.10,dec:-26.39,mag:1.83},{n:"Adhara",ra:104.66,dec:-28.97,mag:1.50},
  {n:"Mirzam",ra:95.67,dec:-17.96,mag:1.98},{n:"Diphda",ra:10.90,dec:-17.99,mag:2.02},
  {n:"Enif",ra:326.05,dec:9.88,mag:2.39},{n:"Markab",ra:346.19,dec:15.21,mag:2.48},
  {n:"Scheat",ra:345.94,dec:28.08,mag:2.42},{n:"Algenib",ra:3.31,dec:15.18,mag:2.83},
  {n:"Menkar",ra:45.57,dec:4.09,mag:2.54},{n:"Unukalhai",ra:236.07,dec:6.43,mag:2.63},
  {n:"Sabik",ra:257.59,dec:-15.72,mag:2.43},{n:"Rasalhague",ra:263.73,dec:12.56,mag:2.08},
  {n:"Kornephoros",ra:247.55,dec:21.49,mag:2.78},{n:"Alphard",ra:141.90,dec:-8.66,mag:2.00},
  {n:"Zubenelgenubi",ra:222.72,dec:-16.04,mag:2.75},{n:"Zubeneschamali",ra:229.25,dec:-9.38,mag:2.61},
  {n:"Nunki",ra:283.82,dec:-26.30,mag:2.05},{n:"Kaus Australis",ra:276.04,dec:-34.38,mag:1.85},
  {n:"Sadalsuud",ra:322.89,dec:-5.57,mag:2.87},{n:"Sadalmelik",ra:331.45,dec:-0.32,mag:2.95},
  {n:"Menkalinan",ra:89.88,dec:44.95,mag:1.90},{n:"Alhena",ra:99.43,dec:16.40,mag:1.93},
  {n:"Wasat",ra:110.03,dec:21.98,mag:3.53},{n:"Mebsuta",ra:101.00,dec:25.13,mag:3.06},
  {n:"Tejat",ra:97.20,dec:22.51,mag:2.87}
];

const MESSIER = {
  "M1":{n:"M1 Granchio",ra:83.63,dec:22.01,type:"Nebulosa",mag:8.4,dist:"6.500 a.l.",desc:"Resto di supernova del 1054."},
  "M2":{n:"M2 Acquario",ra:323.36,dec:-0.82,type:"Ammasso",mag:6.5,dist:"55.000 a.l.",desc:"Ammasso globulare."},
  "M3":{n:"M3 Cani da Caccia",ra:205.55,dec:28.38,type:"Ammasso",mag:6.2,dist:"34.000 a.l.",desc:"Ammasso globulare con 500.000 stelle."},
  "M4":{n:"M4 Scorpione",ra:245.90,dec:-26.53,type:"Ammasso",mag:5.6,dist:"7.200 a.l.",desc:"Uno dei globulari più vicini."},
  "M5":{n:"M5 Serpente",ra:229.64,dec:2.08,type:"Ammasso",mag:5.6,dist:"24.500 a.l.",desc:"Ammasso globulare antico."},
  "M6":{n:"M6 Farfalla",ra:265.08,dec:-32.22,type:"Ammasso",mag:4.2,dist:"1.600 a.l.",desc:"Ammasso aperto a farfalla."},
  "M7":{n:"M7 Tolemaide",ra:268.45,dec:-34.79,type:"Ammasso",mag:3.3,dist:"980 a.l.",desc:"Ammasso noto dall'antichità."},
  "M8":{n:"M8 Laguna",ra:270.90,dec:-24.38,type:"Nebulosa",mag:6.0,dist:"4.100 a.l.",desc:"Nebulosa diffusa con ammasso."},
  "M9":{n:"M9 Ofiuco",ra:259.80,dec:-18.52,type:"Ammasso",mag:7.7,dist:"25.800 a.l.",desc:"Ammasso globulare."},
  "M10":{n:"M10 Ofiuco",ra:254.29,dec:-4.10,type:"Ammasso",mag:6.6,dist:"14.300 a.l.",desc:"Ammasso globulare."},
  "M11":{n:"M11 Anatre",ra:282.77,dec:-6.27,type:"Ammasso",mag:5.8,dist:"6.200 a.l.",desc:"Ammasso aperto ricco."},
  "M12":{n:"M12 Ofiuco",ra:251.81,dec:-1.95,type:"Ammasso",mag:6.7,dist:"16.000 a.l.",desc:"Ammasso globulare."},
  "M13":{n:"M13 Ercole",ra:250.42,dec:36.46,type:"Ammasso",mag:5.8,dist:"25.100 a.l.",desc:"Il più famoso dell'emisfero nord."},
  "M14":{n:"M14 Ofiuco",ra:264.40,dec:-3.25,type:"Ammasso",mag:7.6,dist:"30.300 a.l.",desc:"Ammasso globulare."},
  "M15":{n:"M15 Pegaso",ra:322.49,dec:12.17,type:"Ammasso",mag:6.2,dist:"33.600 a.l.",desc:"Nucleo molto denso."},
  "M16":{n:"M16 Aquila",ra:274.70,dec:-13.80,type:"Nebulosa",mag:6.4,dist:"5.700 a.l.",desc:"Pilastri della Creazione."},
  "M17":{n:"M17 Omega",ra:275.20,dec:-16.18,type:"Nebulosa",mag:6.0,dist:"5.500 a.l.",desc:"Nebulosa a emissione a cigno."},
  "M18":{n:"M18 Sagittario",ra:274.00,dec:-17.10,type:"Ammasso",mag:7.5,dist:"4.900 a.l.",desc:"Ammasso aperto."},
  "M19":{n:"M19 Ofiuco",ra:255.66,dec:-26.27,type:"Ammasso",mag:7.2,dist:"28.700 a.l.",desc:"Ammasso globulare."},
  "M20":{n:"M20 Trifida",ra:270.68,dec:-22.97,type:"Nebulosa",mag:6.3,dist:"5.200 a.l.",desc:"Tre lobi separati."},
  "M21":{n:"M21 Sagittario",ra:271.05,dec:-22.50,type:"Ammasso",mag:6.5,dist:"4.250 a.l.",desc:"Ammasso aperto."},
  "M22":{n:"M22 Sagittario",ra:279.10,dec:-23.90,type:"Ammasso",mag:5.1,dist:"10.400 a.l.",desc:"Uno dei più luminosi."},
  "M23":{n:"M23 Sagittario",ra:269.20,dec:-19.02,type:"Ammasso",mag:6.9,dist:"2.150 a.l.",desc:"Ammasso aperto."},
  "M24":{n:"M24 Sagittario",ra:274.20,dec:-18.55,type:"Ammasso",mag:4.6,dist:"10.000 a.l.",desc:"Nube stellare."},
  "M25":{n:"M25 Sagittario",ra:277.90,dec:-19.25,type:"Ammasso",mag:6.5,dist:"2.000 a.l.",desc:"Ammasso aperto."},
  "M26":{n:"M26 Scudo",ra:281.30,dec:-9.40,type:"Ammasso",mag:8.0,dist:"5.000 a.l.",desc:"Ammasso aperto."},
  "M27":{n:"M27 Manubrio",ra:299.90,dec:22.72,type:"Nebulosa",mag:7.5,dist:"1.360 a.l.",desc:"Prima planetaria scoperta."},
  "M28":{n:"M28 Sagittario",ra:276.10,dec:-24.87,type:"Ammasso",mag:7.7,dist:"18.300 a.l.",desc:"Ammasso globulare."},
  "M29":{n:"M29 Cigno",ra:305.98,dec:38.52,type:"Ammasso",mag:7.1,dist:"4.000 a.l.",desc:"Ammasso aperto."},
  "M30":{n:"M30 Capricorno",ra:325.09,dec:-23.18,type:"Ammasso",mag:7.5,dist:"26.100 a.l.",desc:"Ammasso globulare."},
  "M31":{n:"M31 Andromeda",ra:10.68,dec:41.26,type:"Galassia",mag:3.4,dist:"2,5 M a.l.",desc:"La spirale più vicina."},
  "M32":{n:"M32 Satellite",ra:10.67,dec:40.87,type:"Galassia",mag:8.1,dist:"2,5 M a.l.",desc:"Nana ellittica di M31."},
  "M33":{n:"M33 Triangolo",ra:23.46,dec:30.66,type:"Galassia",mag:5.7,dist:"2,7 M a.l.",desc:"Terza galassia del Gruppo Locale."},
  "M34":{n:"M34 Perseo",ra:40.50,dec:42.72,type:"Ammasso",mag:5.2,dist:"1.400 a.l.",desc:"Ammasso aperto."},
  "M35":{n:"M35 Gemelli",ra:92.27,dec:24.33,type:"Ammasso",mag:5.3,dist:"2.800 a.l.",desc:"200 stelle circa."},
  "M36":{n:"M36 Auriga",ra:84.10,dec:34.13,type:"Ammasso",mag:6.0,dist:"4.100 a.l.",desc:"Ammasso aperto."},
  "M37":{n:"M37 Auriga",ra:88.07,dec:32.55,type:"Ammasso",mag:5.6,dist:"4.500 a.l.",desc:"Ammasso ricco."},
  "M38":{n:"M38 Auriga",ra:82.17,dec:35.85,type:"Ammasso",mag:6.4,dist:"4.200 a.l.",desc:"Ammasso aperto."},
  "M39":{n:"M39 Cigno",ra:322.94,dec:48.43,type:"Ammasso",mag:4.6,dist:"800 a.l.",desc:"Ammasso aperto."},
  "M40":{n:"M40 Gemelli",ra:185.53,dec:58.08,type:"Stella",mag:8.4,dist:"—",desc:"Stella doppia."},
  "M41":{n:"M41 Cane Maggiore",ra:101.90,dec:-20.72,type:"Ammasso",mag:4.5,dist:"2.300 a.l.",desc:"Ammasso aperto."},
  "M42":{n:"M42 Orione",ra:83.82,dec:-5.39,type:"Nebulosa",mag:4.0,dist:"1.344 a.l.",desc:"La nebulosa più famosa."},
  "M43":{n:"M43 De Mairan",ra:83.88,dec:-5.27,type:"Nebulosa",mag:9.0,dist:"1.300 a.l.",desc:"Piccola nebulosa."},
  "M44":{n:"M44 Presepe",ra:130.10,dec:19.67,type:"Ammasso",mag:3.7,dist:"577 a.l.",desc:"Ammasso noto dall'antichità."},
  "M45":{n:"M45 Pleiadi",ra:56.75,dec:24.11,type:"Ammasso",mag:1.6,dist:"444 a.l.",desc:"L'ammasso più famoso."},
  "M46":{n:"M46 Poppa",ra:116.10,dec:-14.82,type:"Ammasso",mag:6.0,dist:"5.400 a.l.",desc:"Ammasso con planetaria."},
  "M47":{n:"M47 Poppa",ra:114.15,dec:-14.30,type:"Ammasso",mag:4.4,dist:"1.600 a.l.",desc:"Ammasso aperto."},
  "M48":{n:"M48 Idra",ra:123.42,dec:-5.75,type:"Ammasso",mag:5.5,dist:"1.500 a.l.",desc:"Ammasso aperto."},
  "M49":{n:"M49 Vergine",ra:187.44,dec:8.00,type:"Galassia",mag:8.4,dist:"55 M a.l.",desc:"Ellittica gigante."},
  "M50":{n:"M50 Monoceros",ra:105.65,dec:-8.35,type:"Ammasso",mag:5.9,dist:"3.200 a.l.",desc:"Ammasso aperto."},
  "M51":{n:"M51 Vortice",ra:202.47,dec:47.19,type:"Galassia",mag:8.4,dist:"23 M a.l.",desc:"Prima spirale riconosciuta."},
  "M52":{n:"M52 Cassiopea",ra:351.20,dec:61.60,type:"Ammasso",mag:7.3,dist:"5.000 a.l.",desc:"Ammasso aperto."},
  "M53":{n:"M53 Chioma",ra:188.40,dec:18.17,type:"Ammasso",mag:7.6,dist:"58.000 a.l.",desc:"Ammasso globulare."},
  "M54":{n:"M54 Sagittario",ra:283.76,dec:-30.48,type:"Ammasso",mag:7.6,dist:"87.400 a.l.",desc:"Ammasso globulare."},
  "M55":{n:"M55 Sagittario",ra:294.99,dec:-30.96,type:"Ammasso",mag:6.3,dist:"17.300 a.l.",desc:"Ammasso globulare sparso."},
  "M56":{n:"M56 Lira",ra:289.15,dec:30.18,type:"Ammasso",mag:8.3,dist:"32.900 a.l.",desc:"Ammasso globulare."},
  "M57":{n:"M57 Anello",ra:283.39,dec:33.02,type:"Nebulosa",mag:8.8,dist:"2.300 a.l.",desc:"La planetaria più famosa."},
  "M58":{n:"M58 Vergine",ra:189.43,dec:11.82,type:"Galassia",mag:9.7,dist:"62 M a.l.",desc:"Spirale barrata."},
  "M59":{n:"M59 Vergine",ra:190.51,dec:11.65,type:"Galassia",mag:9.6,dist:"60 M a.l.",desc:"Ellittica."},
  "M60":{n:"M60 Vergine",ra:190.92,dec:11.55,type:"Galassia",mag:8.8,dist:"60 M a.l.",desc:"Ellittica gigante."},
  "M61":{n:"M61 Vergine",ra:185.48,dec:4.47,type:"Galassia",mag:9.7,dist:"52 M a.l.",desc:"Spirale barrata."},
  "M62":{n:"M62 Ofiuco",ra:255.30,dec:-30.11,type:"Ammasso",mag:6.5,dist:"22.500 a.l.",desc:"Ammasso globulare."},
  "M63":{n:"M63 Girasole",ra:198.85,dec:42.03,type:"Galassia",mag:8.6,dist:"27 M a.l.",desc:"Bracci estesi."},
  "M64":{n:"M64 Occhio Nero",ra:194.18,dec:21.68,type:"Galassia",mag:8.5,dist:"24 M a.l.",desc:"Banda oscura."},
  "M65":{n:"M65 Leone",ra:169.73,dec:13.09,type:"Galassia",mag:9.3,dist:"35 M a.l.",desc:"Tripletto del Leone."},
  "M66":{n:"M66 Leone",ra:170.06,dec:12.99,type:"Galassia",mag:8.9,dist:"36 M a.l.",desc:"Tripletto del Leone."},
  "M67":{n:"M67 Cancro",ra:132.85,dec:11.80,type:"Ammasso",mag:6.1,dist:"2.700 a.l.",desc:"Ammasso aperto antico."},
  "M68":{n:"M68 Idra",ra:189.87,dec:-26.74,type:"Ammasso",mag:8.2,dist:"33.300 a.l.",desc:"Ammasso globulare."},
  "M69":{n:"M69 Sagittario",ra:277.85,dec:-32.35,type:"Ammasso",mag:7.7,dist:"29.700 a.l.",desc:"Ammasso globulare."},
  "M70":{n:"M70 Sagittario",ra:280.18,dec:-32.29,type:"Ammasso",mag:9.0,dist:"29.300 a.l.",desc:"Ammasso globulare."},
  "M71":{n:"M71 Freccia",ra:298.44,dec:18.78,type:"Ammasso",mag:8.2,dist:"13.000 a.l.",desc:"Ammasso globulare sparso."},
  "M72":{n:"M72 Aquario",ra:313.36,dec:-12.53,type:"Ammasso",mag:9.4,dist:"55.400 a.l.",desc:"Ammasso globulare."},
  "M73":{n:"M73 Aquario",ra:314.75,dec:-12.63,type:"Ammasso",mag:9.0,dist:"2.500 a.l.",desc:"Piccolo asterismo."},
  "M74":{n:"M74 Pesci",ra:24.17,dec:15.78,type:"Galassia",mag:9.4,dist:"32 M a.l.",desc:"Spirale debole."},
  "M75":{n:"M75 Sagittario",ra:301.52,dec:-21.92,type:"Ammasso",mag:8.6,dist:"67.500 a.l.",desc:"Ammasso globulare."},
  "M76":{n:"M76 Piccola Manubrio",ra:25.58,dec:51.57,type:"Nebulosa",mag:10.1,dist:"2.500 a.l.",desc:"Planetaria."},
  "M77":{n:"M77 Balena",ra:40.67,dec:-0.01,type:"Galassia",mag:8.9,dist:"47 M a.l.",desc:"Nucleo attivo."},
  "M78":{n:"M78 Riflessione",ra:86.69,dec:0.08,type:"Nebulosa",mag:8.3,dist:"1.600 a.l.",desc:"Riflessione luminosa."},
  "M79":{n:"M79 Lepre",ra:81.04,dec:-24.52,type:"Ammasso",mag:8.2,dist:"42.100 a.l.",desc:"Ammasso globulare."},
  "M80":{n:"M80 Scorpione",ra:244.26,dec:-22.89,type:"Ammasso",mag:7.3,dist:"32.600 a.l.",desc:"Globulare denso."},
  "M81":{n:"M81 Bode",ra:148.80,dec:69.06,type:"Galassia",mag:6.9,dist:"12 M a.l.",desc:"Spirale luminosa."},
  "M82":{n:"M82 Sigaro",ra:148.97,dec:69.68,type:"Galassia",mag:8.4,dist:"12 M a.l.",desc:"Irregolare con starburst."},
  "M83":{n:"M83 Girandola Sud",ra:204.25,dec:-29.87,type:"Galassia",mag:7.5,dist:"15 M a.l.",desc:"Spirale barrata."},
  "M84":{n:"M84 Vergine",ra:186.27,dec:12.89,type:"Galassia",mag:9.1,dist:"60 M a.l.",desc:"Ellittica."},
  "M85":{n:"M85 Vergine",ra:186.35,dec:18.19,type:"Galassia",mag:9.1,dist:"60 M a.l.",desc:"Lenticolare."},
  "M86":{n:"M86 Vergine",ra:186.55,dec:12.95,type:"Galassia",mag:8.9,dist:"52 M a.l.",desc:"Ellittica."},
  "M87":{n:"M87 Vergine A",ra:187.71,dec:12.39,type:"Galassia",mag:8.6,dist:"53 M a.l.",desc:"Buco nero supermassiccio."},
  "M88":{n:"M88 Vergine",ra:187.99,dec:14.42,type:"Galassia",mag:9.6,dist:"47 M a.l.",desc:"Spirale."},
  "M89":{n:"M89 Vergine",ra:188.92,dec:12.56,type:"Galassia",mag:9.8,dist:"50 M a.l.",desc:"Ellittica quasi sferica."},
  "M90":{n:"M90 Vergine",ra:189.20,dec:13.16,type:"Galassia",mag:9.5,dist:"59 M a.l.",desc:"Spirale con bracci deboli."},
  "M91":{n:"M91 Chioma",ra:188.85,dec:14.50,type:"Galassia",mag:10.2,dist:"63 M a.l.",desc:"Spirale barrata."},
  "M92":{n:"M92 Ercole",ra:259.28,dec:43.14,type:"Ammasso",mag:6.4,dist:"26.700 a.l.",desc:"Globulare antico."},
  "M93":{n:"M93 Poppa",ra:116.05,dec:-23.87,type:"Ammasso",mag:6.2,dist:"3.600 a.l.",desc:"Ammasso aperto."},
  "M94":{n:"M94 Cani da Caccia",ra:192.72,dec:41.12,type:"Galassia",mag:8.2,dist:"16 M a.l.",desc:"Spirale con anello."},
  "M95":{n:"M95 Leone",ra:160.99,dec:11.70,type:"Galassia",mag:9.8,dist:"33 M a.l.",desc:"Spirale barrata."},
  "M96":{n:"M96 Leone",ra:161.69,dec:11.82,type:"Galassia",mag:9.2,dist:"35 M a.l.",desc:"Spirale."},
  "M97":{n:"M97 Gufo",ra:168.70,dec:55.02,type:"Nebulosa",mag:9.9,dist:"2.600 a.l.",desc:"Planetaria con due occhi."},
  "M98":{n:"M98 Chioma",ra:183.45,dec:14.90,type:"Galassia",mag:10.1,dist:"44 M a.l.",desc:"Spirale."},
  "M99":{n:"M99 Chioma",ra:184.71,dec:14.42,type:"Galassia",mag:9.9,dist:"50 M a.l.",desc:"Grande disegno."},
  "M100":{n:"M100 Chioma",ra:185.73,dec:15.82,type:"Galassia",mag:9.3,dist:"55 M a.l.",desc:"Simile alla Via Lattea."},
  "M101":{n:"M101 Girandola",ra:210.80,dec:54.35,type:"Galassia",mag:7.9,dist:"21 M a.l.",desc:"Grande spirale."},
  "M102":{n:"M102 Filatrice",ra:226.00,dec:55.76,type:"Galassia",mag:9.9,dist:"44 M a.l.",desc:"Spirale vista di taglio."},
  "M103":{n:"M103 Cassiopea",ra:23.34,dec:60.66,type:"Ammasso",mag:7.4,dist:"10.000 a.l.",desc:"Ammasso aperto."},
  "M104":{n:"M104 Sombrero",ra:189.99,dec:-11.62,type:"Galassia",mag:8.0,dist:"29 M a.l.",desc:"Vista di taglio con banda."},
  "M105":{n:"M105 Leone",ra:161.96,dec:12.58,type:"Galassia",mag:9.3,dist:"32 M a.l.",desc:"Ellittica."},
  "M106":{n:"M106 Cani",ra:184.74,dec:47.30,type:"Galassia",mag:8.4,dist:"24 M a.l.",desc:"Nucleo attivo."},
  "M107":{n:"M107 Ofiuco",ra:248.13,dec:-13.05,type:"Ammasso",mag:7.9,dist:"20.900 a.l.",desc:"Globulare."},
  "M108":{n:"M108 Surfboard",ra:167.88,dec:55.67,type:"Galassia",mag:10.0,dist:"45 M a.l.",desc:"Spirale di taglio."},
  "M109":{n:"M109 Orsa Maggiore",ra:184.06,dec:53.37,type:"Galassia",mag:9.8,dist:"83 M a.l.",desc:"Barrata."},
  "M110":{n:"M110 Satellite",ra:10.09,dec:41.69,type:"Galassia",mag:8.9,dist:"2,7 M a.l.",desc:"Nana di M31."}
};

const NEBULAE_EXTRA = [
  {n:"Velo (NGC6960)",ra:311.5,dec:30.7,type:"Nebulosa",mag:7.0,dist:"2.400 a.l.",desc:"Resto di supernova."},
  {n:"Nord America (NGC7000)",ra:314.7,dec:44.3,type:"Nebulosa",mag:4.0,dist:"2.600 a.l.",desc:"Nebulosa a emissione."},
  {n:"Pellicano (IC5070)",ra:311.0,dec:44.3,type:"Nebulosa",mag:8.0,dist:"1.800 a.l.",desc:"Emissione."},
  {n:"California (NGC1499)",ra:60.8,dec:36.4,type:"Nebulosa",mag:6.0,dist:"1.000 a.l.",desc:"Grande emissione."},
  {n:"Rosetta (NGC2237)",ra:97.9,dec:5.0,type:"Nebulosa",mag:6.0,dist:"5.200 a.l.",desc:"Emissione."},
  {n:"Cono (NGC2264)",ra:100.2,dec:9.9,type:"Nebulosa",mag:3.9,dist:"2.700 a.l.",desc:"Struttura conica."},
  {n:"Cuore (IC1805)",ra:38.3,dec:61.3,type:"Nebulosa",mag:6.5,dist:"7.500 a.l.",desc:"Grande emissione."},
  {n:"Anima (IC1848)",ra:40.8,dec:60.6,type:"Nebulosa",mag:6.5,dist:"7.500 a.l.",desc:"Emissione."},
  {n:"Cocoon (IC5146)",ra:328.3,dec:47.3,type:"Nebulosa",mag:7.2,dist:"4.000 a.l.",desc:"Emissione + riflessione."},
  {n:"Helix (NGC7293)",ra:337.4,dec:-20.8,type:"Nebulosa",mag:7.3,dist:"700 a.l.",desc:"Planetaria vicina."},
  {n:"Dumbbell (NGC6853)",ra:299.9,dec:22.7,type:"Nebulosa",mag:7.5,dist:"1.360 a.l.",desc:"Planetaria."},
  {n:"Pacman (NGC281)",ra:13.0,dec:56.6,type:"Nebulosa",mag:7.4,dist:"9.500 a.l.",desc:"Emissione."},
  {n:"Bolla (NGC7635)",ra:350.2,dec:61.2,type:"Nebulosa",mag:10.0,dist:"11.000 a.l.",desc:"Emissione con bolla."},
  {n:"Fiamma (NGC2024)",ra:85.4,dec:-1.8,type:"Nebulosa",mag:8.0,dist:"1.400 a.l.",desc:"Emissione."}
];

const CONSTELLATIONS = [
  {name:"Orsa Maggiore",stars:[{ra:165.93,dec:61.75},{ra:165.46,dec:56.38},{ra:178.46,dec:53.69},{ra:183.86,dec:57.03},{ra:193.51,dec:55.96},{ra:200.98,dec:54.93},{ra:206.88,dec:49.31}],area:"1.280°q",season:"Primavera",desc:"La più famosa dell'emisfero nord."},
  {name:"Orione",stars:[{ra:88.79,dec:7.41},{ra:81.28,dec:6.35},{ra:78.63,dec:-8.20},{ra:86.94,dec:-9.67},{ra:83.00,dec:-0.30},{ra:85.19,dec:-1.94},{ra:88.79,dec:7.41}],area:"594°q",season:"Inverno",desc:"La più riconoscibile."},
  {name:"Cassiopea",stars:[{ra:2.29,dec:59.15},{ra:10.13,dec:56.54},{ra:14.18,dec:60.72},{ra:21.45,dec:60.24}],area:"598°q",season:"Autunno",desc:"Forma a W."},
  {name:"Cigno",stars:[{ra:310.36,dec:45.28},{ra:305.56,dec:40.26},{ra:311.55,dec:33.97},{ra:296.24,dec:45.13}],area:"804°q",season:"Estate",desc:"Croce del Nord."},
  {name:"Lira",stars:[{ra:279.23,dec:38.78},{ra:282.52,dec:33.36},{ra:284.74,dec:32.69}],area:"286°q",season:"Estate",desc:"Piccola ma importante."},
  {name:"Scorpione",stars:[{ra:247.35,dec:-26.43},{ra:241.36,dec:-29.62},{ra:252.54,dec:-34.29},{ra:263.40,dec:-37.10}],area:"497°q",season:"Estate",desc:"Zodiacale."},
  {name:"Leone",stars:[{ra:152.09,dec:11.97},{ra:154.17,dec:23.42},{ra:168.53,dec:20.52},{ra:177.26,dec:14.57}],area:"947°q",season:"Primavera",desc:"Zodiacale."},
  {name:"Croce del Sud",stars:[{ra:186.65,dec:-63.10},{ra:187.79,dec:-57.11},{ra:191.93,dec:-59.69},{ra:183.79,dec:-58.75}],area:"68°q",season:"Autunno",desc:"Emisfero sud."}
];

/* ============================================================
   DATABASE INQUINAMENTO LUMINOSO (30 città italiane + interpolazione)
   ============================================================ */
const LIGHT_POLLUTION_CITIES = [
  {name:"Milano", lat:45.4642, lon:9.1900, sqm:18.1, w:1.0},
  {name:"Roma", lat:41.9028, lon:12.4964, sqm:18.3, w:1.0},
  {name:"Napoli", lat:40.8518, lon:14.2681, sqm:18.2, w:0.95},
  {name:"Torino", lat:45.0703, lon:7.6869, sqm:18.4, w:0.9},
  {name:"Palermo", lat:38.1157, lon:13.3615, sqm:18.6, w:0.85},
  {name:"Genova", lat:44.4056, lon:8.9463, sqm:18.5, w:0.85},
  {name:"Bologna", lat:44.4949, lon:11.3426, sqm:18.4, w:0.85},
  {name:"Firenze", lat:43.7696, lon:11.2558, sqm:18.5, w:0.8},
  {name:"Bari", lat:41.1171, lon:16.8719, sqm:18.6, w:0.8},
  {name:"Catania", lat:37.5079, lon:15.0830, sqm:18.7, w:0.8},
  {name:"Venezia", lat:45.4408, lon:12.3155, sqm:18.4, w:0.8},
  {name:"Verona", lat:45.4384, lon:10.9916, sqm:18.5, w:0.75},
  {name:"Messina", lat:38.1938, lon:15.5540, sqm:18.7, w:0.75},
  {name:"Padova", lat:45.4064, lon:11.8768, sqm:18.5, w:0.7},
  {name:"Trieste", lat:45.6495, lon:13.7768, sqm:18.6, w:0.7},
  {name:"Brescia", lat:45.5416, lon:10.2118, sqm:18.5, w:0.7},
  {name:"Parma", lat:44.8015, lon:10.3279, sqm:18.6, w:0.7},
  {name:"Taranto", lat:40.4644, lon:17.2470, sqm:18.7, w:0.7},
  {name:"Prato", lat:43.8777, lon:11.1023, sqm:18.5, w:0.65},
  {name:"Modena", lat:44.6471, lon:10.9252, sqm:18.6, w:0.65},
  {name:"Reggio Calabria", lat:38.1113, lon:15.6473, sqm:18.8, w:0.65},
  {name:"Reggio Emilia", lat:44.6989, lon:10.6297, sqm:18.7, w:0.6},
  {name:"Perugia", lat:43.1107, lon:12.3908, sqm:18.9, w:0.6},
  {name:"Ravenna", lat:44.4184, lon:12.2035, sqm:18.8, w:0.6},
  {name:"Livorno", lat:43.5485, lon:10.3106, sqm:18.7, w:0.6},
  {name:"Cagliari", lat:39.2238, lon:9.1217, sqm:18.7, w:0.6},
  {name:"Foggia", lat:41.4622, lon:15.5446, sqm:19.0, w:0.55},
  {name:"Salerno", lat:40.6824, lon:14.7681, sqm:18.9, w:0.55},
  {name:"Ancona", lat:43.6158, lon:13.5189, sqm:19.0, w:0.55},
  {name:"L'Aquila", lat:42.3505, lon:13.3995, sqm:19.8, w:0.5}
];

const BORTLE_TABLE = [
  {min:21.99, max:22.01, class:1, desc:"Cielo nero, Via Lattea strutturata"},
  {min:21.89, max:21.99, class:2, desc:"Cielo veramente buio"},
  {min:21.69, max:21.89, class:3, desc:"Cielo rurale"},
  {min:20.49, max:21.69, class:4, desc:"Rurale/suburbano"},
  {min:19.50, max:20.49, class:5, desc:"Suburbano"},
  {min:18.94, max:19.50, class:6, desc:"Suburbano luminoso"},
  {min:18.38, max:18.94, class:7, desc:"Periferia urbana"},
  {min:17.50, max:18.38, class:8, desc:"Città"},
  {min:0,     max:17.50, class:9, desc:"Centro urbano"}
];

function sqmToBortle(sqm) {
  for (const t of BORTLE_TABLE) {
    if (sqm >= t.min && sqm <= t.max) return { class: t.class, desc: t.desc };
  }
  return { class: 9, desc: "Centro urbano" };
}

function estimateSQM(lat, lon) {
  // Interpolazione esponenziale pesata: ogni città contribuisce con il suo SQM
  // in base alla distanza (decadimento ~80 km) e al suo peso (dimensione città)
  let weightedSum = 0;
  let weightSum = 0;
  LIGHT_POLLUTION_CITIES.forEach(c => {
    const dLat = (lat - c.lat) * 111;
    const dLon = (lon - c.lon) * 111 * Math.cos(rad(lat));
    const d = Math.hypot(dLat, dLon);
    // Peso esponenziale: a 0 km peso = w, a 80 km peso ≈ w/3
    const weight = c.w * Math.exp(-d / 80);
    weightedSum += weight * c.sqm;
    weightSum += weight;
  });
  let sqm;
  if (weightSum > 0.01) {
    sqm = weightedSum / weightSum;
  } else {
    // Lontano da qualsiasi città del DB: assumiamo un fondo rurale
    sqm = 21.5;
  }
  // Clamp realistico [17.5, 22.0]
  return Math.round(clamp(sqm, 17.5, 22.0) * 100) / 100;
}

function sqmToDesc(sqm) {
  if (sqm >= 21.8) return { label: "Eccellente", badge: "ok" };
  if (sqm >= 21.0) return { label: "Buona", badge: "ok" };
  if (sqm >= 20.0) return { label: "Discreta", badge: "warn" };
  if (sqm >= 19.0) return { label: "Mediocre", badge: "warn" };
  return { label: "Scarsa", badge: "bad" };
}

/* ============================================================
   ASTRONOMIA (come prima)
   ============================================================ */
function getLST(date){
  const jd=date.getTime()/86400000+2440587.5;
  const T=(jd-2451545.0)/36525.0;
  const gmst=280.46061837+360.98564736629*(jd-2451545.0)+0.000387933*T*T-T*T*T/38710000;
  return norm360(gmst+state.lon);
}
function getAltAz(ra,dec,date){
  const lst=rad(getLST(date));const ha=lst-rad(ra);
  const lat=rad(state.lat);const decR=rad(dec);
  const alt=Math.asin(Math.sin(decR)*Math.sin(lat)+Math.cos(decR)*Math.cos(lat)*Math.cos(ha));
  const az=Math.atan2(-Math.cos(decR)*Math.sin(ha),Math.sin(decR)*Math.cos(lat)-Math.cos(decR)*Math.sin(lat)*Math.cos(ha));
  return {alt:deg(alt),az:norm360(deg(az))};
}
function calcPlanetsPrecise(date){
  const key=date.getTime()+'|'+state.lat.toFixed(3)+'|'+state.lon.toFixed(3);
  if(_planetCache.key===key)return _planetCache.data;
  const result=[];
  if(!hasAstro()){_planetCache.key=key;_planetCache.data=result;return result;}
  try{
    const obs=new Astronomy.Observer(state.lat,state.lon,0);
    const time=new Astronomy.AstroTime(date);
    try{
      const e=Astronomy.Equator(Astronomy.Body.Sun,time,obs,true,true);
      const h=Astronomy.Horizon(time,obs,e.ra,e.dec,'normal');
      result.push({n:"Sole",s:"☀️",color:"#ffcc00",ra:e.ra*15,dec:e.dec,alt:h.altitude,az:h.azimuth,isSun:true});
    }catch(e){}
    try{
      const e=Astronomy.Equator(Astronomy.Body.Moon,time,obs,true,true);
      const h=Astronomy.Horizon(time,obs,e.ra,e.dec,'normal');
      result.push({n:"Luna",s:"🌙",color:"#f3e5ab",ra:e.ra*15,dec:e.dec,alt:h.altitude,az:h.azimuth,isMoon:true});
    }catch(e){}
    PLANET_NAMES.forEach(name=>{
      try{
        const body=Astronomy.Body[name];if(!body)return;
        const e=Astronomy.Equator(body,time,obs,true,true);
        const h=Astronomy.Horizon(time,obs,e.ra,e.dec,'normal');
        result.push({n:PLANET_IT[name],s:PLANET_SYMBOLS[name],color:PLANET_COLORS[name],ra:e.ra*15,dec:e.dec,alt:h.altitude,az:h.azimuth});
      }catch(e){}
    });
  }catch(e){console.warn('planets error',e);}
  _planetCache.key=key;_planetCache.data=result;return result;
}
function getExactMoonData(date){
  if(hasAstro()){
    try{
      const time=new Astronomy.AstroTime(date);
      const illum=Astronomy.Illumination(Astronomy.Body.Moon,time);
      const pct=illum.phase_fraction*100;
      const vS=Astronomy.GeoVector(Astronomy.Body.Sun,time,false);
      const vM=Astronomy.GeoVector(Astronomy.Body.Moon,time,false);
      const ecS=Astronomy.Ecliptic(vS);const ecM=Astronomy.Ecliptic(vM);
      let el=ecM.elon-ecS.elon;while(el<0)el+=360;while(el>=360)el-=360;
      const wax=el<180;
      let name="";
      if(pct<1)name="Luna Nuova";
      else if(pct<45)name=wax?"Luna Crescente":"Luna Calante";
      else if(pct<55)name=wax?"Primo Quarto":"Ultimo Quarto";
      else if(pct<99)name=wax?"Gibbosa Crescente":"Gibbosa Calante";
      else name="Luna Piena";
      return {illum:pct/100,illumPct:pct,isWaxing:wax,name};
    }catch(e){}
  }
  return {illum:.5,illumPct:50,isWaxing:true,name:"Luna"};
}
function getSunTimesPure(lat,lon,date,alt){
  try{
    const jd=date.getTime()/86400000+2440587.5;
    const n=Math.floor(jd-2451545.0+0.0008);
    const Js=n-lon/360;
    const M=norm360(357.5291+0.98560028*Js);
    const C=1.9148*Math.sin(rad(M))+0.0200*Math.sin(rad(2*M))+0.0003*Math.sin(rad(3*M));
    const lambda=norm360(M+C+180+102.9372);
    const Jt=2451545.0+Js+0.0053*Math.sin(rad(M))-0.0069*Math.sin(rad(2*lambda));
    const sinDec=Math.sin(rad(lambda))*Math.sin(rad(23.44));
    const cosDec=Math.cos(Math.asin(sinDec));
    const cosH=(Math.sin(rad(alt))-Math.sin(rad(lat))*sinDec)/(Math.cos(rad(lat))*cosDec);
    if(cosH>1||cosH<-1)return null;
    const H=deg(Math.acos(cosH));
    const toDate=j=>new Date((j-2440587.5)*86400000);
    return {rise:toDate(Jt-H/360),set:toDate(Jt+H/360)};
  }catch(e){return null;}
}
function getNightWindow(date){
  const sunSet=getSunTimesPure(state.lat,state.lon,date,-0.833);
  if(!sunSet)return null;
  const next=new Date(sunSet.set);next.setDate(next.getDate()+1);
  const sunRise=getSunTimesPure(state.lat,state.lon,next,-0.833);
  if(!sunRise)return null;
  return {start:sunSet.set,end:sunRise.rise};
}
function getMoonRiseSet(lat,lon,date){
  if(hasAstro()){
    try{
      const obs=new Astronomy.Observer(lat,lon,0);
      const noon=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12,0,0);
      const t=new Astronomy.AstroTime(noon);
      const rise=Astronomy.SearchRiseSet(Astronomy.Body.Moon,obs,+1,t,2);
      const set=Astronomy.SearchRiseSet(Astronomy.Body.Moon,obs,-1,t,2);
      return {rise:rise?rise.date:null,set:set?set.date:null};
    }catch(e){}
  }
  return {rise:null,set:null};
}
function getMoonPathSVG(pct,wax){
  const r=30,cx=50,cy=50;
  if(pct<2)return "";
  if(pct>98)return `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx} ${cy+r} A ${r} ${r} 0 1 1 ${cx} ${cy-r} Z`;
  const cosE=Math.cos(rad(pct*180/100));
  const rx=r*Math.abs(cosE);
  const s1=wax?1:0,s2=wax?0:1;
  if(pct<50)return `M ${cx} ${cy-r} A ${r} ${r} 0 0 ${s1} ${cx} ${cy+r} A ${rx} ${r} 0 0 ${s2} ${cx} ${cy-r} Z`;
  if(wax)return `M ${cx} ${cy-r} A ${r} ${r} 0 0 1 ${cx} ${cy+r} A ${rx} ${r} 0 0 1 ${cx} ${cy-r} Z`;
  return `M ${cx} ${cy-r} A ${r} ${r} 0 0 0 ${cx} ${cy+r} A ${rx} ${r} 0 0 0 ${cx} ${cy-r} Z`;
}

/* ============================================================
   UI / TAB / COORDINATE
   ============================================================ */
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
    fetchAstroWeather();
    if(state.owmApiKey)fetchWeather();
  }
}
function toggleNightMode(){
  document.body.classList.toggle('night-mode');
  const isNight=document.body.classList.contains('night-mode');
  document.getElementById('nightBtnText').innerText=isNight?'Notturna ON':'Notturna';
  const mp=document.getElementById('moon-phase-path');
  if(mp)mp.setAttribute('fill',isNight?'#ff3333':'#f3e5ab');
  if(document.getElementById('tab-sky').classList.contains('active'))drawMap();
}
function readInputs(){
  state.lat=parseFloat(document.getElementById('lat').value)||0;
  state.lon=parseFloat(document.getElementById('lon').value)||0;
  const d=document.getElementById('date').value;const t=document.getElementById('time').value;
  if(d&&t){
    const [y,m,day]=d.split('-');const [h,mi,s]=t.split(':');
    state.baseTime=new Date(parseInt(y),parseInt(m)-1,parseInt(day),parseInt(h),parseInt(mi),parseInt(s||0));
  }else state.baseTime=new Date();
  state.currentTime=new Date(state.baseTime);
  state.sqm=estimateSQM(state.lat,state.lon);
  state.bortle=sqmToBortle(state.sqm);
  _planetCache.key=null;
  try{
    localStorage.setItem('albertoastro_lat', state.lat);
    localStorage.setItem('albertoastro_lon', state.lon);
  }catch(e){}
}
function updateAll(){
  readInputs();
  renderSunMoon();renderSkyQuality();renderQuality();
  if(document.getElementById('tab-sky').classList.contains('active'))onSliderChange();
  if(document.getElementById('tab-tonight').classList.contains('active'))renderTonight();
  if(state.weatherMap)centerWeatherMap();
  const m=document.getElementById('msg-coord');
  m.innerText="✅ Aggiornato";m.className="msg success";
}
function loadCity(){
  const v=document.getElementById('citySelect').value;if(!v)return;
  const [lat,lon,city]=v.split(',');
  document.getElementById('lat').value=lat;document.getElementById('lon').value=lon;
  const m=document.getElementById('msg-coord');
  m.innerText=`📍 ${city}`;m.className="msg success";
  updateAll();
}

function applyCoordinates(lat,lon,city,accuracy){
  const latS=parseFloat(lat).toFixed(4);const lonS=parseFloat(lon).toFixed(4);
  document.getElementById('lat').value=latS;document.getElementById('lon').value=lonS;
  state.lat=parseFloat(latS);state.lon=parseFloat(lonS);
  state.gpsAccuracy=accuracy||null;
  try{
    localStorage.setItem('albertoastro_lat',state.lat);
    localStorage.setItem('albertoastro_lon',state.lon);
  }catch(e){}
  const m=document.getElementById('msg-coord');
  m.innerHTML=`📍 ${city||'GPS'}${accuracy?' ±'+Math.round(accuracy)+'m':''} — <a href="https://www.google.com/maps?q=${latS},${lonS}" target="_blank" style="color:var(--accent)">Mappa</a>`;
  m.className="msg success";
  state.sqm=estimateSQM(state.lat,state.lon);
  state.bortle=sqmToBortle(state.sqm);
  updateAll();
  if(document.getElementById('tab-weather').classList.contains('active')){
    fetchAstroWeather();
    if(state.owmApiKey)fetchWeather();
  }
}
function fetchJSONWithTimeout(url, timeout){
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(r => { clearTimeout(id); resolve(r); })
      .catch(e => { clearTimeout(id); reject(e); });
  });
}
async function getIPLocation(){
  try{
    const r=await fetchJSONWithTimeout('https://ipapi.co/json/', 6000);
    const d=await r.json();
    if(d.latitude && d.longitude) return {lat:parseFloat(d.latitude),lon:parseFloat(d.longitude),city:d.city};
  }catch(e){console.warn('ipapi err',e);}
  try{
    const r=await fetchJSONWithTimeout('https://ipinfo.io/json', 6000);
    const d=await r.json();
    const [la,lo]=(d.loc||',').split(',').map(Number);
    if(la&&lo) return {lat:la,lon:lo,city:d.city};
  }catch(e){console.warn('ipinfo err',e);}
  return null;
}
async function getLocation(){
  const m=document.getElementById('msg-coord');
  m.innerText="📡 Rilevamento...";m.className="msg";m.style.color='';
  if(navigator.geolocation){
    try{
      const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:false,timeout:15000,maximumAge:60000}));
      applyCoordinates(pos.coords.latitude,pos.coords.longitude,'GPS',pos.coords.accuracy);
      return;
    }catch(e){console.warn('GPS err',e);}
  }
  const loc=await getIPLocation();
  if(loc)applyCoordinates(loc.lat,loc.lon,loc.city||'IP',null);
  else{m.innerText="⚠️ Impossibile rilevare posizione. Inserisci manualmente.";m.style.color="var(--warn)";}
}
function toggleGPSLive(){
  const btn=document.getElementById('gpsLiveBtn');
  const m=document.getElementById('msg-coord');
  if(state.gpsLiveActive){
    if(state.gpsLiveWatchId!==null)navigator.geolocation.clearWatch(state.gpsLiveWatchId);
    state.gpsLiveActive=false;state.gpsLiveWatchId=null;
    btn.classList.remove('active');btn.innerText='📡 GPS Live';
    m.innerText="GPS Live disattivato.";m.className="msg";
    return;
  }
  if(!navigator.geolocation){m.innerText="❌ GPS non supportato";return;}
  state.gpsLiveActive=true;btn.classList.add('active');btn.innerText='📡 Live ON';
  state.gpsLiveWatchId=navigator.geolocation.watchPosition(
    pos=>applyCoordinates(pos.coords.latitude,pos.coords.longitude,'GPS Live',pos.coords.accuracy),
    err=>{if(err.code===1){m.innerText="❌ Permesso negato";toggleGPSLive();}},
    {enableHighAccuracy:false,timeout:15000,maximumAge:5000}
  );
}

/* ============================================================
   RENDER: SQM, BORTLE, QUALITÀ, STASERA
   ============================================================ */
function renderSkyQuality(){
  const d=sqmToDesc(state.sqm);
  const b=state.bortle || sqmToBortle(state.sqm);
  document.getElementById('sky-quality-grid').innerHTML=`
    <div class="card"><label>SQM stimato</label><div class="val">${state.sqm.toFixed(2)}</div></div>
    <div class="card"><label>Classe Bortle</label><div class="val">${b.class}/9</div></div>
    <div class="card"><label>Giudizio</label><div class="val" style="color:var(--${d.badge})">${d.label}</div></div>
    <div class="card" style="grid-column:1/-1"><label>Descrizione Bortle</label><div style="color:var(--muted);font-size:13px;margin-top:4px">${b.desc}</div></div>`;
}
function renderSunMoon(){
  try{
    const m=getExactMoonData(state.currentTime);
    const tStd=getSunTimesPure(state.lat,state.lon,state.currentTime,-0.833);
    const night=getNightWindow(state.currentTime);
    const mt=getMoonRiseSet(state.lat,state.lon,night?night.start:state.currentTime);
    const fmt=d=>d?d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'—';
    document.getElementById('table-sun').innerHTML=`
      <tr><td>Alba</td><td>${fmt(tStd&&tStd.rise)}</td></tr>
      <tr><td>Tramonto</td><td>${fmt(tStd&&tStd.set)}</td></tr>`;
    document.getElementById('table-moon').innerHTML=`
      <tr><td>Fase</td><td>${m.name}</td></tr>
      <tr><td>Illuminazione</td><td>${m.illumPct.toFixed(0)}%</td></tr>
      <tr><td>Sorge</td><td>${fmt(mt.rise)}</td></tr>
      <tr><td>Tramonta</td><td>${fmt(mt.set)}</td></tr>`;
    document.getElementById('moon-phase-path').setAttribute('d',getMoonPathSVG(m.illumPct,m.isWaxing));
    document.getElementById('moon-phase-name').innerText=m.name;
  }catch(e){console.error('renderSunMoon err',e);}
}
function renderQuality(){
  const m=getExactMoonData(state.currentTime);
  const sqmScore=Math.max(0,Math.min(10,(state.sqm-17)/0.5));
  const moonPen=m.illum>.5?2:(m.illum>.2?1:0);
  const cloudPen=state.clouds>70?3:(state.clouds>30?1:0);
  const score=Math.max(1,Math.min(10,sqmScore-moonPen-cloudPen));
  const badge=score>7?'ok':(score>4?'warn':'bad');
  const text=score>7?'Eccellente':(score>4?'Discreto':'Scarso');
  document.getElementById('quality-grid').innerHTML=`
    <div class="card"><label>Punteggio</label><div class="val">${score.toFixed(1)}/10</div></div>
    <div class="card"><label>Giudizio</label><div class="val" style="color:var(--${badge})">${text}</div></div>
    <div class="card"><label>SQM</label><div class="val">${state.sqm.toFixed(2)}</div></div>
    <div class="card"><label>Bortle</label><div class="val">${state.bortle?state.bortle.class:'—'}/9</div></div>
    <div class="card"><label>Nuvole</label><div class="val">${state.clouds.toFixed(0)}%</div></div>`;
}
function renderTonight(){
  try{
    document.getElementById('tonight-time').innerText=state.currentTime.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    const night=getNightWindow(state.currentTime);
    if(!night){document.getElementById('tonight-location').innerText="Dati non disponibili";return;}
    document.getElementById('tonight-location').innerText=`${state.lat.toFixed(2)}°, ${state.lon.toFixed(2)}° — ${night.start.toLocaleDateString('it-IT',{day:'numeric',month:'long'})} · Bortle ${state.bortle?state.bortle.class:'—'}`;
    const step=20*60000;const samples=[];
    for(let t=night.start.getTime();t<=night.end.getTime();t+=step)samples.push(new Date(t));
    const pData=samples.map(d=>calcPlanetsPrecise(d));
    const evalFixed=objList=>objList.map(o=>{
      let maxAlt=-90,maxTime=null;
      samples.forEach(d=>{const p=getAltAz(o.ra,o.dec,d);if(p.alt>maxAlt){maxAlt=p.alt;maxTime=d;}});
      return {...o,maxAlt,maxTime};
    }).filter(o=>o.maxAlt>10).sort((a,b)=>b.maxAlt-a.maxAlt);
    let html='';
    if(pData.length>0&&pData[0].length>0){
      const moon=pData[0].find(x=>x.isMoon);
      if(moon){
        let maxAlt=-90;
        pData.forEach(arr=>{const m=arr.find(x=>x.isMoon);if(m&&m.alt>maxAlt)maxAlt=m.alt;});
        if(maxAlt>0){const md=getExactMoonData(state.currentTime);html+=`<div class="object-row"><div><span class="object-name">🌙 Luna (${md.illumPct.toFixed(0)}%)</span></div><div><span class="object-alt">${maxAlt.toFixed(1)}°</span></div></div>`;}
      }
    }
    const prs=[];
    PLANET_NAMES.forEach(name=>{
      let maxAlt=-90;const it=PLANET_IT[name];
      pData.forEach(arr=>{const p=arr.find(x=>x.n===it);if(p&&p.alt>maxAlt)maxAlt=p.alt;});
      if(maxAlt>0){const r=pData[0]&&pData[0].find(x=>x.n===it);if(r)prs.push({n:it,s:r.s,maxAlt});}
    });
    prs.sort((a,b)=>b.maxAlt-a.maxAlt);
    html+=prs.map(p=>`<div class="object-row"><div><span class="object-name">${p.s} ${p.n}</span></div><div><span class="object-alt${p.maxAlt<20?' low':''}">${p.maxAlt.toFixed(1)}°</span></div></div>`).join('');
    document.getElementById('tonight-planets').innerHTML=html||'<div style="color:var(--muted);padding:10px">Nessun pianeta visibile.</div>';
    const mess=evalFixed(Object.values(MESSIER));
    document.getElementById('tonight-messier').innerHTML=mess.length===0
      ?'<div style="color:var(--muted);padding:10px">Nessun oggetto ben posizionato.</div>'
      :mess.slice(0,20).map(m=>`<div class="object-row"><div><span class="object-name">${m.n}</span></div><div><span class="object-alt${m.maxAlt<30?' low':''}">${m.maxAlt.toFixed(1)}°</span></div></div>`).join('');
    const constList=CONSTELLATIONS.map(c=>{const mid=c.stars[Math.floor(c.stars.length/2)];return {name:c.name,ra:mid.ra,dec:mid.dec};});
    const cr=evalFixed(constList);
    document.getElementById('tonight-constellations').innerHTML=cr.length===0
      ?'<div style="color:var(--muted);padding:10px">Nessuna costellazione visibile.</div>'
      :cr.map(c=>`<div class="object-row"><div><span class="object-name">${c.name}</span></div><div><span class="object-alt${c.maxAlt<30?' low':''}">${c.maxAlt.toFixed(1)}°</span></div></div>`).join('');
  }catch(e){console.error('renderTonight err',e);}
}

/* ============================================================
   CATALOGO
   ============================================================ */
function buildCatalog(){
  const items=[];
  items.push({id:'sun',name:'Sole',symbol:'☀️',cat:'planet',type:'Stella',desc:'La stella al centro del Sistema Solare.'});
  items.push({id:'moon',name:'Luna',symbol:'🌙',cat:'planet',type:'Satellite',desc:"L'unico satellite naturale della Terra."});
  PLANET_NAMES.forEach(name=>items.push({id:'p-'+name,name:PLANET_IT[name],symbol:PLANET_SYMBOLS[name],cat:'planet',type:'Pianeta',desc:'Pianeta del Sistema Solare.'}));
  STARS.forEach(s=>items.push({id:'s-'+s.n,name:s.n,symbol:'★',cat:'star',type:'Stella',ra:s.ra,dec:s.dec,mag:s.mag,desc:`Stella di magnitudine ${s.mag}.`}));
  Object.entries(MESSIER).forEach(([k,m])=>{
    const cat=m.type==='Galassia'?'galaxy':(m.type==='Ammasso'?'cluster':'nebula');
    items.push({id:'m-'+k,name:m.n,cat,type:m.type,ra:m.ra,dec:m.dec,mag:m.mag,desc:m.desc,dist:m.dist});
  });
  NEBULAE_EXTRA.forEach(n=>{
    const mm=n.n.match(/\(([^)]+)\)/);const sg=mm?mm[1]:n.n;
    items.push({id:'n-'+sg,name:n.n,cat:'nebula',type:'Nebulosa',ra:n.ra,dec:n.dec,mag:n.mag,desc:n.desc,dist:n.dist});
  });
  CONSTELLATIONS.forEach(c=>{
    const mid=c.stars[Math.floor(c.stars.length/2)];
    items.push({id:'c-'+c.name,name:c.name,cat:'constellation',type:'Costellazione',ra:mid.ra,dec:mid.dec,desc:c.desc,area:c.area,season:c.season});
  });
  return items;
}
const CATALOG=buildCatalog();
function setCatalogFilter(cat,btn){
  state.catalogFilter=cat;
  document.querySelectorAll('#catTabs .cat-tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderCatalog();
}
function renderCatalog(){
  try{
    const q=(document.getElementById('catalogSearch').value||'').trim().toLowerCase();
    const grid=document.getElementById('catalogGrid');
    const items=CATALOG.filter(it=>{
      if(state.catalogFilter!=='all'&&it.cat!==state.catalogFilter)return false;
      if(!q)return true;
      return (it.name+' '+(it.type||'')).toLowerCase().includes(q);
    });
    document.getElementById('cat-count').innerText=items.length;
    grid.innerHTML=items.map(it=>`
      <div class="cat-item" onclick="openCatDetail('${it.id}')">
        <div class="cat-name">${it.symbol||''} ${it.name}</div>
        <div class="cat-sub">${it.type}${it.mag?' · mag '+it.mag:''}</div>
      </div>`).join('');
  }catch(e){console.error('renderCatalog err',e);}
}
function openCatDetail(id){
  const it=CATALOG.find(x=>x.id===id);if(!it)return;
  state.catalogDetailObj=it;
  document.getElementById('cat-detail-title').innerText=`${it.symbol||''} ${it.name}`;
  document.getElementById('cat-detail-sub').innerText=it.type;
  const rows=[];
  if(it.desc)rows.push(`<div class="detail-row" style="grid-column:1/-1"><div class="dl">Descrizione</div><div class="dv" style="line-height:1.5">${it.desc}</div></div>`);
  if(it.mag)rows.push(`<div class="detail-row"><div class="dl">Magnitudine</div><div class="dv">${it.mag}</div></div>`);
  if(it.dist)rows.push(`<div class="detail-row"><div class="dl">Distanza</div><div class="dv">${it.dist}</div></div>`);
  if(it.ra!==undefined&&it.ra!==null){
    const pos=getAltAz(it.ra,it.dec,state.currentTime);
    rows.push(`<div class="detail-row"><div class="dl">RA / Dec</div><div class="dv">${it.ra.toFixed(2)}° / ${it.dec.toFixed(2)}°</div></div>`);
    rows.push(`<div class="detail-row"><div class="dl">Alt / Az</div><div class="dv">${pos.alt.toFixed(1)}° / ${pos.az.toFixed(1)}°</div></div>`);
    rows.push(`<div class="detail-row"><div class="dl">Visibilità</div><div class="dv" style="color:var(--${pos.alt>0?'ok':'bad'})">${pos.alt>0?'✅ Sopra orizzonte':'❌ Sotto orizzonte'}</div></div>`);
  }
  if(it.area)rows.push(`<div class="detail-row"><div class="dl">Area</div><div class="dv">${it.area}</div></div>`);
  if(it.season)rows.push(`<div class="detail-row"><div class="dl">Stagione</div><div class="dv">${it.season}</div></div>`);
  document.getElementById('cat-detail-grid').innerHTML=rows.join('');
  document.getElementById('cat-detail-modal').classList.add('open');
}
function closeCatDetail(){document.getElementById('cat-detail-modal').classList.remove('open');state.catalogDetailObj=null;}
function catDetailGoto(){
  const it=state.catalogDetailObj;if(!it)return;
  let ra=it.ra,dec=it.dec;
  if(it.cat==='planet'){
    const ps=calcPlanetsPrecise(state.currentTime);
    const p=ps.find(x=>x.n===it.name);
    if(!p){alert('Oggetto non disponibile.');return;}
    ra=p.ra;dec=p.dec;
  }
  if(ra===undefined||ra===null){alert('Senza coordinate.');return;}
  closeCatDetail();
  state.target={n:it.name,ra,dec};
  const btns=document.querySelectorAll('nav button');
  switchTab('tab-sky',btns[1]);
  const pos=getAltAz(ra,dec,state.currentTime);
  state.camAlt=clamp(pos.alt,0,89);state.camAz=pos.az;
  drawMap();
}

/* ============================================================
   MAPPA DEL CIELO
   ============================================================ */
const canvas=document.getElementById('skyCanvas');
const ctx=canvas?canvas.getContext('2d'):null;
const SIZE=1000;
const BG_STARS=[];
(function(){
  let seed=12345;const rand=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
  for(let i=0;i<1200;i++)BG_STARS.push({ra:rand()*360,dec:Math.asin(rand()*2-1)*180/Math.PI,mag:rand()*4.5+1,alpha:rand()*0.6+0.15});
})();
function getStarColor(mag){
  if(mag<0.5)return '#fff';
  if(mag<1.5)return '#ffffcc';
  if(mag<2.5)return '#ffeedd';
  return '#ffddcc';
}
function project(alt,az){
  const cx=SIZE/2,cy=SIZE/2;
  const aR=rad(alt),zR=rad(az);
  const o={x:Math.cos(aR)*Math.sin(zR),y:Math.cos(aR)*Math.cos(zR),z:Math.sin(aR)};
  const cA=rad(state.camAlt),cZ=rad(state.camAz);
  const f={x:Math.cos(cA)*Math.sin(cZ),y:Math.cos(cA)*Math.cos(cZ),z:Math.sin(cA)};
  const r={x:Math.cos(cZ),y:-Math.sin(cZ),z:0};
  const u={x:r.y*f.z-r.z*f.y,y:r.z*f.x-r.x*f.z,z:r.x*f.y-r.y*f.x};
  const zV=o.x*f.x+o.y*f.y+o.z*f.z;
  if(zV<0.05)return {x:cx,y:cy,visible:false};
  const xV=o.x*r.x+o.y*r.y+o.z*r.z;
  const yV=o.x*u.x+o.y*u.y+o.z*u.z;
  const fov=rad(state.fov);
  const focal=(SIZE/2)/Math.tan(fov/2);
  const d=1+zV;
  const x=cx+(xV*focal)/d;
  const y=cy-(yV*focal)/d;
  const visible=x>=-50&&x<=SIZE+50&&y>=-50&&y<=SIZE+50;
  return {x,y,visible};
}
function drawMap(){
  if(!ctx)return;
  try{
    const cx=SIZE/2,cy=SIZE/2;
    ctx.clearRect(0,0,SIZE,SIZE);
    const isNight=document.body.classList.contains('night-mode');
    const colorLine=isNight?'#ff3333':'#d4af37';
    const colorGrid=isNight?'rgba(255,80,80,.12)':'rgba(150,180,255,.12)';
    const bg=ctx.createRadialGradient(cx,cy,10,cx,cy,SIZE*.8);
    bg.addColorStop(0,isNight?'#1a0000':'#0a1530');
    bg.addColorStop(.5,isNight?'#0a0000':'#030818');
    bg.addColorStop(1,'#000');
    ctx.fillStyle=bg;ctx.fillRect(0,0,SIZE,SIZE);
    BG_STARS.forEach(s=>{
      const pos=getAltAz(s.ra,s.dec,state.currentTime);
      if(pos.alt<-5)return;
      const pt=project(pos.alt,pos.az);if(!pt.visible)return;
      const size=Math.max(.4,1.8-s.mag*.3);
      ctx.fillStyle=isNight?`rgba(255,${100+s.mag*30|0},${100+s.mag*30|0},${s.alpha})`:`rgba(220,235,255,${s.alpha})`;
      ctx.beginPath();ctx.arc(pt.x,pt.y,size,0,Math.PI*2);ctx.fill();
    });
    if(document.getElementById('filtroGriglia').checked){
      ctx.strokeStyle=colorGrid;ctx.lineWidth=1;
      for(let alt=0;alt<=80;alt+=20){ctx.beginPath();let s=false;for(let az=0;az<=360;az+=2){const p=project(alt,az);if(!p.visible){s=false;continue;}if(!s){ctx.moveTo(p.x,p.y);s=true;}else ctx.lineTo(p.x,p.y);}ctx.stroke();}
      for(let az=0;az<360;az+=30){ctx.beginPath();let s=false;for(let alt=0;alt<=85;alt+=2){const p=project(alt,az);if(!p.visible){s=false;continue;}if(!s){ctx.moveTo(p.x,p.y);s=true;}else ctx.lineTo(p.x,p.y);}ctx.stroke();}
    }
    ctx.strokeStyle=isNight?'rgba(255,60,60,.5)':'rgba(120,160,255,.5)';
    ctx.lineWidth=2;ctx.beginPath();let s=false;
    for(let az=0;az<=360;az+=2){const p=project(0,az);if(!p.visible){s=false;continue;}if(!s){ctx.moveTo(p.x,p.y);s=true;}else ctx.lineTo(p.x,p.y);}
    ctx.stroke();
    [{l:'N',az:0},{l:'E',az:90},{l:'S',az:180},{l:'O',az:270}].forEach(d=>{
      const p=project(0,d.az);if(!p.visible)return;
      ctx.fillStyle=colorLine;ctx.font='bold 18px Orbitron';ctx.textAlign='center';ctx.fillText(d.l,p.x,p.y-8);
    });
    if(document.getElementById('filtroCostellazioni').checked){
      ctx.strokeStyle=isNight?'rgba(255,100,100,.45)':'rgba(150,200,255,.45)';ctx.lineWidth=1.5;
      CONSTELLATIONS.forEach(c=>{
        ctx.beginPath();let prev=null;let pv=false;
        c.stars.forEach(s=>{
          const pos=getAltAz(s.ra,s.dec,state.currentTime);
          const pt=project(pos.alt,pos.az);
          if(pt.visible&&pos.alt>-5){if(pv&&prev){ctx.moveTo(prev.x,prev.y);ctx.lineTo(pt.x,pt.y);}prev=pt;pv=true;}
          else{pv=false;prev=null;}
        });
        ctx.stroke();
      });
    }
    if(document.getElementById('filtroStelle').checked){
      STARS.forEach(s=>{
        const pos=getAltAz(s.ra,s.dec,state.currentTime);
        if(pos.alt<-5)return;
        const pt=project(pos.alt,pos.az);if(!pt.visible)return;
        const size=Math.max(1,4-s.mag*.9);
        const col=isNight?(s.mag<1?'#ff6666':'#cc4444'):getStarColor(s.mag);
        if(s.mag<1.2){
          const g=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,size*4);
          g.addColorStop(0,col);g.addColorStop(1,'transparent');
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(pt.x,pt.y,size*4,0,Math.PI*2);ctx.fill();
        }
        ctx.beginPath();ctx.arc(pt.x,pt.y,size,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();
        if(s.mag<1.8){ctx.fillStyle=isNight?'#ff9999':'#c9d1e3';ctx.font='12px Inter';ctx.textAlign='left';ctx.fillText(s.n,pt.x+10,pt.y+4);}
      });
    }
    if(document.getElementById('filtroPianeti').checked){
      const planets=calcPlanetsPrecise(state.currentTime);
      planets.forEach(p=>{
        const pos=p.alt!==undefined?p:getAltAz(p.ra,p.dec,state.currentTime);
        if(pos.alt<-5)return;
        const pt=project(pos.alt,pos.az);if(!pt.visible)return;
        if(p.isSun){
          const g=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,40);
          g.addColorStop(0,'rgba(255,230,0,.95)');g.addColorStop(1,'transparent');
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(pt.x,pt.y,40,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(pt.x,pt.y,11,0,Math.PI*2);ctx.fillStyle='#ffe600';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
          ctx.fillStyle='#ffcc00';ctx.font='bold 14px Inter';ctx.fillText('☀️ Sole',pt.x+16,pt.y+5);
        }else if(p.isMoon){
          const md=getExactMoonData(state.currentTime);
          ctx.beginPath();ctx.arc(pt.x,pt.y,10,0,Math.PI*2);ctx.fillStyle=isNight?'#ff5555':'#f3e5ab';ctx.fill();
          ctx.strokeStyle=isNight?'#ff6666':'#d4af37';ctx.lineWidth=1;ctx.stroke();
          ctx.fillStyle=isNight?'#ff6666':'#f3e5ab';ctx.font='bold 13px Inter';ctx.fillText(`🌙 Luna (${md.illumPct.toFixed(0)}%)`,pt.x+16,pt.y+5);
        }else{
          const col=isNight?'#ff0000':(p.color||'#d4af37');
          const g=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,20);
          g.addColorStop(0,col);g.addColorStop(1,'transparent');
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(pt.x,pt.y,20,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(pt.x,pt.y,7,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
          ctx.fillStyle=isNight?'#ff3333':'#f3e5ab';ctx.font='bold 14px Inter';ctx.fillText(p.s+' '+p.n,pt.x+12,pt.y+4);
        }
      });
    }
    Object.values(MESSIER).forEach(m=>{
      const isN=m.type==='Nebulosa',isG=m.type==='Galassia',isA=m.type==='Ammasso';
      if((isN&&!document.getElementById('filtroNebulose').checked)||(isG&&!document.getElementById('filtroGalassie').checked)||(isA&&!document.getElementById('filtroAmmassi').checked))return;
      const pos=getAltAz(m.ra,m.dec,state.currentTime);
      if(pos.alt<-5)return;
      const pt=project(pos.alt,pos.az);if(!pt.visible)return;
      const col=isNight?'#ff3333':'#8bd3ff';
      ctx.beginPath();
      if(isG)ctx.ellipse(pt.x,pt.y,7,4,0,0,Math.PI*2);
      else if(isN)ctx.rect(pt.x-5,pt.y-5,10,10);
      else ctx.arc(pt.x,pt.y,6,0,Math.PI*2);
      ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();
    });
    const hudAz=document.getElementById('hud-az');if(hudAz)hudAz.innerText=state.camAz.toFixed(0)+'°';
    const hudAlt=document.getElementById('hud-alt');if(hudAlt)hudAlt.innerText=state.camAlt.toFixed(0)+'°';
    const hudZoom=document.getElementById('hud-zoom');if(hudZoom)hudZoom.innerText=(120/state.fov).toFixed(1)+'x';
    const hudTime=document.getElementById('hud-time');if(hudTime)hudTime.innerText=state.currentTime.getHours().toString().padStart(2,'0')+':'+state.currentTime.getMinutes().toString().padStart(2,'0');
  }catch(e){console.error('drawMap err',e);}
}
function resetView(){state.camAlt=45;state.camAz=0;state.fov=80;drawMap();}
function zoomIn(){state.fov=Math.max(10,state.fov-15);drawMap();}
function zoomOut(){state.fov=Math.min(180,state.fov+15);drawMap();}
let isDragging=false,lastX=0,lastY=0,dragMoved=false;
if(canvas){
  canvas.addEventListener('mousedown',e=>{isDragging=true;dragMoved=false;lastX=e.clientX;lastY=e.clientY;});
  window.addEventListener('mouseup',()=>{isDragging=false;});
  canvas.addEventListener('mousemove',e=>{
    if(!isDragging)return;
    const dx=e.clientX-lastX,dy=e.clientY-lastY;
    if(Math.abs(dx)>2||Math.abs(dy)>2)dragMoved=true;
    if(dragMoved){state.camAz=norm360(state.camAz-dx*.4*(state.fov/120));state.camAlt=clamp(state.camAlt+dy*.4*(state.fov/120),0,89);lastX=e.clientX;lastY=e.clientY;drawMap();}
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.fov=clamp(state.fov+(e.deltaY<0?-8:8),10,180);drawMap();},{passive:false});
  canvas.addEventListener('touchstart',e=>{if(e.touches.length===1){isDragging=true;dragMoved=false;lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;}},{passive:true});
  canvas.addEventListener('touchmove',e=>{
    if(isDragging&&e.touches.length===1){
      const dx=e.touches[0].clientX-lastX,dy=e.touches[0].clientY-lastY;
      if(Math.abs(dx)>2||Math.abs(dy)>2)dragMoved=true;
      if(dragMoved){state.camAz=norm360(state.camAz-dx*.4*(state.fov/120));state.camAlt=clamp(state.camAlt+dy*.4*(state.fov/120),0,89);lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;drawMap();}
    }
  },{passive:true});
  canvas.addEventListener('touchend',()=>{isDragging=false;});
}
function onSliderChange(){
  const o=parseInt(document.getElementById('timeSlider').value);
  state.currentTime=new Date(state.baseTime.getTime()+o*60000);
  const h=state.currentTime.getHours().toString().padStart(2,'0');
  const m=state.currentTime.getMinutes().toString().padStart(2,'0');
  document.getElementById('sliderTimeDisplay').innerText=`${h}:${m} (${o>=0?'+':''}${o}m)`;
  _planetCache.key=null;
  if(document.getElementById('tab-sky').classList.contains('active'))drawMap();
}
function setTimeOffset(min){document.getElementById('timeSlider').value=min;onSliderChange();}

function openSolarModal(){
  const grid=document.getElementById('solar-detail-grid');
  let html='';
  if(hasAstro()){
    try{
      const obs=new Astronomy.Observer(state.lat,state.lon,0);
      const time=new Astronomy.AstroTime(state.currentTime);
      const e=Astronomy.Equator(Astronomy.Body.Sun,time,obs,true,true);
      const h=Astronomy.Horizon(time,obs,e.ra,e.dec,'normal');
      const v=Astronomy.GeoVector(Astronomy.Body.Sun,time,false);
      html=`
        <div class="detail-row"><div class="dl">Distanza</div><div class="dv">${v.Length().toFixed(4)} UA</div></div>
        <div class="detail-row"><div class="dl">RA / Dec</div><div class="dv">${(e.ra*15).toFixed(2)}° / ${e.dec.toFixed(2)}°</div></div>
        <div class="detail-row"><div class="dl">Alt / Az</div><div class="dv">${h.altitude.toFixed(1)}° / ${h.azimuth.toFixed(1)}°</div></div>
        <div class="detail-row"><div class="dl">Ciclo solare</div><div class="dv">Ciclo 25 (2024-2026 massimo)</div></div>`;
    }catch(e){}
  }
  grid.innerHTML=html||'<div class="detail-row"><div class="dl">Info</div><div class="dv">Usa i link NOAA/SOHO sotto.</div></div>';
  document.getElementById('solar-modal').classList.add('open');
}
function closeSolarModal(){document.getElementById('solar-modal').classList.remove('open');}

function handleLogoUpload(event){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    const imgData=e.target.result;
    document.getElementById('logoImg').src=imgData;
    document.getElementById('logoImg').style.display='block';
    document.getElementById('logoFallback').style.display='none';
    try{localStorage.setItem('albertoastro_logo',imgData);}catch(err){}
  };
  reader.readAsDataURL(file);
}

/* ============================================================
   METEO — MAPPA + API ASTRONOMIA VISUALE
   ============================================================ */

function getBoundsAround(lat, lon, spanDeg = 0.35) {
  const latSpan = spanDeg;
  const lonSpan = spanDeg / Math.max(0.2, Math.cos(rad(lat)));
  return [
    [lat - latSpan, lon - lonSpan],
    [lat + latSpan, lon + lonSpan]
  ];
}

function findClosestHourIndex(times, now = new Date()) {
  let best = 0, bestDiff = Infinity;
  times.forEach((t, i) => {
    const diff = Math.abs(new Date(t) - now);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

// --- API 1: Open-Meteo forecast (nubi stratificate, umidità, vento, temp)
async function fetchOpenMeteoForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,temperature_2m,wind_speed_10m,wind_gusts_10m,visibility`
    + `&forecast_days=1&timezone=auto`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.hourly || !data.hourly.time) throw new Error('Dati orari non disponibili');
    const i = findClosestHourIndex(data.hourly.time);
    const H = data.hourly;
    const num = v => (v == null ? null : Number(v));
    return {
      low: num(H.cloud_cover_low?.[i]),
      mid: num(H.cloud_cover_mid?.[i]),
      high: num(H.cloud_cover_high?.[i]),
      humidity: num(H.relative_humidity_2m?.[i]),
      temp: num(H.temperature_2m?.[i]),
      wind: num(H.wind_speed_10m?.[i]),
      gusts: num(H.wind_gusts_10m?.[i]),
      visibility: num(H.visibility?.[i])
    };
  } catch (e) {
    console.warn('Open-Meteo forecast err', e);
    return null;
  }
}

// --- API 2: Open-Meteo Air Quality (dust + pollini)
async function fetchAirQuality(lat, lon) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}`
    + `&hourly=dust,pollen_grass,pollen_birch,pollen_alder`
    + `&forecast_days=1&timezone=auto`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.hourly || !data.hourly.time) throw new Error('Dati orari AQ non disponibili');
    const i = findClosestHourIndex(data.hourly.time);
    const H = data.hourly;
    const num = v => (v == null ? null : Number(v));
    return {
      dust: num(H.dust?.[i]),
      pollenGrass: num(H.pollen_grass?.[i]),
      pollenBirch: num(H.pollen_birch?.[i]),
      pollenAlder: num(H.pollen_alder?.[i])
    };
  } catch (e) {
    console.warn('Air Quality err', e);
    return null;
  }
}

// --- API 3: Meteoblue astro-1h (seeing, jetstream, badlayer)
async function fetchMeteoblueAstro(lat, lon, apiKey) {
  if (!apiKey) return null;
  const url = `https://my.meteoblue.com/packages/astro-1h?lat=${lat}&lon=${lon}&apikey=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const h = data && data.data_1h;
    if (!h || !h.time) throw new Error('Dati astro-1h non disponibili');
    const times = h.time.map(ts => {
      if (typeof ts === 'string' && ts.length >= 16) return ts.replace(' ', 'T') + ':00Z';
      return ts;
    });
    const i = findClosestHourIndex(times);
    const num = v => (v == null ? null : Number(v));
    return {
      seeing: num(h.seeing?.[i]),
      seeing2: num(h.seeing2?.[i]),
      transparency: num(h.transparency?.[i]),
      jetstream: num(h.jetstream?.[i]),
      badlayer: num(h.badlayer?.[i]),
      liftedIndex: num(h.lifted_index?.[i]),
      index1: num(h.index1?.[i])
    };
  } catch (e) {
    console.warn('Meteoblue astro err', e);
    return null;
  }
}

// --- Mappa DINAMICA (segue la posizione attuale)
function initWeatherMap(){
  const el=document.getElementById('weather-map');
  if(!el || typeof L==='undefined'){console.warn('Leaflet o #weather-map mancanti');return;}
  if(state.weatherMap){
    state.weatherMap.invalidateSize();
    centerWeatherMap();
    return;
  }
  try{
    const center = [state.lat, state.lon];
    const bounds = getBoundsAround(state.lat, state.lon);
    state.weatherMap=L.map('weather-map',{
      center, zoom: 11, minZoom: 9, maxZoom: 14,
      maxBounds: bounds, maxBoundsViscosity: 1.0, zoomControl: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; OpenStreetMap contributors', maxZoom:19
    }).addTo(state.weatherMap);
    state.weatherMarker=L.marker(center).addTo(state.weatherMap)
      .bindPopup(`📍 ${state.lat.toFixed(4)}, ${state.lon.toFixed(4)}`).openPopup();
    addRainViewerLayer();
    updateWeatherLayer();
    setTimeout(()=>state.weatherMap.invalidateSize(), 100);
  }catch(e){console.error('initWeatherMap err',e);}
}

async function addRainViewerLayer(){
  if(!state.weatherMap || state.rainViewerLayer) return;
  try{
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { cache:'no-store' });
    if(!res.ok) return;
    const data = await res.json();
    const frames = data.radar && data.radar.past;
    if(!frames || frames.length === 0) return;
    const path = frames[frames.length-1].path;
    state.rainViewerLayer = L.tileLayer(
      `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`,
      { opacity: 0.55, maxZoom: 10, attribution: '&copy; RainViewer' }
    ).addTo(state.weatherMap);
  }catch(e){ console.warn('RainViewer err', e); }
}

function updateWeatherLayer(){
  if(!state.weatherMap) return;
  if(state.radarLayer){ state.weatherMap.removeLayer(state.radarLayer); state.radarLayer=null; }
  const layerType = state.activeWeatherLayer;
  if(!state.owmApiKey) return;
  let url='';
  switch(layerType){
    case 'clouds': url=`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`; break;
    case 'wind': url=`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`; break;
    case 'temp': url=`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`; break;
    case 'pressure': url=`https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${state.owmApiKey}`; break;
    default: return;
  }
  state.radarLayer=L.tileLayer(url,{ attribution:'&copy; OpenWeatherMap', maxZoom:8, opacity:0.7 }).addTo(state.weatherMap);
}

function centerWeatherMap(){
  if(!state.weatherMap) return;
  const center = [state.lat, state.lon];
  const bounds = getBoundsAround(state.lat, state.lon);
  state.weatherMap.setMaxBounds(bounds);
  state.weatherMap.setView(center, 11);
  if(state.weatherMarker){
    state.weatherMarker.setLatLng(center);
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

/* ============================================================
   VERDETTO UNIFICATO (integra tutte le fonti)
   ============================================================ */
function buildVerdict(w) {
  if (!w) return { tone: 'warn', text: '⚠️ Dati insufficienti per il verdetto.' };
  const low = w.low, mid = w.mid, high = w.high, hum = w.humidity;
  const dust = w.dust;
  const seeing = w.seeing;
  const jet = w.jetstream;
  const bortle = w.bortle;

  // 1) Nubi basse/medie → sessione annullata
  if ((low != null && low > 20) || (mid != null && mid > 20)) {
    return { tone: 'bad', text: '❌ Sessione annullata: cielo coperto da nubi basse/medie.' };
  }
  // 2) Umidità critica → condensa
  if (hum != null && hum > 88) {
    return { tone: 'warn', text: '⚠️ Allerta condensa: cielo limpido ma umidità critica. Accendi le fasce anticondensa.' };
  }
  // 3) Seeing eccellente + jet contenuto → planetaria
  if (seeing != null && seeing >= 4 && jet != null && jet < 25) {
    return { tone: 'ok', text: '✨ Serata planetaria perfetta: seeing eccellente, jet stream debole. Spingi gli ingrandimenti.' };
  }
  // 4) Deep-sky: nubi alte basse + polveri basse + Bortle ≤ 5
  if (high != null && high < 15 && dust != null && dust < 30 && bortle != null && bortle <= 5) {
    return { tone: 'ok', text: '🌌 Serata Deep-Sky consigliata: ottima trasparenza e inquinamento luminoso contenuto.' };
  }
  return { tone: 'warn', text: '🔭 Serata accettabile: seeing medio. Pianifica oggetti luminosi a medi ingrandimenti.' };
}

/* ============================================================
   FETCH METEO ASTRONOMICO COMPLETO
   ============================================================ */
async function fetchAstroWeather(){
  const card = document.getElementById('astro-weather-card');
  if(!card) return;
  card.innerHTML = '<div style="color:var(--muted);padding:10px">⏳ Caricamento dati astronomici (Open-Meteo + Air Quality + Meteoblue)...</div>';

  // Assicurati che SQM/Bortle siano calcolati per la posizione corrente
  state.sqm = estimateSQM(state.lat, state.lon);
  state.bortle = sqmToBortle(state.sqm);

  const [omRes, aqRes, mbRes] = await Promise.allSettled([
    fetchOpenMeteoForecast(state.lat, state.lon),
    fetchAirQuality(state.lat, state.lon),
    fetchMeteoblueAstro(state.lat, state.lon, state.mbApiKey)
  ]);

  const om = omRes.status === 'fulfilled' ? omRes.value : null;
  const aq = aqRes.status === 'fulfilled' ? aqRes.value : null;
  const mb = mbRes.status === 'fulfilled' ? mbRes.value : null;

  state.lastWeather = {
    low: om?.low, mid: om?.mid, high: om?.high, humidity: om?.humidity,
    dust: aq?.dust, seeing: mb?.seeing, jetstream: mb?.jetstream,
    bortle: state.bortle?.class,
    clouds: om ? Math.max(om.low ?? 0, om.mid ?? 0, om.high ?? 0) : null
  };
  if (state.lastWeather.clouds != null) state.clouds = state.lastWeather.clouds;

  const fmt = v => (v == null ? 'N/D' : (typeof v === 'number' ? v.toFixed(1) : v));
  const colorBy = (v, t1, t2) => (v == null ? 'var(--muted)' : (v <= t1 ? 'var(--ok)' : (v <= t2 ? 'var(--warn)' : 'var(--bad)')));

  let html = '';

  // --- Open-Meteo forecast
  if (om) {
    html += `
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>☁️ Nuvole basse</label>
          <div class="val" style="font-size:16px;color:${colorBy(om.low,20,60)};">${fmt(om.low)}%</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>☁️ Nuvole medie</label>
          <div class="val" style="font-size:16px;color:${colorBy(om.mid,20,60)};">${fmt(om.mid)}%</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>☁️ Nuvole alte</label>
          <div class="val" style="font-size:16px;color:${colorBy(om.high,15,40)};">${fmt(om.high)}%</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>💧 Umidità</label>
          <div class="val" style="font-size:16px;color:${colorBy(om.humidity,70,88)};">${fmt(om.humidity)}%</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>🌡️ Temperatura</label>
          <div class="val" style="font-size:16px;">${fmt(om.temp)}°C</div>
        </div>
        <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
          <label>💨 Vento</label>
          <div class="val" style="font-size:16px;">${fmt(om.wind)} km/h</div>
          <div style="font-size:10px;color:var(--muted);">Raffiche ${fmt(om.gusts)} km/h</div>
        </div>
      </div>`;
  } else {
    html += `<div style="color:var(--bad);padding:10px;">❌ Open-Meteo forecast non disponibile.</div>`;
  }

  // --- Air Quality
  if (aq) {
    html += `
      <div style="margin-top:15px;padding-top:15px;border-top:1px solid var(--line);">
        <h4 style="color:var(--accent);font-family:'Orbitron';font-size:14px;margin-bottom:10px;">
          🌫️ Trasparenza aria (Open-Meteo Air Quality)
        </h4>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>Polveri (dust)</label>
            <div class="val" style="font-size:16px;color:${aq.dust==null?'var(--muted)':(aq.dust<30?'var(--ok)':(aq.dust<60?'var(--warn)':'var(--bad)'))};">
              ${fmt(aq.dust)} µg/m³
            </div>
          </div>
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>Polline graminacee</label>
            <div class="val" style="font-size:16px;">${fmt(aq.pollenGrass)}</div>
          </div>
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>Polline betulla</label>
            <div class="val" style="font-size:16px;">${fmt(aq.pollenBirch)}</div>
          </div>
        </div>
      </div>`;
  } else {
    html += `<div style="color:var(--warn);padding:10px;margin-top:12px;">⚠️ Air Quality non disponibile.</div>`;
  }

  // --- Meteoblue (seeing + jetstream + badlayer)
  if (mb) {
    const seeingColor = mb.seeing == null ? 'var(--muted)' : (mb.seeing >= 4 ? 'var(--ok)' : (mb.seeing >= 3 ? 'var(--warn)' : 'var(--bad)'));
    const jetColor = mb.jetstream == null ? 'var(--muted)' : (mb.jetstream < 25 ? 'var(--ok)' : (mb.jetstream < 40 ? 'var(--warn)' : 'var(--bad)'));
    html += `
      <div style="margin-top:15px;padding-top:15px;border-top:1px solid var(--line);">
        <h4 style="color:var(--accent);font-family:'Orbitron';font-size:14px;margin-bottom:10px;">
          🔭 Seeing atmosferico (Meteoblue astro-1h)
        </h4>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>Seeing (1-5)</label>
            <div class="val" style="font-size:16px;color:${seeingColor};">${mb.seeing==null?'N/D':mb.seeing + '/5'}</div>
          </div>
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>Seeing 2 (1-5)</label>
            <div class="val" style="font-size:16px;">${mb.seeing2==null?'N/D':mb.seeing2 + '/5'}</div>
          </div>
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>Jet stream</label>
            <div class="val" style="font-size:16px;color:${jetColor};">${fmt(mb.jetstream)} m/s</div>
          </div>
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>Strati instabili</label>
            <div class="val" style="font-size:16px;color:${mb.badlayer ? 'var(--bad)' : 'var(--ok)'};">
              ${mb.badlayer == null ? 'N/D' : (mb.badlayer ? 'Sì' : 'No')}
            </div>
          </div>
        </div>
      </div>`;
  } else {
    html += `
      <div style="color:var(--muted);padding:12px;margin-top:12px;background:var(--bg2);border:1px dashed var(--line);border-radius:10px;font-size:12px;">
        <strong>Meteoblue non configurato.</strong> Per seeing, jet stream e strati instabili inserisci una API key gratuita
        (<a href="https://content.meteoblue.com/en/contact/support/request-api-key" target="_blank" style="color:var(--accent)">richiedila qui</a>).
      </div>`;
  }

  // --- Inquinamento luminoso (SQM + Bortle)
  {
    const b = state.bortle || sqmToBortle(state.sqm);
    const bortleColor = b.class <= 3 ? 'var(--ok)' : (b.class <= 5 ? 'var(--warn)' : 'var(--bad)');
    html += `
      <div style="margin-top:15px;padding-top:15px;border-top:1px solid var(--line);">
        <h4 style="color:var(--accent);font-family:'Orbitron';font-size:14px;margin-bottom:10px;">
          🌃 Inquinamento luminoso (SQM + Bortle)
        </h4>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>SQM stimato</label>
            <div class="val" style="font-size:16px;">${state.sqm.toFixed(2)}</div>
          </div>
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;">
            <label>Classe Bortle</label>
            <div class="val" style="font-size:16px;color:${bortleColor};">${b.class}/9</div>
          </div>
          <div class="card" style="padding:14px;background:var(--bg2);margin:0;grid-column:span 2;">
            <label>Descrizione</label>
            <div style="color:var(--muted);font-size:12px;margin-top:4px;">${b.desc}</div>
          </div>
        </div>
      </div>`;
  }

  // --- Verdetto
  const v = buildVerdict(state.lastWeather);
  const vColor = v.tone === 'ok' ? 'var(--ok)' : (v.tone === 'warn' ? 'var(--warn)' : 'var(--bad)');
  html += `
    <div style="margin-top:15px;padding:14px;background:var(--bg2);border:1px solid ${vColor};border-radius:12px;">
      <div style="font-family:'Orbitron';font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
        📋 Verdetto osservativo
      </div>
      <div style="color:${vColor};font-weight:600;font-size:14px;">${v.text}</div>
    </div>`;

  html += `<div style="font-size:10px;color:var(--muted);margin-top:10px;text-align:right;">
    📍 Lat ${state.lat.toFixed(3)}, Lon ${state.lon.toFixed(3)} — posizione attuale
  </div>`;

  card.innerHTML = html;
  renderQuality();
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

function saveOwmKey(){
  const key=document.getElementById('owm-api-key').value.trim();
  if(!key){alert('Inserisci una API Key valida.');return;}
  state.owmApiKey=key;
  localStorage.setItem('albertoastro_owm_key',key);
  const m=document.getElementById('msg-weather');
  m.innerText='✅ API Key OWM salvata.';m.className='msg success';
  if(state.weatherMap)updateWeatherLayer();
  fetchWeather();
}

function saveMbKey(){
  const key=document.getElementById('mb-api-key').value.trim();
  if(!key){alert('Inserisci una API Key Meteoblue valida.');return;}
  state.mbApiKey=key;
  localStorage.setItem('albertoastro_mb_key',key);
  const m=document.getElementById('msg-weather');
  m.innerText='✅ API Key Meteoblue salvata. Ricarico i dati...';m.className='msg success';
  fetchAstroWeather();
}

async function fetchWeather(){
  const m=document.getElementById('msg-weather');
  if(!state.owmApiKey){
    m.innerText='⚠️ Inserisci prima la API Key OpenWeatherMap (o ignora questa sezione: il meteo astronomico funziona comunque).';
    m.className='msg';m.style.color='var(--warn)';
    return;
  }
  m.innerText='Caricamento OWM...';m.className='msg';m.style.color='';
  try{
    const url=`https://api.openweathermap.org/data/2.5/forecast?lat=${state.lat}&lon=${state.lon}&appid=${state.owmApiKey}&units=metric&lang=it`;
    const res=await fetch(url,{cache:'no-store'});
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
    centerWeatherMap();
    m.innerText='✅ Meteo OWM aggiornato.';m.className='msg success';m.style.color='';
  }catch(e){
    m.innerText='❌ OWM: '+e.message+' — (vedi comunque la sezione Meteo Astronomico qui sotto)';m.className='msg';m.style.color='var(--bad)';
  }
}

/* ============================================================
   INIT
   ============================================================ */
function initApp(){
  try{
    const now=new Date();
    const off=now.getTimezoneOffset()*60000;
    const iso=new Date(now-off).toISOString().slice(0,16);
    document.getElementById('date').value=iso.split('T')[0];
    document.getElementById('time').value=iso.split('T')[1];
    document.getElementById('lat').value=state.lat.toFixed(4);
    document.getElementById('lon').value=state.lon.toFixed(4);
    const savedLogo=localStorage.getItem('albertoastro_logo');
    if(savedLogo){
      document.getElementById('logoImg').src=savedLogo;
      document.getElementById('logoImg').style.display='block';
      document.getElementById('logoFallback').style.display='none';
    }
    if(state.owmApiKey)document.getElementById('owm-api-key').value=state.owmApiKey;
    if(state.mbApiKey)document.getElementById('mb-api-key').value=state.mbApiKey;
    readInputs();
    renderSunMoon();
    renderSkyQuality();
    renderQuality();
    renderCatalog();
    startWeatherAutoUpdate();
    getLocation().catch(e=>console.warn('init getLocation', e));
    console.log('✅ Alberto Astro caricata. Astronomy:', hasAstro(), 'Leaflet:', typeof L);
    window.__appLoaded = true;
  }catch(e){
    console.error('❌ Init error:', e);
    var b = document.getElementById('js-error-banner');
    if(b){b.style.display='block';b.textContent='❌ Errore inizializzazione: '+e.message;}
  }
}

window.addEventListener('resize', ()=>{
  if(state.weatherMap) setTimeout(()=>state.weatherMap.invalidateSize(), 100);
});

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', initApp);
}else{
  initApp();
}
