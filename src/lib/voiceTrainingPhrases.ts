export interface TrainingPhrase {
  id: string;
  text: string;
  language: 'english' | 'tagalog' | 'taglish';
  category: string;
}

export const TRAINING_PHRASES: TrainingPhrase[] = [
  // English phrases
  {
    id: 'en-1',
    text: 'The cow is milking well today',
    language: 'english',
    category: 'daily-activities'
  },
  {
    id: 'en-2',
    text: 'Record weight of 450 kilograms',
    language: 'english',
    category: 'measurements'
  },
  {
    id: 'en-3',
    text: 'Animal needs vaccination',
    language: 'english',
    category: 'health'
  },
  {
    id: 'en-4',
    text: 'The calf was born this morning',
    language: 'english',
    category: 'breeding'
  },
  {
    id: 'en-5',
    text: 'Feeds are running low',
    language: 'english',
    category: 'feed'
  },
  {
    id: 'en-6',
    text: 'Schedule artificial insemination for next week',
    language: 'english',
    category: 'breeding'
  },
  {
    id: 'en-7',
    text: 'Check the milk production records',
    language: 'english',
    category: 'records'
  },
  {
    id: 'en-8',
    text: 'The animal is showing signs of illness',
    language: 'english',
    category: 'health'
  },
  
  // Tagalog phrases
  {
    id: 'tl-1',
    text: 'Ang baka ay kailangan ng gamot',
    language: 'tagalog',
    category: 'health'
  },
  {
    id: 'tl-2',
    text: 'Itala ang timbang ng hayop',
    language: 'tagalog',
    category: 'measurements'
  },
  {
    id: 'tl-3',
    text: 'Magpasuso ng gatas ngayong umaga',
    language: 'tagalog',
    category: 'daily-activities'
  },
  {
    id: 'tl-4',
    text: 'Nanganak ang baka kahapon',
    language: 'tagalog',
    category: 'breeding'
  },
  {
    id: 'tl-5',
    text: 'Kulang na ang pagkain ng mga hayop',
    language: 'tagalog',
    category: 'feed'
  },
  {
    id: 'tl-6',
    text: 'Kailangan ng bakuna ang mga guya',
    language: 'tagalog',
    category: 'health'
  },
  {
    id: 'tl-7',
    text: 'Tingnan ang rekord ng gatas',
    language: 'tagalog',
    category: 'records'
  },
  {
    id: 'tl-8',
    text: 'May sakit ang hayop na ito',
    language: 'tagalog',
    category: 'health'
  },

  // Taglish phrases (code-switching - mixed Tagalog and English)
  {
    id: 'tgl-1',
    text: 'Nag-feed ako ng 10 bales of hay this morning',
    language: 'taglish',
    category: 'daily-activities'
  },
  {
    id: 'tgl-2',
    text: 'Check mo yung weight ng guya, parang underweight',
    language: 'taglish',
    category: 'measurements'
  },
  {
    id: 'tgl-3',
    text: 'Nag-milk ako ng around 20 liters today',
    language: 'taglish',
    category: 'daily-activities'
  },
  {
    id: 'tgl-4',
    text: 'Yung baka is ready for AI na siguro',
    language: 'taglish',
    category: 'breeding'
  },
  {
    id: 'tgl-5',
    text: 'Need natin mag-order ng more concentrates',
    language: 'taglish',
    category: 'feed'
  },
  {
    id: 'tgl-6',
    text: 'Tinurukan ko na ng antibiotics yung may lagnat',
    language: 'taglish',
    category: 'health'
  },
  {
    id: 'tgl-7',
    text: 'Record mo yung milk production for this week',
    language: 'taglish',
    category: 'records'
  },
  {
    id: 'tgl-8',
    text: 'Parang may problema sa appetite ng baka natin',
    language: 'taglish',
    category: 'health'
  },
  {
    id: 'tgl-9',
    text: 'Pinakain ko sila ng 5 bags of darak kanina',
    language: 'taglish',
    category: 'feed'
  },
  {
    id: 'tgl-10',
    text: 'I-schedule natin ang deworming next month',
    language: 'taglish',
    category: 'health'
  },

  // Taglish - Weighing/Measurements
  {
    id: 'tgl-11',
    text: 'Nag-weigh ako sa toro, mga 480 kilos siya ngayon',
    language: 'taglish',
    category: 'measurements'
  },
  {
    id: 'tgl-12',
    text: 'Record mo yung weight ng guya, tumaas na siya ng 15 kilos',
    language: 'taglish',
    category: 'measurements'
  },
  {
    id: 'tgl-13',
    text: 'Parang bumaba ang body condition ng pregnant cow natin',
    language: 'taglish',
    category: 'measurements'
  },
  {
    id: 'tgl-14',
    text: 'I-check natin kung normal ang weight gain ng mga calves',
    language: 'taglish',
    category: 'measurements'
  },

  // Taglish - Health Observations
  {
    id: 'tgl-15',
    text: 'Napansin ko may discharge yung isa nating baka, baka may infection',
    language: 'taglish',
    category: 'health'
  },
  {
    id: 'tgl-16',
    text: 'Yung goat natin pilay, parang na-sprain yung leg',
    language: 'taglish',
    category: 'health'
  },
  {
    id: 'tgl-17',
    text: 'Medyo malungkot yung eyes ng carabao, baka may sakit',
    language: 'taglish',
    category: 'health'
  },
  {
    id: 'tgl-18',
    text: 'May namaga sa udder ng cow, possible mastitis ba ito?',
    language: 'taglish',
    category: 'health'
  },
  {
    id: 'tgl-19',
    text: 'Nag-inject ako ng vitamins sa mga bagong panganak',
    language: 'taglish',
    category: 'health'
  },

  // Taglish - Breeding/Scheduling
  {
    id: 'tgl-20',
    text: 'Nag-heat na yung heifer natin, ready for breeding',
    language: 'taglish',
    category: 'breeding'
  },
  {
    id: 'tgl-21',
    text: 'I-schedule natin ang AI sa Thursday, confirmed na yung heat',
    language: 'taglish',
    category: 'breeding'
  },
  {
    id: 'tgl-22',
    text: 'Pregnant na yung baka, mga three months na siguro',
    language: 'taglish',
    category: 'breeding'
  },
  {
    id: 'tgl-23',
    text: 'Expected delivery ng cow natin is next month na',
    language: 'taglish',
    category: 'breeding'
  },
  {
    id: 'tgl-24',
    text: 'Nanganak na yung goat natin, dalawa ang kida',
    language: 'taglish',
    category: 'breeding'
  },

  // Taglish - Sales/Exit
  {
    id: 'tgl-25',
    text: 'Nabenta ko yung isa nating toro, 85,000 pesos',
    language: 'taglish',
    category: 'sales'
  },
  {
    id: 'tgl-26',
    text: 'Record mo yung sale ng calf kahapon',
    language: 'taglish',
    category: 'sales'
  },
  {
    id: 'tgl-27',
    text: 'Namatay yung guya natin, parang dahil sa diarrhea',
    language: 'taglish',
    category: 'exit'
  },

  // Taglish - Vaccination/Preventive
  {
    id: 'tgl-28',
    text: 'Na-vaccine na natin lahat ng cattle for FMD',
    language: 'taglish',
    category: 'health'
  },
  {
    id: 'tgl-29',
    text: 'Kailangan na mag-deworm ulit, past due na yung schedule',
    language: 'taglish',
    category: 'health'
  },
  {
    id: 'tgl-30',
    text: 'Kumpleto na ang vaccination ng mga goats natin',
    language: 'taglish',
    category: 'health'
  }
];
