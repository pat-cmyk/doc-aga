// Filipino-English bilingual labels for the Animal Form
// Format: "Filipino / English" for primary display

export const labels = {
  // Animal Type
  animalType: "Uri ng Hayop / Animal Type",
  newEntrant: "Bagong Dating / New Entrant",
  offspring: "Anak / Offspring",
  
  // Livestock Type
  livestockType: "Uri ng Livestock / Livestock Type",
  cattle: "Baka / Cattle",
  goat: "Kambing / Goat",
  sheep: "Tupa / Sheep",
  carabao: "Kalabaw / Carabao",
  
  // Basic Info
  name: "Pangalan / Name",
  earTag: "Tatak sa Tainga / Ear Tag",
  gender: "Kasarian / Gender",
  female: "Babae / Female",
  male: "Lalaki / Male",
  
  // Dates
  birthDate: "Petsa ng Kapanganakan / Birth Date",
  farmEntryDate: "Petsa ng Pagpasok sa Farm / Farm Entry Date",
  unknown: "Hindi Alam / Unknown",
  noData: "Walang Data / No Data",
  
  // Weight
  entryWeight: "Timbang sa Pagpasok / Entry Weight",
  birthWeight: "Timbang sa Kapanganakan / Birth Weight",
  
  // Breed
  breed: "Lahi / Breed",
  mixBreed: "Halong Lahi / Mix Breed",
  firstBreed: "Unang Lahi / First Breed",
  secondBreed: "Ikalawang Lahi / Second Breed",
  
  // Acquisition
  acquisitionQuestion: "Paano nakuha ang hayop? / How was this animal acquired?",
  purchased: "Binili / Purchased",
  grantDonation: "Bigay / Grant or Donation",
  purchasePrice: "Halaga ng Pagbili / Purchase Price",
  grantSource: "Pinagmulan ng Bigay / Grant Source",
  specifySource: "Tukuyin ang Pinagmulan / Specify Source",
  
  // Parent Information
  parentInfo: "Impormasyon ng Magulang / Parent Information",
  mother: "Ina / Mother",
  father: "Ama / Father",
  none: "Wala / None",
  
  // AI
  artificialInsemination: "Artipisyal na Inseminasyon / AI",
  bullSemenBrand: "Brand ng Semen / Bull Semen Brand",
  bullReference: "Pangalan ng Toro / Bull Reference",
  bullBreed: "Lahi ng Toro / Bull Breed",
  
  // Lactation
  currentlyLactating: "Kasalukuyang Nagpapasuso / Currently Lactating",
  daysInMilk: "Araw ng Paggagatas / Days in Milk",
  
  // Actions
  cancel: "Kanselahin / Cancel",
  addAnimal: "Magdagdag ng Hayop / Add Animal",
  addAnother: "Magdagdag Pa / Add Another",
  backToHerd: "Bumalik sa Kawan / Back to Herd",
  showMoreFields: "Ipakita ang Higit Pang Fields / Show More Fields",
  
  // Quick Add
  quickAdd: "Mabilisang Pagdagdag / Quick Add",
  fullDetails: "Buong Detalye / Full Details",
  
  // Success Screen
  success: "Matagumpay / Success",
  animalAdded: "Naidagdag ang Hayop / Animal Added",
  whatNext: "Ano ang susunod? / What's next?",
  recordMilk: "Itala ang Gatas / Record Milk",
  scheduleAI: "Mag-iskedyul ng AI / Schedule AI",
  recordWeight: "Itala ang Timbang / Record Weight",
  addPhoto: "Magdagdag ng Larawan / Add Photo",
  
  // Livestock Emoji Icons
  livestockEmojis: {
    cattle: "🐄",
    goat: "🐐",
    sheep: "🐑",
    carabao: "🐃",
  } as Record<string, string>,
} as const;

// Helper function to get a label by key
export const getLabel = (key: keyof typeof labels): string => {
  const value = labels[key];
  return typeof value === 'string' ? value : '';
};

// Helper to get livestock emoji
export const getLivestockEmoji = (type: string): string => {
  return labels.livestockEmojis[type] || "🐄";
};
