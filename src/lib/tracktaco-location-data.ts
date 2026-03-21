/**
 * Données locales pour l’UI Tracktaco : états US, villes majeures (ordre ≈ plus grande → plus petite),
 * grandes villes par pays (hors US). Sert à l’autocomplétion et aux suggestions si aucun numéro trouvé.
 */

/** Insensible à la casse et aux accents. Si `collapseSeparators`, espaces / tirets / apostrophes sont retirés (ex. « états unis » ≈ « États-Unis »). */
export function normalizeForSearch(s: string, collapseSeparators = false): string {
  let out = s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
  if (collapseSeparators) {
    out = out.replace(/[\s'’-]+/g, '');
  }
  return out;
}

export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'Californie' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District de Columbia' },
  { code: 'FL', name: 'Floride' },
  { code: 'GA', name: 'Géorgie' },
  { code: 'HI', name: 'Hawaï' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiane' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'Nouveau-Mexique' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'Caroline du Nord' },
  { code: 'ND', name: 'Dakota du Nord' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvanie' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'Caroline du Sud' },
  { code: 'SD', name: 'Dakota du Sud' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginie' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'Virginie-Occidentale' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

/** Villes représentatives par état (les premières = généralement plus peuplées / mieux couvertes) */
export const US_STATE_MAJOR_CITIES: Record<string, string[]> = {
  AL: ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale'],
  AR: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'],
  CA: ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Oakland', 'Long Beach'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood'],
  CT: ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury'],
  DE: ['Wilmington', 'Dover', 'Newark'],
  DC: ['Washington'],
  FL: ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Fort Lauderdale', 'Tallahassee'],
  GA: ['Atlanta', 'Columbus', 'Augusta', 'Savannah', 'Athens', 'Macon'],
  HI: ['Honolulu', 'Hilo', 'Kailua'],
  ID: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City'],
  KS: ['Wichita', 'Overland Park', 'Kansas City', 'Topeka', 'Olathe'],
  KY: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette'],
  ME: ['Portland', 'Lewiston', 'Bangor'],
  MD: ['Baltimore', 'Columbia', 'Germantown', 'Silver Spring'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'],
  MI: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor'],
  MN: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington'],
  MS: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg'],
  MO: ['Kansas City', 'Saint Louis', 'Springfield', 'Columbia', 'Independence'],
  MT: ['Billings', 'Missoula', 'Great Falls', 'Bozeman'],
  NE: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas'],
  NH: ['Manchester', 'Nashua', 'Concord'],
  NJ: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison'],
  NM: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'],
  NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Asheville'],
  ND: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow'],
  OR: ['Portland', 'Salem', 'Eugene', 'Gresham'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading'],
  RI: ['Providence', 'Warwick', 'Cranston'],
  SC: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Greenville'],
  SD: ['Sioux Falls', 'Rapid City', 'Aberdeen'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
  TX: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington'],
  UT: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan'],
  VT: ['Burlington', 'South Burlington', 'Rutland'],
  VA: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Arlington', 'Alexandria'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'],
  WV: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg'],
  WI: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'],
  WY: ['Cheyenne', 'Casper', 'Laramie', 'Gillette'],
};

/** Grandes villes par pays (ISO2) — autocomplétion & suggestions hors US */
export const COUNTRY_MAJOR_CITIES: Record<string, string[]> = {
  FR: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille'],
  GB: ['London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol', 'Cardiff', 'Belfast'],
  DE: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig'],
  ES: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Bilbao'],
  IT: ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence'],
  CA: ['Toronto', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Vancouver', 'Winnipeg', 'Quebec City'],
  AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra'],
  BR: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Curitiba'],
  MX: ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León'],
  IN: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune'],
  JP: ['Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe'],
  CN: ['Shanghai', 'Beijing', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan'],
  NL: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'],
  BE: ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège'],
  CH: ['Zurich', 'Geneva', 'Basel', 'Lausanne', 'Bern'],
  AT: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck'],
  PT: ['Lisbon', 'Porto', 'Braga', 'Coimbra'],
  PL: ['Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk'],
  SE: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala'],
  NO: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'],
  IE: ['Dublin', 'Cork', 'Limerick', 'Galway'],
  NZ: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton'],
  SG: ['Singapore'],
  KR: ['Seoul', 'Busan', 'Incheon', 'Daegu'],
  AE: ['Dubai', 'Abu Dhabi', 'Sharjah'],
  SA: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam'],
  ZA: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria'],
  AR: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza'],
  CL: ['Santiago', 'Valparaíso', 'Concepción'],
  CO: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'],
  EG: ['Cairo', 'Alexandria', 'Giza'],
  MA: ['Casablanca', 'Rabat', 'Marrakesh', 'Fes'],
  NG: ['Lagos', 'Abuja', 'Kano', 'Ibadan'],
  TR: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya'],
  UA: ['Kyiv', 'Kharkiv', 'Odesa', 'Dnipro', 'Lviv'],
  RO: ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași'],
  CZ: ['Prague', 'Brno', 'Ostrava'],
  GR: ['Athens', 'Thessaloniki', 'Patras'],
  HU: ['Budapest', 'Debrecen', 'Szeged'],
  FI: ['Helsinki', 'Espoo', 'Tampere', 'Oulu'],
  DK: ['Copenhagen', 'Aarhus', 'Odense'],
  LU: ['Luxembourg'],
  MT: ['Valletta'],
  CY: ['Nicosia', 'Limassol'],
  IS: ['Reykjavík'],
  HR: ['Zagreb', 'Split', 'Rijeka'],
  RS: ['Belgrade', 'Novi Sad'],
  SK: ['Bratislava', 'Košice'],
  SI: ['Ljubljana'],
  LT: ['Vilnius', 'Kaunas'],
  LV: ['Riga'],
  EE: ['Tallinn'],
  BG: ['Sofia', 'Plovdiv', 'Varna'],
  TH: ['Bangkok', 'Chiang Mai', 'Pattaya'],
  VN: ['Ho Chi Minh City', 'Hanoi', 'Da Nang'],
  MY: ['Kuala Lumpur', 'George Town', 'Johor Bahru'],
  PH: ['Manila', 'Quezon City', 'Davao', 'Cebu'],
  ID: ['Jakarta', 'Surabaya', 'Bandung', 'Medan'],
  PK: ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad'],
  BD: ['Dhaka', 'Chittagong'],
  IL: ['Tel Aviv', 'Jerusalem', 'Haifa'],
};

export function filterUSStates(query: string, limit = 12): { code: string; name: string }[] {
  const raw = query.trim();
  if (!raw) return US_STATES.slice(0, limit);
  const q = normalizeForSearch(raw, true);
  const qCode = raw.toLowerCase();
  return US_STATES.filter((s) => {
    const nameN = normalizeForSearch(s.name, true);
    const codeL = s.code.toLowerCase();
    return nameN.includes(q) || codeL.includes(qCode);
  }).slice(0, limit);
}

export function getUSStateName(code: string): string | undefined {
  return US_STATES.find((s) => s.code === code)?.name;
}

export function filterCitySuggestions(
  countryCode: string,
  stateCode: string | null,
  query: string,
  limit = 12
): string[] {
  const raw = query.trim();
  let pool: string[] = [];
  if (countryCode === 'US' && stateCode) {
    pool = US_STATE_MAJOR_CITIES[stateCode.toUpperCase()] ?? [];
  } else {
    pool = COUNTRY_MAJOR_CITIES[countryCode.toUpperCase()] ?? [];
  }
  if (!raw) return pool.slice(0, limit);
  const q = normalizeForSearch(raw, true);
  return pool.filter((c) => normalizeForSearch(c, true).includes(q)).slice(0, limit);
}

/** Villes à proposer après NO_TN_FOUND (exclut la ville déjà essayée, ordre = plus grandes en premier) */
export function suggestAlternativeCities(
  countryCode: string,
  stateCode: string | null,
  triedCity: string,
  max = 5
): string[] {
  const tried = triedCity.trim().toLowerCase();
  let pool: string[] = [];
  if (countryCode === 'US' && stateCode) {
    pool = [...(US_STATE_MAJOR_CITIES[stateCode.toUpperCase()] ?? [])];
  } else {
    pool = [...(COUNTRY_MAJOR_CITIES[countryCode.toUpperCase()] ?? [])];
  }
  const filtered = pool.filter((c) => c.toLowerCase() !== tried);
  return filtered.slice(0, max);
}
