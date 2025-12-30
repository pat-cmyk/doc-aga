// Filipino Animal Name Generator
// A witty, culturally appropriate, family-friendly name generator

const classicNames = [
  "Juan", "Maria", "Nene", "Totoy", "Inday", "Dodong", "Charing", 
  "Pedro", "Jose", "Rosa", "Luz", "Nena", "Lito", "Mila", "Celia",
  "Berto", "Dante", "Flora", "Gloria", "Imelda", "Josefa", "Leonora"
];

const titles = [
  "Mang", "Aling", "Kuya", "Ate", "Lolo", "Lola", "Tito", "Tita"
];

const endearmentNames = [
  "Mahal", "Ganda", "Pogi", "Mabait", "Sinta", "Irog", "Pangga", 
  "Palangga", "Bebe", "Beshie", "Bhie", "Siz", "Mamshie", "Paps"
];

const foodNames = [
  "Adobo", "Sinigang", "Kare-Kare", "Lechon", "Bibingka", "Puto", 
  "Kutsinta", "Tinola", "Sisig", "Longganisa", "Tapa", "Tocino", 
  "Champorado", "Bulalo", "Kaldereta", "Turon", "Halo-Halo",
  "Lumpia", "Pancit", "Leche-Flan", "Balut", "Isaw", "Kwek-Kwek"
];

const natureNames = [
  "Ulan", "Hangin", "Tala", "Bituin", "Bagyo", "Araw", "Buwan", 
  "Ulap", "Kidlat", "Kulog", "Sampaguita", "Gumamela", "Rosal",
  "Dahon", "Bulaklak", "Tubig", "Apoy", "Lupa", "Bundok", "Dagat"
];

const personalityNames = [
  "Malakas", "Matapang", "Masipag", "Mahinhin", "Makulit", "Matigas", 
  "Makisig", "Maganda", "Mabilis", "Matalino", "Mataba", "Payat",
  "Mabango", "Malambing", "Maliksi", "Malapad", "Malaki", "Maliit"
];

const colorNames = [
  "Puti", "Itim", "Pula", "Berde", "Dilaw", "Kayumanggi", "Abo",
  "Kahel", "Rosas", "Lila", "Asul", "Ginto", "Pilak", "Kulay-Kape"
];

const popCultureNames = [
  "Darna", "Panday", "Enteng", "Flavio", "Dyesebel", "Cardo", 
  "Bong", "Kiko", "Pacquiao", "Vice", "Angge", "Isko", "Sarah"
];

const heroicNames = [
  "Lakambini", "Datu", "Lakandula", "Lapu-Lapu", "Kalayaan", 
  "Rajah", "Bayani", "Magiting", "Marangal", "Dakila", "Bantay"
];

const funnyNames = [
  "Bongga", "Chaka", "Jollibee", "McDo", "Shawarma", "Siomai",
  "Fishball", "Kikiam", "Barbecue", "Lecheng", "Wagas", "Petmalu",
  "Lodi", "Werpa", "Mumshie", "Accla", "Charot", "Sana-All"
];

// Livestock-specific witty names
const cattleNames = [
  "Bulalo", "Kilawin", "Kaldereta", "Bistek", "Mechado", "Morcon",
  "Bakang-Ganda", "Batang-Baka", "Karne-Norte", "T-Bone"
];

const carabaoNames = [
  "Lakambini", "Kalabaw-King", "Muddy", "Palayan", "Araro", "Bukid",
  "Magsasaka", "Palay", "Halaman", "Taniman", "Kariton"
];

const goatNames = [
  "Kalderetang", "Papaitan", "Kilawin-Kambing", "Kanding", "Tsibato",
  "Meh-Meh", "Bulak", "Muntik", "Talon-Talon", "Kable"
];

const sheepNames = [
  "Bulbol-Bulbol", "Malambot", "Kupas", "Fluffy-Tupa", "Kordero",
  "Balahibo", "Woolly", "Maputi", "Makapal", "Lambing"
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function shouldCombine(): boolean {
  return Math.random() < 0.3; // 30% chance to combine with title
}

export function generateFilipinoAnimalName(livestockType?: string): string {
  // Weighted categories - some appear more often
  const categories = [
    { names: classicNames, weight: 20 },
    { names: foodNames, weight: 25 },
    { names: natureNames, weight: 15 },
    { names: personalityNames, weight: 10 },
    { names: colorNames, weight: 8 },
    { names: popCultureNames, weight: 7 },
    { names: heroicNames, weight: 5 },
    { names: funnyNames, weight: 10 },
  ];

  // Add livestock-specific names with high weight if type is provided
  if (livestockType) {
    switch (livestockType.toLowerCase()) {
      case 'cattle':
        categories.push({ names: cattleNames, weight: 20 });
        break;
      case 'carabao':
        categories.push({ names: carabaoNames, weight: 20 });
        break;
      case 'goat':
        categories.push({ names: goatNames, weight: 20 });
        break;
      case 'sheep':
        categories.push({ names: sheepNames, weight: 20 });
        break;
    }
  }

  // Calculate total weight
  const totalWeight = categories.reduce((sum, cat) => sum + cat.weight, 0);
  
  // Pick a random category based on weight
  let random = Math.random() * totalWeight;
  let selectedCategory = categories[0].names;
  
  for (const category of categories) {
    random -= category.weight;
    if (random <= 0) {
      selectedCategory = category.names;
      break;
    }
  }

  const baseName = getRandomItem(selectedCategory);

  // Sometimes combine with a title for extra personality
  if (shouldCombine() && !baseName.includes("-")) {
    const title = getRandomItem(titles);
    return `${title} ${baseName}`;
  }

  return baseName;
}
