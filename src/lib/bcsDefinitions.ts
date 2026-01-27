export interface BCSLevel {
  score: number;
  label: string;
  labelTagalog: string;
  description: string;
  descriptionTagalog: string;
  indicators: string[];
}

export const BCS_LEVELS: BCSLevel[] = [
  {
    score: 1.0,
    label: 'Emaciated',
    labelTagalog: 'Lubhang Payat',
    description: 'Severely underweight, bones very prominent',
    descriptionTagalog: 'Lubhang kulang sa timbang, halatang-halata ang mga buto',
    indicators: [
      'All ribs, spine, hip bones clearly visible',
      'Deep cavity around tailhead',
      'No fat cover at all',
    ],
  },
  {
    score: 2.0,
    label: 'Thin',
    labelTagalog: 'Payat',
    description: 'Underweight, individual ribs visible',
    descriptionTagalog: 'Kulang sa timbang, kitang-kita ang mga tadyang',
    indicators: [
      'Ribs easily seen',
      'Spine and hip bones prominent',
      'Slight depression around tailhead',
    ],
  },
  {
    score: 2.5,
    label: 'Moderately Thin',
    labelTagalog: 'Medyo Payat',
    description: 'Slightly below ideal, last 2-3 ribs visible',
    descriptionTagalog: 'Bahagyang mababa sa ideal, nakikita ang huling 2-3 tadyang',
    indicators: [
      'Last few ribs visible',
      'Spine still visible but less prominent',
      'Minimal fat around tailhead',
    ],
  },
  {
    score: 3.0,
    label: 'Ideal',
    labelTagalog: 'Tamang-tama',
    description: 'Optimal condition for production and health',
    descriptionTagalog: 'Pinakamainam na kondisyon para sa produksyon at kalusugan',
    indicators: [
      'Ribs can be felt but not seen',
      'Smooth appearance, no excess fat',
      'Tailhead covered with slight fat',
    ],
  },
  {
    score: 3.5,
    label: 'Good',
    labelTagalog: 'Maganda',
    description: 'Slightly above ideal, good fat cover',
    descriptionTagalog: 'Bahagyang higit sa ideal, magandang takip ng taba',
    indicators: [
      'Ribs difficult to feel',
      'Smooth, rounded appearance',
      'Fat deposits visible at tailhead',
    ],
  },
  {
    score: 4.0,
    label: 'Overweight',
    labelTagalog: 'Sobrang Timbang',
    description: 'Excess fat, ribs difficult to feel',
    descriptionTagalog: 'Labis na taba, mahirap maramdaman ang mga tadyang',
    indicators: [
      'Cannot feel ribs',
      'Fat folds beginning to appear',
      'Tailhead buried in fat',
    ],
  },
  {
    score: 5.0,
    label: 'Obese',
    labelTagalog: 'Labis na Taba',
    description: 'Severely overweight, mobility may be affected',
    descriptionTagalog: 'Labis na timbang, maaaring maapektuhan ang paggalaw',
    indicators: [
      'Bone structure completely hidden',
      'Large fat deposits everywhere',
      'Brisket and tailhead heavily padded',
    ],
  },
];

export const EXIT_REASONS = [
  { value: 'sold', label: 'Sold', labelTagalog: 'Nabenta' },
  { value: 'died', label: 'Died', labelTagalog: 'Namatay' },
  { value: 'culled', label: 'Culled', labelTagalog: 'Tinanggal sa Kawan' },
  { value: 'transferred', label: 'Transferred', labelTagalog: 'Inilipat' },
  { value: 'slaughtered', label: 'Slaughtered', labelTagalog: 'Kinatay' },
  { value: 'data_error', label: 'Data Entry Error', labelTagalog: 'Mali sa Pagpasok ng Datos' },
];

export const EXIT_DETAILS: Record<string, { value: string; label: string; labelTagalog: string }[]> = {
  died: [
    { value: 'disease', label: 'Disease', labelTagalog: 'Sakit' },
    { value: 'accident', label: 'Accident', labelTagalog: 'Aksidente' },
    { value: 'old_age', label: 'Old Age', labelTagalog: 'Matanda Na' },
    { value: 'birth_complications', label: 'Birth Complications', labelTagalog: 'Komplikasyon sa Panganganak' },
    { value: 'unknown', label: 'Unknown', labelTagalog: 'Hindi Alam' },
  ],
  culled: [
    { value: 'low_production', label: 'Low Production', labelTagalog: 'Mababang Produksyon' },
    { value: 'infertility', label: 'Infertility', labelTagalog: 'Hindi Makaanak' },
    { value: 'chronic_illness', label: 'Chronic Illness', labelTagalog: 'Matagalang Sakit' },
    { value: 'temperament', label: 'Bad Temperament', labelTagalog: 'Masamang Ugali' },
    { value: 'age', label: 'Age', labelTagalog: 'Edad' },
  ],
  sold: [
    { value: 'breeding_stock', label: 'As Breeding Stock', labelTagalog: 'Bilang Panangkan' },
    { value: 'meat', label: 'For Meat', labelTagalog: 'Para sa Karne' },
    { value: 'dairy', label: 'For Dairy', labelTagalog: 'Para sa Gatas' },
  ],
};

export const DETECTION_METHODS = [
  { value: 'visual', label: 'Visual Observation', labelTagalog: 'Nakita' },
  { value: 'mount_detector', label: 'Mount Detector', labelTagalog: 'Mount Detector' },
  { value: 'milk_drop', label: 'Milk Drop', labelTagalog: 'Pagbaba ng Gatas' },
  { value: 'behavior', label: 'Behavior Change', labelTagalog: 'Pagbabago ng Kilos' },
  { value: 'mucus', label: 'Mucus Discharge', labelTagalog: 'Paglabas ng Uhog' },
];

export const HEAT_INTENSITY = [
  { value: 'weak', label: 'Weak', labelTagalog: 'Mahina' },
  { value: 'normal', label: 'Normal', labelTagalog: 'Karaniwan' },
  { value: 'strong', label: 'Strong', labelTagalog: 'Malakas' },
];

export const MILESTONE_TYPES = [
  { value: 'registration', label: 'Registration', labelTagalog: 'Pagpaparehistro' },
  { value: 'first_heat', label: 'First Heat', labelTagalog: 'Unang Init' },
  { value: 'breeding', label: 'Breeding/AI', labelTagalog: 'Pagpapaanak/AI' },
  { value: 'pregnancy_confirmed', label: 'Pregnancy Confirmed', labelTagalog: 'Nakumpirmang Buntis' },
  { value: 'birth', label: 'Gave Birth', labelTagalog: 'Nanganak' },
  { value: 'weaning', label: 'Weaning', labelTagalog: 'Pag-awat sa Pagsuso' },
  { value: 'first_milking', label: 'First Milking', labelTagalog: 'Unang Paggatasan' },
  { value: 'checkup', label: 'Health Checkup', labelTagalog: 'Pagsusuri ng Kalusugan' },
];
