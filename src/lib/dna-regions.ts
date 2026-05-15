// Centroides aproximados de regiones étnicas comunes en tests de ADN.
// Coordenadas [lat, lng]. Si la región no se encuentra, se ignora en el mapa.

export type DnaRegion = { name: string; aliases?: string[]; lat: number; lng: number; radiusKm: number };

export const DNA_REGIONS: DnaRegion[] = [
  // Europa
  { name: "Italia", aliases: ["italian", "italiano"], lat: 42.5, lng: 12.5, radiusKm: 400 },
  { name: "Italia (Liguria)", aliases: ["liguria"], lat: 44.4, lng: 8.95, radiusKm: 80 },
  { name: "Italia (Sur)", aliases: ["southern italy", "sicilia", "sicily"], lat: 38.5, lng: 15.5, radiusKm: 250 },
  { name: "España", aliases: ["spain", "iberian", "iberica"], lat: 40.4, lng: -3.7, radiusKm: 450 },
  { name: "Portugal", aliases: [], lat: 39.5, lng: -8.0, radiusKm: 200 },
  { name: "Francia", aliases: ["france", "frances"], lat: 46.6, lng: 2.2, radiusKm: 400 },
  { name: "Alemania", aliases: ["germany", "german"], lat: 51.2, lng: 10.4, radiusKm: 350 },
  { name: "Reino Unido", aliases: ["england", "british", "scotland", "wales", "uk"], lat: 54.0, lng: -2.5, radiusKm: 400 },
  { name: "Irlanda", aliases: ["ireland", "irish"], lat: 53.4, lng: -8.0, radiusKm: 200 },
  { name: "Escandinavia", aliases: ["scandinavian", "sweden", "norway", "danish"], lat: 60.0, lng: 15.0, radiusKm: 500 },
  { name: "Países Bajos", aliases: ["dutch", "netherlands", "holland"], lat: 52.1, lng: 5.3, radiusKm: 150 },
  { name: "Grecia", aliases: ["greek", "greece"], lat: 39.0, lng: 22.0, radiusKm: 300 },
  { name: "Balcanes", aliases: ["balkan", "serbia", "croatia"], lat: 44.0, lng: 20.0, radiusKm: 400 },
  { name: "Europa del Este", aliases: ["eastern europe", "poland", "polish", "russian", "ukrainian"], lat: 52.0, lng: 25.0, radiusKm: 800 },
  { name: "Judío Asquenazí", aliases: ["ashkenazi", "jewish"], lat: 51.0, lng: 23.0, radiusKm: 600 },
  // África
  { name: "Norte de África", aliases: ["north africa", "magreb", "berber"], lat: 30.0, lng: 5.0, radiusKm: 800 },
  { name: "África Occidental", aliases: ["west africa", "nigeria", "senegal"], lat: 10.0, lng: 0.0, radiusKm: 800 },
  { name: "África Central", aliases: ["bantu", "central africa"], lat: 0.0, lng: 20.0, radiusKm: 700 },
  { name: "África Oriental", aliases: ["east africa", "kenya", "ethiopia"], lat: 0.0, lng: 38.0, radiusKm: 700 },
  // Medio Oriente
  { name: "Medio Oriente", aliases: ["middle east", "arab", "levant"], lat: 31.5, lng: 38.0, radiusKm: 700 },
  { name: "Anatolia / Turquía", aliases: ["anatolia", "turkey", "turkish"], lat: 39.0, lng: 35.0, radiusKm: 500 },
  { name: "Cáucaso", aliases: ["caucasus", "armenian", "georgian"], lat: 42.0, lng: 44.0, radiusKm: 400 },
  // Asia
  { name: "Asia Central", aliases: ["central asia", "kazakh", "uzbek"], lat: 45.0, lng: 65.0, radiusKm: 1000 },
  { name: "Sur de Asia", aliases: ["south asia", "indian", "pakistani"], lat: 22.0, lng: 78.0, radiusKm: 800 },
  { name: "Este de Asia", aliases: ["east asia", "chinese", "japanese", "korean"], lat: 35.0, lng: 110.0, radiusKm: 900 },
  { name: "Sudeste Asiático", aliases: ["southeast asia", "filipino", "vietnamese"], lat: 10.0, lng: 105.0, radiusKm: 800 },
  // Américas
  { name: "Indígena Americano", aliases: ["native american", "amerindio", "indigenous americas"], lat: -10.0, lng: -65.0, radiusKm: 1500 },
  { name: "Indígena Andino", aliases: ["andean", "quechua", "aymara"], lat: -13.5, lng: -72.0, radiusKm: 600 },
  { name: "Indígena Mesoamericano", aliases: ["mesoamerican", "maya", "nahuatl"], lat: 17.0, lng: -92.0, radiusKm: 500 },
  // Oceanía
  { name: "Oceanía", aliases: ["polynesian", "melanesian", "maori"], lat: -15.0, lng: 165.0, radiusKm: 1500 },
];

export function findRegion(name: string): DnaRegion | undefined {
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return DNA_REGIONS.find((r) =>
    n.includes(r.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ||
    (r.aliases ?? []).some((a) => n.includes(a)),
  );
}
