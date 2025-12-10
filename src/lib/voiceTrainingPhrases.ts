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
  }
];
