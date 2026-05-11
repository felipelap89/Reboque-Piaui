const ORS = "https://api.openrouteservice.org";
const LOCAL_HINT = ", São Luís - MA";

function withLocalHint(text: string) {
  const hasCityOrState = /\b(s[aã]o\s*lu[ií]s|teresina|timon|maranh[aã]o|piau[ií]|\bma\b|\bpi\b|\bms\b|mato\s+grosso)\b/i.test(text);
  return hasCityOrState ? text : `${text}${LOCAL_HINT}`;
}

async function geocode(text: string, key: string): Promise<[number, number]> {
  const url = `${ORS}/geocode/search?api_key=${encodeURIComponent(key)}&text=${encodeURIComponent(withLocalHint(text))}&boundary.country=BR&focus.point.lat=-2.54036&focus.point.lon=-44.22875&size=1`;
  const r = await fetch(url);
  const j: any = await r.json();
  if (!r.ok) throw new Error(`Geocode falhou (${r.status}): ${JSON.stringify(j)}`);
  const f = j?.features?.[0];
  if (!f) throw new Error(`Endereço não encontrado: "${text}"`);
  const [lon, lat] = f.geometry.coordinates;
  return [lon, lat];
}

// Base fixa de operação — motorista sai daqui, vai até origem, leva até destino e retorna.
const BASE = "Av Brasil, 10, Vicente Fialho, São Luís - MA";

export async function calculateRouteDistance(origem: string, destino: string, key: string) {
  const [base, a, b] = await Promise.all([
    geocode(BASE, key),
    geocode(origem, key),
    geocode(destino, key),
  ]);

  const r = await fetch(`${ORS}/v2/directions/driving-car`, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [base, a, b, base] }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(`Rota falhou (${r.status}): ${JSON.stringify(j)}`);

  const summary = j?.routes?.[0]?.summary;
  if (!summary) throw new Error("Sem rota retornada");

  return {
    km: Math.round((summary.distance / 1000) * 10) / 10,
    durationMin: Math.round(summary.duration / 60),
  };
}