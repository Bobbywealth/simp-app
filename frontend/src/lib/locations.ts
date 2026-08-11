// Country + state/province data for the profile setup picker.
// Curated, alphabetized, and grouped by popularity for the most common regions.

export interface CountryOption {
  code: string; // ISO-3166-1 alpha-2
  name: string;
  states?: string[]; // optional region list; if absent, falls back to free-text
}

export const COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States', states: [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
    'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
    'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
    'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
    'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
    'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
    'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
    'District of Columbia','Puerto Rico',
  ]},
  { code: 'CA', name: 'Canada', states: [
    'Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador',
    'Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island',
    'Quebec','Saskatchewan','Yukon',
  ]},
  { code: 'GB', name: 'United Kingdom', states: [
    'England','Scotland','Wales','Northern Ireland',
    'London','Manchester','Birmingham','Liverpool','Bristol','Leeds','Edinburgh','Glasgow',
    'Cardiff','Belfast','Newcastle','Sheffield','Nottingham','Brighton','Cambridge','Oxford',
  ]},
  { code: 'AU', name: 'Australia', states: [
    'New South Wales','Victoria','Queensland','Western Australia','South Australia',
    'Tasmania','Australian Capital Territory','Northern Territory',
  ]},
  { code: 'NZ', name: 'New Zealand', states: [
    'Auckland','Wellington','Canterbury','Waikato','Bay of Plenty','Otago','Manawatu-Whanganui',
    'Hawke\u2019s Bay','Northland','Taranaki','Southland','Nelson','Marlborough','Tasman',
    'West Coast','Gisborne',
  ]},
  { code: 'IE', name: 'Ireland', states: ['Dublin','Cork','Limerick','Galway','Waterford','Kilkenny','Wexford']},
  { code: 'MX', name: 'Mexico', states: [
    'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
    'Coahuila','Colima','Durango','Guanajuato','Guerrero','Hidalgo','Jalisco','Mexico City',
    'Michoac\u00e1n','Morelos','Nayarit','Nuevo Le\u00f3n','Oaxaca','Puebla','Quer\u00e9taro',
    'Quintana Roo','San Luis Potos\u00ed','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
    'Veracruz','Yucat\u00e1n','Zacatecas',
  ]},
  { code: 'BR', name: 'Brazil', states: [
    'Acre','Alagoas','Amap\u00e1','Amazonas','Bahia','Cear\u00e1','Distrito Federal',
    'Esp\u00edrito Santo','Goi\u00e1s','Maranh\u00e3o','Mato Grosso','Mato Grosso do Sul',
    'Minas Gerais','Par\u00e1','Para\u00edba','Paran\u00e1','Pernambuco','Piau\u00ed',
    'Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rond\u00f4nia','Roraima',
    'Santa Catarina','S\u00e3o Paulo','Sergipe','Tocantins',
  ]},
  { code: 'AR', name: 'Argentina', states: [
    'Buenos Aires','CABA','Catamarca','Chaco','Chubut','C\u00f3rdoba','Corrientes','Entre R\u00edos',
    'Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuqu\u00e9n','R\u00edo Negro',
    'Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucum\u00e1n',
  ]},
  { code: 'CL', name: 'Chile', states: [
    'Arica y Parinacota','Tarapac\u00e1','Antofagasta','Atacama','Coquimbo','Valpara\u00edso',
    'Metropolitana de Santiago','O\u2019Higgins','Maule','\u00d1uble','Biob\u00edo','Araucan\u00eda',
    'Los R\u00edos','Los Lagos','Ays\u00e9n','Magallanes',
  ]},
  { code: 'CO', name: 'Colombia', states: [
    'Bogot\u00e1 D.C.','Antioquia','Valle del Cauca','Atl\u00e1ntico','Bol\u00edvar','Boyac\u00e1',
    'Caldas','Caquet\u00e1','Cauca','Cesar','C\u00f3rdoba','Cundinamarca','Huila','La Guajira',
    'Magdalena','Meta','Nari\u00f1o','Norte de Santander','Quind\u00edo','Risaralda','Santander',
    'Sucre','Tolima','Arauca','Casanare','Putumayo','San Andr\u00e9s y Providencia','Amazonas','Guain\u00eda','Guaviare','Vaup\u00e9s','Vichada',
  ]},
  { code: 'PE', name: 'Peru', states: ['Lima','Arequipa','La Libertad','Piura','Callao','Cusco','Lambayeque']},
  { code: 'FR', name: 'France', states: [
    '\u00cele-de-France','Provence-Alpes-C\u00f4te d\u2019Azur','Auvergne-Rh\u00f4ne-Alpes',
    'Hauts-de-France','Nouvelle-Aquitaine','Occitanie','Grand Est','Pays de la Loire',
    'Bretagne','Normandie','Bourgogne-Franche-Comt\u00e9','Centre-Val de Loire','Corse',
  ]},
  { code: 'DE', name: 'Germany', states: [
    'Baden-W\u00fcrttemberg','Bavaria','Berlin','Brandenburg','Bremen','Hamburg','Hesse',
    'Lower Saxony','Mecklenburg-Vorpommern','North Rhine-Westphalia','Rhineland-Palatinate',
    'Saarland','Saxony','Saxony-Anhalt','Schleswig-Holstein','Thuringia',
  ]},
  { code: 'ES', name: 'Spain', states: [
    'Andalusia','Aragon','Asturias','Balearic Islands','Basque Country','Canary Islands',
    'Cantabria','Castile and Le\u00f3n','Castile-La Mancha','Catalonia','Extremadura','Galicia',
    'La Rioja','Madrid','Murcia','Navarre','Valencia','Ceuta','Melilla',
  ]},
  { code: 'IT', name: 'Italy', states: [
    'Lombardy','Lazio','Campania','Sicily','Veneto','Piedmont','Emilia-Romagna','Tuscany',
    'Puglia','Calabria','Sardinia','Liguria','Marche','Abruzzo','Friuli Venezia Giulia',
    'Trentino-Alto Adige','Umbria','Basilicata','Molise','Valle d\u2019Aosta',
  ]},
  { code: 'NL', name: 'Netherlands', states: [
    'Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','North Brabant',
    'North Holland','Overijssel','South Holland','Utrecht','Zeeland',
  ]},
  { code: 'BE', name: 'Belgium', states: ['Brussels','Flanders','Wallonia']},
  { code: 'CH', name: 'Switzerland', states: [
    'Zurich','Geneva','Basel','Bern','Lausanne','Lucerne','St. Gallen','Lugano','Winterthur',
  ]},
  { code: 'AT', name: 'Austria', states: [
    'Vienna','Salzburg','Innsbruck','Graz','Linz','Carinthia','Styria','Tyrol','Vorarlberg','Upper Austria',
  ]},
  { code: 'SE', name: 'Sweden', states: ['Stockholm','Gothenburg','Malm\u00f6','Uppsala','V\u00e4ster\u00e5s']},
  { code: 'NO', name: 'Norway', states: ['Oslo','Bergen','Stavanger','Trondheim','Drammen']},
  { code: 'DK', name: 'Denmark', states: ['Copenhagen','Aarhus','Odense','Aalborg']},
  { code: 'FI', name: 'Finland', states: ['Helsinki','Espoo','Tampere','Vantaa','Oulu','Turku']},
  { code: 'PL', name: 'Poland', states: [
    'Masovian','Lesser Poland','Greater Poland','Silesian','Lower Silesian','\u0141\u00f3d\u017a',
    'West Pomeranian','Pomeranian','Lublin','Kuyavian-Pomeranian',
  ]},
  { code: 'PT', name: 'Portugal', states: ['Lisbon','Porto','Faro','Coimbra','Braga','Funchal']},
  { code: 'GR', name: 'Greece', states: ['Athens','Thessaloniki','Patras','Heraklion','Larissa']},
  { code: 'CZ', name: 'Czech Republic', states: ['Prague','Brno','Ostrava','Plze\u0148','Liberec']},
  { code: 'HU', name: 'Hungary', states: ['Budapest','Debrecen','Szeged','P\u00e9cs','Gy\u0151r']},
  { code: 'RO', name: 'Romania', states: ['Bucharest','Cluj-Napoca','Timi\u0219oara','Ia\u0219i','Constan\u021ba']},
  { code: 'TR', name: 'Turkey', states: ['Istanbul','Ankara','Izmir','Antalya','Bursa','Adana']},
  { code: 'RU', name: 'Russia', states: ['Moscow','Saint Petersburg','Novosibirsk','Yekaterinburg','Kazan']},
  { code: 'UA', name: 'Ukraine', states: ['Kyiv','Kharkiv','Odesa','Dnipro','Lviv','Zaporizhzhia']},
  { code: 'IL', name: 'Israel', states: ['Tel Aviv','Jerusalem','Haifa','Rishon LeZion','Petah Tikva']},
  { code: 'AE', name: 'United Arab Emirates', states: ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah']},
  { code: 'SA', name: 'Saudi Arabia', states: ['Riyadh','Jeddah','Mecca','Medina','Dammam','Khobar']},
  { code: 'EG', name: 'Egypt', states: ['Cairo','Alexandria','Giza','Sharm El Sheikh','Luxor']},
  { code: 'ZA', name: 'South Africa', states: [
    'Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Limpopo','Mpumalanga',
    'North West','Free State','Northern Cape',
  ]},
  { code: 'NG', name: 'Nigeria', states: ['Lagos','Abuja','Kano','Ibadan','Port Harcourt','Benin City']},
  { code: 'KE', name: 'Kenya', states: ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret']},
  { code: 'MA', name: 'Morocco', states: ['Casablanca','Rabat','Marrakech','Fes','Tangier']},
  { code: 'GH', name: 'Ghana', states: ['Accra','Kumasi','Tamale','Sekondi-Takoradi']},
  { code: 'IN', name: 'India', states: [
    'Maharashtra','Karnataka','Tamil Nadu','Delhi','Telangana','West Bengal','Gujarat',
    'Uttar Pradesh','Rajasthan','Kerala','Punjab','Haryana','Madhya Pradesh','Bihar',
    'Odisha','Assam','Jharkhand','Chhattisgarh','Uttarakhand','Himachal Pradesh','Goa',
  ]},
  { code: 'PK', name: 'Pakistan', states: ['Sindh','Punjab','Khyber Pakhtunkhwa','Balochistan','Islamabad']},
  { code: 'BD', name: 'Bangladesh', states: ['Dhaka','Chittagong','Khulna','Rajshahi','Sylhet']},
  { code: 'LK', name: 'Sri Lanka', states: ['Western','Central','Southern','Northern','Eastern','North Western']},
  { code: 'NP', name: 'Nepal', states: ['Bagmati','Gandaki','Lumbini','Karnali','Sudurpashchim']},
  { code: 'CN', name: 'China', states: [
    'Beijing','Shanghai','Guangdong','Shenzhen','Zhejiang','Jiangsu','Sichuan','Hubei','Fujian',
    'Hong Kong','Macau',
  ]},
  { code: 'HK', name: 'Hong Kong', states: ['Central and Western','Wan Chai','Eastern','Southern','Yau Tsim Mong','Sham Shui Po','Kowloon City','Kwun Tong','Tsuen Wan','Tuen Mun','Yuen Long','Islands','Kwai Tsing','North','Tai Po','Sai Kung']},
  { code: 'TW', name: 'Taiwan', states: ['Taipei','Kaohsiung','Taichung','Tainan','Hsinchu']},
  { code: 'JP', name: 'Japan', states: [
    'Tokyo','Osaka','Kyoto','Yokohama','Nagoya','Sapporo','Fukuoka','Kobe','Hiroshima','Sendai',
  ]},
  { code: 'KR', name: 'South Korea', states: ['Seoul','Busan','Incheon','Daegu','Daejeon','Gwangju','Suwon','Ulsan']},
  { code: 'SG', name: 'Singapore', states: ['Central','East','North','North-East','West']},
  { code: 'MY', name: 'Malaysia', states: ['Kuala Lumpur','Selangor','Johor','Penang','Sabah','Sarawak']},
  { code: 'TH', name: 'Thailand', states: ['Bangkok','Chiang Mai','Phuket','Pattaya','Khon Kaen']},
  { code: 'VN', name: 'Vietnam', states: ['Hanoi','Ho Chi Minh City','Da Nang','Hai Phong','Can Tho']},
  { code: 'PH', name: 'Philippines', states: ['Metro Manila','Cebu','Davao','Quezon City','Caloocan']},
  { code: 'ID', name: 'Indonesia', states: ['Jakarta','Surabaya','Bandung','Medan','Bali','Yogyakarta']},
  { code: 'TW', name: 'Taiwan', states: ['Taipei','New Taipei','Taoyuan','Taichung','Tainan','Kaohsiung']},
  // Final fallback countries without subdivisions
  { code: 'OTHER', name: 'Other / Not listed' },
];

export function getCountry(code: string | null | undefined): CountryOption | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code);
}

export function getStates(countryCode: string | null | undefined): string[] {
  const c = getCountry(countryCode);
  return c?.states ?? [];
}
