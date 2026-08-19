/**
 * Malaysian Buyer Race / Ethnicity AI Pattern Helper
 * Analyzes recipientName, buyerName, buyerUsername to infer demographic categories:
 * - Malay
 * - Chinese
 * - Indian
 * - Others / Unassigned
 */

import { ShopeeOrder } from '../types';

export type BuyerRace = 'Malay' | 'Chinese' | 'Indian' | 'Others';

export function inferBuyerRace(order: ShopeeOrder): BuyerRace {
  // Primary name fields take highest priority
  const primaryNameText = [order.recipientName, order.buyerName, order.buyerUsername]
    .filter(Boolean)
    .join(' ');

  if (!primaryNameText.trim()) {
    if (!order.shippingAddress) return 'Others';
  }

  // Pre-process camelCase (e.g., FarisZulkefly -> Faris Zulkefly, AmirulAfiq -> Amirul Afiq)
  const expandedText = (primaryNameText + ' ' + (order.shippingAddress || ''))
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

  // Clean tokens (split by any non-alphanumeric character)
  const tokens = expandedText.split(/[^a-z0-9]+/).filter(Boolean);

  if (tokens.length === 0) {
    return 'Others';
  }

  // 1. Comprehensive Malay Name Indicators & Roots
  const malayKeywords = new Set([
    // Patronymics / Honorifics
    'bin', 'binti', 'bt', 'bte', 'abdullah', 'abd', 'abdul', 'syed', 'sharifah',
    'nik', 'wan', 'meor', 'tunku', 'megat', 'puteri', 'raja', 'tengku', 'che', 'cik',

    // Muhammad / Mohd variants
    'muhammad', 'mohammad', 'mohamad', 'mohamed', 'muhamad', 'mohd', 'md', 'muh', 'mat', 'mhd', 'mhmd',

    // Common Given / Middle / Family Malay Names
    'ahmad', 'ahmed', 'akmal', 'amir', 'amirul', 'aliff', 'alif', 'afiq', 'azrul', 'azman',
    'azmi', 'azhar', 'aziz', 'azizam', 'azizi', 'azizah', 'azlan', 'azwan', 'azril', 'azri',
    'faris', 'farid', 'farih', 'faizal', 'faiz', 'fadhil', 'fauzi', 'firdaus', 'fadzil', 'farihin', 'farah',
    'hafiz', 'hafez', 'hafizuddin', 'haikal', 'hakim', 'hanif', 'hanis', 'hazim', 'haziq',
    'hasan', 'hassan', 'hussein', 'husaini', 'husain', 'hasnan', 'helmi',
    'irfan', 'ismail', 'ibrahim', 'ikhwan', 'ikmal', 'imran', 'iman', 'izzat', 'izzah', 'izwan', 'izham',
    'khairul', 'khairi', 'khair', 'kamal', 'kassim', 'kamarul', 'khadijah',
    'nabil', 'nabilah', 'nasruddin', 'nazri', 'najmi', 'nizam', 'nor', 'nur', 'nura', 'nurul', 'najwa', 'nasir',
    'siti', 'salman', 'syafiq', 'syazwan', 'shazwan', 'syafiqah', 'syahmi', `syakir`, 'suffian', 'suhaimi',
    'safwan', 'syukri', 'syukry', 'syuaib',
    'taufik', 'taufiq', 'tawfiq', 'tarmizi',
    'zulkifli', 'zulkefly', 'zulkefli', 'zul', 'zulfan', 'zainal', 'zain', 'zaini', 'zaki', 'zaid', 'zamani', 'zulkarnain',
    'akhyar', 'asyraf', 'ashraf', 'amsyar', 'aisyah', 'aisy', 'aishah', 'anuar', 'anwar', 'ariff', 'arif', 'adli', 'adnan',
    'dani', 'danial', 'daniel', 'danish', 'daud',
    'luqman', 'lukman', 'lokman', 'lutfi',
    'ridzuan', 'rizal', 'razak', 'rashid', 'rozi', 'rosli', 'ramli', 'rahim', 'rahiman', 'rusli',
    'murshidien', 'muadz', 'nadzrul', 'nursyukri', 'asraf', 'yusman', 'yusof', 'yusoff', 'osman', 'daud'
  ]);

  // Check Malay exact token match
  for (const token of tokens) {
    if (malayKeywords.has(token)) {
      return 'Malay';
    }
  }

  // Check Malay substring patterns for usernames (e.g. @azrulnabilah, @aisyhafiz852, @fariszulkefit, @syazwannaqiuddinmustafa)
  const malaySubstrings = [
    'zulkef', 'zulkif', 'hafiz', 'akhyar', 'syukri', 'shazwan', 'syazwan', 'nabilah',
    'amirul', 'azrul', 'amsyar', 'husaini', 'taufik', 'taufiq', 'fariq', 'safwan', 'syuaib'
  ];
  for (const sub of malaySubstrings) {
    if (expandedText.includes(sub)) {
      return 'Malay';
    }
  }

  // 2. Indian Name Indicators
  const indianKeywords = new Set([
    'subramaniam', 'ramasamy', 'krishnan', 'kumar', 'raju', 'singh', 'kaur', 'devi',
    'ravichandran', 'muthu', 'sundram', 'raj', 'anandan', 'nair', 'menon', 'pillai',
    'ganesh', 'murugan', 'vijayan', 'suresh', 'sharma', 'varma', 'naidu', 'saravanan',
    'selvam', 'kannan', 'prasad', 'dinesh', 'logesh', 'vigneswaran', 'sankar'
  ]);

  if (expandedText.includes('a/l') || expandedText.includes('a/p') || expandedText.includes(' al ') || expandedText.includes(' ap ')) {
    return 'Indian';
  }

  for (const token of tokens) {
    if (indianKeywords.has(token)) {
      return 'Indian';
    }
  }

  // 3. Chinese Surname & Name Patterns
  const chineseSurnames = new Set([
    'tan', 'lim', 'lee', 'wong', 'ng', 'chin', 'chan', 'chong', 'lao', 'lau', 'tian', 'teoh',
    'teow', 'chia', 'low', 'goh', 'ho', 'yap', 'yew', 'cheng', 'cheah', 'choo', 'tai', 'soh',
    'sim', 'chua', 'cheung', 'kwok', 'fang', 'khoo', 'phang', 'koo', 'loo', 'foo', 'liew',
    'fong', 'seah', 'tang', 'ang', 'beh', 'ong', 'heng', 'ling', 'tiong', 'siew', 'soo', 'khor',
    'leong', 'lah', 'saw', 'kua', 'kuah', 'sze', 'yee', 'sun', 'kok', 'weng', 'kai', 'wei',
    'hao', 'jun', 'xian', 'xin', 'yi', 'hui', 'min'
  ]);

  // Primary name tokens only for Chinese (to avoid matching address words like Lorong/Selangor/Tanjung)
  const nameOnlyTokens = primaryNameText
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  for (const token of nameOnlyTokens) {
    if (chineseSurnames.has(token)) {
      return 'Chinese';
    }
  }

  return 'Others';
}

export const ALL_RACES: BuyerRace[] = ['Malay', 'Chinese', 'Indian', 'Others'];

