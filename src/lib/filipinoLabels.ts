// English-Filipino bilingual labels for the Animal Form
// Format: { english: "Primary", filipino: "Subtitle" }

export const labels = {
  // Animal Type
  animalType: { english: "Animal Type", filipino: "Uri ng Hayop" },
  newEntrant: { english: "New Entrant", filipino: "Bagong Dating" },
  offspring: { english: "Offspring", filipino: "Anak" },
  
  // Livestock Type
  livestockType: { english: "Livestock Type", filipino: "Uri ng Livestock" },
  cattle: { english: "Cattle", filipino: "Baka" },
  goat: { english: "Goat", filipino: "Kambing" },
  sheep: { english: "Sheep", filipino: "Tupa" },
  carabao: { english: "Carabao", filipino: "Kalabaw" },
  
  // Basic Info
  name: { english: "Name", filipino: "Pangalan" },
  earTag: { english: "Ear Tag", filipino: "Tatak sa Tainga" },
  gender: { english: "Gender", filipino: "Kasarian" },
  female: { english: "Female", filipino: "Babae" },
  male: { english: "Male", filipino: "Lalaki" },
  
  // Dates
  birthDate: { english: "Birth Date", filipino: "Petsa ng Kapanganakan" },
  farmEntryDate: { english: "Farm Entry Date", filipino: "Petsa ng Pagpasok sa Farm" },
  unknown: { english: "Unknown", filipino: "Hindi Alam" },
  noData: { english: "No Data", filipino: "Walang Data" },
  
  // Weight
  entryWeight: { english: "Entry Weight", filipino: "Timbang sa Pagpasok" },
  birthWeight: { english: "Birth Weight", filipino: "Timbang sa Kapanganakan" },
  
  // Breed
  breed: { english: "Breed", filipino: "Lahi" },
  mixBreed: { english: "Mix Breed", filipino: "Halong Lahi" },
  firstBreed: { english: "First Breed", filipino: "Unang Lahi" },
  secondBreed: { english: "Second Breed", filipino: "Ikalawang Lahi" },
  
  // Acquisition
  acquisitionQuestion: { english: "How was this animal acquired?", filipino: "Paano nakuha ang hayop?" },
  purchased: { english: "Purchased", filipino: "Binili" },
  grantDonation: { english: "Grant or Donation", filipino: "Bigay" },
  purchasePrice: { english: "Purchase Price", filipino: "Halaga ng Pagbili" },
  grantSource: { english: "Grant Source", filipino: "Pinagmulan ng Bigay" },
  specifySource: { english: "Specify Source", filipino: "Tukuyin ang Pinagmulan" },
  
  // Parent Information
  parentInfo: { english: "Parent Information", filipino: "Impormasyon ng Magulang" },
  mother: { english: "Mother", filipino: "Ina" },
  father: { english: "Father", filipino: "Ama" },
  none: { english: "None", filipino: "Wala" },
  
  // AI
  artificialInsemination: { english: "Artificial Insemination", filipino: "Artipisyal na Inseminasyon" },
  bullSemenBrand: { english: "Bull Semen Brand", filipino: "Brand ng Semen" },
  bullReference: { english: "Bull Reference", filipino: "Pangalan ng Toro" },
  bullBreed: { english: "Bull Breed", filipino: "Lahi ng Toro" },
  
  // Lactation
  currentlyLactating: { english: "Currently Lactating", filipino: "Kasalukuyang Nagpapasuso" },
  daysInMilk: { english: "Days in Milk", filipino: "Araw ng Paggagatas" },
  
  // Actions
  cancel: { english: "Cancel", filipino: "Kanselahin" },
  addAnimal: { english: "Add Animal", filipino: "Magdagdag ng Hayop" },
  addAnother: { english: "Add Another", filipino: "Magdagdag Pa" },
  backToHerd: { english: "Back to Herd", filipino: "Bumalik sa Kawan" },
  showMoreFields: { english: "Show More Fields", filipino: "Ipakita ang Higit Pang Fields" },
  
  // Quick Add
  quickAdd: { english: "Quick Add", filipino: "Mabilisang Pagdagdag" },
  fullDetails: { english: "Full Details", filipino: "Buong Detalye" },
  
  // Success Screen
  success: { english: "Success!", filipino: "Matagumpay!" },
  animalAdded: { english: "Animal Added", filipino: "Naidagdag ang Hayop" },
  whatNext: { english: "What's next?", filipino: "Ano ang susunod?" },
  recordMilk: { english: "Record First Milk", filipino: "Itala ang Gatas" },
  scheduleAI: { english: "Schedule AI", filipino: "Mag-iskedyul ng AI" },
  recordWeight: { english: "Record Weight", filipino: "Itala ang Timbang" },
  addPhoto: { english: "Add Photo", filipino: "Magdagdag ng Larawan" },
  
  // Livestock Emoji Icons
  livestockEmojis: {
    cattle: "🐄",
    goat: "🐐",
    sheep: "🐑",
    carabao: "🐃",
  } as Record<string, string>,
} as const;

// Helper function to get a label by key
export const getLabel = (key: keyof typeof labels): { english: string; filipino: string } | Record<string, string> => {
  return labels[key];
};

// Helper to get livestock emoji
export const getLivestockEmoji = (type: string): string => {
  return labels.livestockEmojis[type] || "🐄";
};
