// Situation understanding (who / why / feeling / tone), facet re-ranking, and the template-based personal note.
const NOT_NAMES = new Set('farewell birthday wedding anniversary movie long sorry dear i im me my she he her him his they we you your it this that someone somebody girlfriend boyfriend gf bf wife husband lover crush amma nanna mom dad mother father friend sister brother song songs apology sorry telugu please the a an angry upset sad today yesterday why what how when love baby babe darling bujji bangaram chinni my mine wife\'s best play find give suggest need want'.split(' '));
const CAUSE_RX = {
  missed_plans: /movie|cinema|\bfilm\b|\bdate\b|dinner|lunch|\btrip\b|outing|shopping|\bplan|take her|took her|take him|didn'?t come|did not come|cancel|సినిమా|ప్లాన్/i,
  forgot_day: /forg[eo]t|మర్చిపో/i,
  late: /\blate\b|\bwait(ed|ing)?\b|లేట్/i,
  fight_words: /fight|fought|shout|yell|argu|said something|harsh|\bwords\b|\bhurt|rude|scold|గొడవ|తిట్ట/i,
  ignored_busy: /\bbusy\b|\bwork\b|office|didn'?t call|did not call|no call|not calling|didn'?t reply|not replying|ignor|no time|\bphone\b|బిజీ/i,
  broke_promise: /promise|మాట తప్ప/i,
  jealousy: /jealous|another girl|other girl|\bex\b|misunderstand|doubt|అనుమాన/i,
  long_distance: /\bfar\b|distance|abroad|another city|\baway\b|\busa\b|onsite|\bldr\b|దూరం/i,
  missing_you: /\bmiss(ing)?\b|మిస్/i,
  breakup: /break ?up|left me|leaving me|dumped|విడిపో/i,
  proposal: /propos|confess|express my love|tell her i love|tell him i love/i,
  anniversary: /anniversary/i, birthday: /birthday|bday|పుట్టినరోజు/i,
  wedding: /wedding|marriage|pelli|sangeet|engagement|పెళ్లి/i,
  festival: /festival|sankranti|diwali|dasara|ugadi|pooja|పండగ/i,
  farewell: /farewell|reunion|send ?off/i,
  motivation: /motivat|exam|\bgym\b|workout/i,
};
const REL_RX = {
  partner: /girl ?friend|boy ?friend|\bgf\b|\bbf\b|wife|husband|lover|\bcrush|fianc|darling|\bshe\b|\bher\b|\bhe\b|\bhim\b|ప్రియ|భార్య|లవర్/i,
  mother: /\bamma\b|\bmom\b|\bmum\b|mother|అమ్మ|తల్లి/i, father: /nanna|\bdad\b|father|నాన్న/i,
  sibling: /sister|brother|chelli|\bakka\b|\banna(yya)?\b|thammud|చెల్లి|అక్క|తమ్ము|అన్న/i,
  friend: /(?<!girl ?|boy ?)friend|\bdost|\bmama\b|\bbro\b|స్నేహ/i, god: /\bgod\b|swamy|swami|devotion|దేవ/i,
};
const OBJ = { movie: ['సినిమా', 'movie', 'టికెట్లు, పాప్‌కార్న్', 'tickets and popcorn'], cinema: ['సినిమా', 'movie', 'టికెట్లు, పాప్‌కార్న్', 'tickets and popcorn'],
  film: ['సినిమా', 'movie', 'టికెట్లు, పాప్‌కార్న్', 'tickets and popcorn'], dinner: ['డిన్నర్', 'dinner', 'నీకు ఇష్టమైన బిర్యానీ', 'your favourite biryani'],
  lunch: ['లంచ్', 'lunch', 'నీకు ఇష్టమైన ఫుడ్', 'your favourite food'], trip: ['ట్రిప్', 'trip', 'ప్లానింగ్, ఖర్చు', 'the planning and the bill'],
  date: ['డేట్', 'date', 'ఐస్ క్రీమ్, సర్ప్రైజ్', 'ice cream and a surprise'], shopping: ['షాపింగ్', 'shopping', 'బ్యాగులు మోయడం', 'carrying the bags'],
  outing: ['బయటికి', 'outing', 'ఐస్ క్రీమ్', 'ice cream'] };
export const CAUSE_SHORT = { missed_plans: 'missed plans', forgot_day: 'a forgotten special day', late: 'being late', fight_words: 'a fight', ignored_busy: 'being too busy',
  broke_promise: 'a broken promise', jealousy: 'a misunderstanding', long_distance: 'long distance', missing_you: 'missing someone', breakup: 'a breakup',
  proposal: 'confessing love', anniversary: 'an anniversary', birthday: 'a birthday', wedding: 'a wedding', festival: 'a festival', farewell: 'a farewell', motivation: 'motivation' };
const REL_LABEL = { partner: 'partner', mother: 'Amma', father: 'Nanna', sibling: 'sibling', friend: 'friend', god: 'God' };
const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export function extractFacets(q) {
  const f = { name: '', rel: '', causes: [], emotion: '', tone: [], obj: '', gender: '' };
  if (!q || !q.trim()) return f;
  const pats = [/^\s*([A-Za-z]{3,})\s+(?:is|was|got|has|seems|feels|isn'?t|won'?t|doesn'?t|became)\b/i,
    /\b(?:for|to|with|on|at|make|making|tell|convince|impress)\s+(?:my\s+)?(?:girlfriend\s+|gf\s+|wife\s+|lover\s+|love\s+|crush\s+|friend\s+|boyfriend\s+|husband\s+)?([A-Z][a-z]{2,})\b/,
    /\b(?:girlfriend|gf|wife|lover|crush|boyfriend|husband|friend)\s+([A-Za-z]{3,})\b/i, /\b([A-Z][a-z]{2,})\s+(?:is|got)\s+(?:angry|upset|mad|sad)/,
    /^\s*([A-Z][a-z]{2,})\s+(?:and|&)\s+(?:I|me)\b/, /\b(?:I|me)\s+(?:and|&)\s+([A-Z][a-z]{2,})\b/];
  for (const [k, rx] of pats.entries()) { const m = q.match(rx); if (m && !NOT_NAMES.has(m[1].toLowerCase()) && (k === 0 || /^[A-Z]/.test(m[1]))) { f.name = cap(m[1]); break; } }
  for (const [c, rx] of Object.entries(CAUSE_RX)) if (rx.test(q)) f.causes.push(c);
  const om = q.toLowerCase().match(/movie|cinema|\bfilm\b|dinner|lunch|\btrip\b|\bdate\b|shopping|outing/); if (om) f.obj = om[0].replace(/\\b/g, '');
  if (/సినిమా/.test(q)) f.obj = 'movie';
  const strongPartner = /girl ?friend|boy ?friend|\bgf\b|\bbf\b|wife|husband|lover|\bcrush|fianc|ప్రియురాలు|భార్య|లవర్/i.test(q);
  if (strongPartner) f.rel = 'partner';
  else for (const r of ['mother', 'father', 'sibling', 'friend', 'god', 'partner']) if (REL_RX[r].test(q)) { f.rel = r; break; }
  const rw = q.match(/girl ?friend|boy ?friend|\bgf\b|\bbf\b|wife|husband|fianc[ée]+|crush|lover/i); f.relWord = rw ? rw[0].toLowerCase().replace(/^gf$/, 'girlfriend').replace(/^bf$/, 'boyfriend') : '';
  if (/\b(he|him|his|boy ?friend|bf|husband)\b/i.test(q)) f.gender = 'm'; else if (/\b(she|her|girl ?friend|gf|wife)\b/i.test(q)) f.gender = 'f';
  if (/angry|upset|mad at|sulk|not talking|kopam|alig|కోప|అలిగ|అలక/i.test(q)) f.emotion = 'angry';
  else if (/\bsad\b|crying|\bhurt\b|బాధ/i.test(q)) f.emotion = 'sad'; else if (/\bmiss/i.test(q)) f.emotion = 'missing';
  const APOL = ['missed_plans', 'forgot_day', 'late', 'fight_words', 'ignored_busy', 'broke_promise', 'jealousy'];
  if (!f.emotion && f.causes.some(c => APOL.includes(c)) && (f.name || !f.rel || f.rel === 'partner')) f.emotion = 'upset';
  if (!f.rel && f.name && (f.emotion || f.causes.some(c => ['missed_plans', 'forgot_day', 'late', 'jealousy', 'proposal', 'anniversary', 'long_distance', 'breakup'].includes(c)))) f.rel = 'partner';
  if (/funny|cute|playful|light|laugh|fun\b|comedy/i.test(q)) f.tone.push('playful');
  if (/emotional|heartfelt|serious|deep|touching|cry/i.test(q)) f.tone.push('emotional');
  if (/romantic/i.test(q)) f.tone.push('romantic');
  if (!f.tone.length && (f.emotion === 'angry' || f.emotion === 'upset')) {
    const serious = f.causes.some(c => ['fight_words', 'jealousy', 'breakup'].includes(c));
    f.tone = serious ? ['emotional', 'sweet'] : ['playful', 'sweet'];
  }
  if (!f.tone.length && f.causes.some(c => ['missing_you', 'long_distance', 'breakup'].includes(c))) f.tone = ['emotional'];
  return f;
}
export const hasFacets = f => !!(f.name || f.causes.length || f.emotion || f.rel);
export function facetTags(f) {   // extra mood tags implied by the situation
  const t = new Set();
  if ((f.emotion === 'angry' || f.emotion === 'upset') && (f.rel === 'partner' || !f.rel)) t.add('apology');
  if (f.rel === 'mother') t.add('mother'); if (f.rel === 'father') t.add('father'); if (f.rel === 'friend') t.add('friendship'); if (f.rel === 'sibling') t.add('sibling');
  if (f.causes.includes('breakup')) t.add('breakup'); if (f.causes.includes('wedding')) t.add('wedding');
  if (f.causes.some(c => ['missing_you', 'long_distance'].includes(c))) t.add('sad');
  if (f.rel === 'partner' && !t.size) t.add('romance');
  return [...t];
}
/** text to embed: original query + facet expansion, matching the "situation | good for" text in song docs */
export function expandQuery(q, f, rules) {
  if (!hasFacets(f)) return q;
  const parts = [f.name ? q.replace(new RegExp('\\b' + f.name + '\\b', 'ig'), f.gender === 'm' ? 'my boyfriend' : 'my girlfriend') : q];
  const tags = facetTags(f); if (tags.length) parts.push('mood: ' + tags.join(', '));
  if (f.causes.length) parts.push('good for: ' + f.causes.map(c => rules.causes[c] || c).join('; '));
  if (f.tone.length) parts.push('tone: ' + f.tone.join(', '));
  return parts.join(' | ');
}
export function songFacets(s, data) {
  if (s.cur >= 0) { const c = data.curated[s.cur]; return { situation: c[0], why: c[1], causes: c[2], tone: c[3], rel: c[4], curated: true }; }
  const R = data.rules.tags, ts = s.tags.filter(t => R[t]);
  if (!ts.length) return { situation: '', why: '', causes: [], tone: [], rel: [], curated: false };
  const u = k => [...new Set(ts.flatMap(t => R[t][k]))];
  return { situation: ts.slice(0, 2).map(t => R[t].situation).join(' '), why: R[ts[0]].why, causes: u('causes'), tone: u('tone'), rel: u('rel'), curated: false };
}
export function facetBonus(s, f, data) {
  const sf = songFacets(s, data);
  const co = f.causes.filter(c => sf.causes.includes(c)).length;
  let b = 0.06 * Math.min(2, co) + (co && sf.curated ? 0.06 : 0);
  if (f.tone.some(t => sf.tone.includes(t))) b += 0.04;
  if (f.rel && sf.rel.length) b += sf.rel.includes(f.rel) ? 0.06 : -0.25;
  if (s.ytk === 1) b += 0.04;
  if (s.enr) b += 0.02;
  return b;
}
export function whyFits(s, f, data) {
  const sf = songFacets(s, data);
  let w = sf.why || (s.tags.length ? s.tags.join(', ') + ' song' : 'a close match for your words');
  const c = f.causes.find(c => sf.causes.includes(c));
  if (c && !sf.curated) w += `, fits ${CAUSE_SHORT[c]}`;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ---------- template-based personal note (Telugu + English) ----------
export function makeNote(f, toneOverride) {
  const N = f.name || '', te = { n: N || 'బంగారం', }, en = { n: N || 'Dear' };
  const tone = toneOverride || (f.tone[0] === 'emotional' ? 'emotional' : f.tone.includes('playful') ? 'playful' : 'sweet');
  const o = OBJ[f.obj] || null;
  const P = f.rel || (f.emotion ? 'partner' : '');
  let T, E;
  const c = ['missed_plans', 'forgot_day', 'late', 'broke_promise', 'ignored_busy', 'jealousy', 'fight_words', 'breakup', 'long_distance', 'missing_you', 'proposal', 'birthday', 'anniversary', 'wedding']
    .find(x => f.causes.includes(x));
  if (P === 'mother' || P === 'father') {
    const w = P === 'mother' ? ['అమ్మా', 'Amma'] : ['నాన్నా', 'Nanna'];
    if (c === 'birthday') { T = `హ్యాపీ బర్త్‌డే ${w[0]}! నువ్వు లేకపోతే నేను లేను. నీ నవ్వు ఎప్పుడూ ఇలాగే ఉండాలి 🎂❤️`; E = `Happy birthday ${w[1]}! I am who I am because of you. Keep smiling, always 🎂❤️`; }
    else if (c === 'missing_you' || c === 'long_distance') { T = `${w[0]}, నీ చేతి వంట, నీ మాట చాలా మిస్ అవుతున్నా. త్వరలో ఇంటికి వస్తా 🏠`; E = `${w[1]}, I miss your food and your voice so much. Coming home soon 🏠`; }
    else if (f.emotion === 'angry') { T = `${w[0]}, నిన్ను బాధపెట్టాను, సారీ. నువ్వు నవ్వితేనే ఇంట్లో వెలుగు 🙏`; E = `${w[1]}, I'm sorry I upset you. The house only lights up when you smile 🙏`; }
    else { T = `${w[0]}, నువ్వు లేకపోతే నేను లేను. థాంక్యూ, లవ్ యూ 🙏❤️`; E = `${w[1]}, I wouldn't be anything without you. Thank you, love you 🙏❤️`; }
    return { te: T, en: E, tone };
  }
  if (P === 'friend' || P === 'sibling') {
    if (P === 'friend' && !N) te.n = 'నేస్తం';
    if (f.emotion === 'angry' || f.emotion === 'upset') { T = `${te.n}, తప్పు నాదే, సారీ రా. మన బంధం ఒక్క గొడవతో మారదు 🤝`; E = `${en.n}, my bad, sorry. One fight can't change what we have 🤝`; }
    else if (c === 'birthday') { T = `హ్యాపీ బర్త్‌డే ${te.n}! నువ్వు ఉండటం నా లక్ 🎉`; E = `Happy birthday ${en.n}! Lucky to have you 🎉`; }
    else { T = `${te.n}, ఎన్ని రోజులైనా మన బంధం మారదు. ఈ పాట నీ కోసం 🤝`; E = `${en.n}, no matter how much time passes, we stay the same. This song is for you 🤝`; }
    return { te: T, en: E, tone };
  }
  switch (c) {
    case 'missed_plans': {
      const ot = o ? o[0] : 'బయటికి', oe = o ? o[1] : 'plan', tt = o ? o[2] : 'నీకు ఇష్టమైనవి', tE = o ? o[3] : 'everything you like';
      T = `${te.n}, ${ot}కి తీసుకెళ్తానని చెప్పి మాట తప్పాను. సారీ బంగారం! ఈ వీకెండ్ నేనే ప్లాన్ చేస్తా, ${tt} అన్నీ నావే. అంతవరకు ఈ పాట నీ కోసం 🎵`;
      E = `${en.n}, I promised you the ${oe} and didn't keep it. I'm really sorry. This weekend it's my treat, ${tE}, all on me. Till then, this song is for you 🎵`; break; }
    case 'forgot_day': T = `${te.n}, నీ ప్రత్యేకమైన రోజుని మర్చిపోయాను, నా తప్పే. కానీ నిన్ను ఒక్క క్షణం కూడా మర్చిపోలేదు. ఈ రోజు నుంచి ప్రతి రోజూ నీదే ❤️`;
      E = `${en.n}, I forgot your special day and that's on me. But I never stop thinking about you. Let me make it up to you, starting today ❤️`; break;
    case 'late': T = `${te.n}, నిన్ను వెయిట్ చేయించాను, సారీ. ఇకపై నువ్వు వచ్చేలోపే నేను అక్కడ ఉంటా, ప్రామిస్ ⏰`; E = `${en.n}, sorry for making you wait. Next time I'll be there before you, promise ⏰`; break;
    case 'broke_promise': T = `${te.n}, ఇచ్చిన మాట నిలబెట్టుకోలేదు, సారీ. ఈసారి మాటలు కాదు, చేసి చూపిస్తా 🤞`; E = `${en.n}, I broke my promise and I'm sorry. This time I won't just say it, I'll show you 🤞`; break;
    case 'ignored_busy': T = `${te.n}, పని పేరుతో నిన్ను పట్టించుకోలేదు, సారీ. ఎంత బిజీ అయినా నువ్వే నా ఫస్ట్ ప్రయారిటీ. ఈ రోజు ఫోన్ పక్కన పెట్టి నీతోనే ❤️`;
      E = `${en.n}, I got so busy that I neglected you. I'm sorry. However busy I get, you come first. Today it's phone away, just us ❤️`; break;
    case 'jealousy': T = `${te.n}, అనవసరంగా అపార్థం జరిగింది. నా మనసులో నువ్వు తప్ప ఎవరూ లేరు 💛`; E = `${en.n}, it was a silly misunderstanding. There's no one in my heart but you 💛`; break;
    case 'fight_words': T = `${te.n}, కోపంలో అనకూడని మాటలు అన్నాను. నా మాటలు తప్పు, కానీ నా ప్రేమ నిజం. నన్ను క్షమించు 🙏`; E = `${en.n}, I said things I shouldn't have. My words were wrong, but my love is real. Please forgive me 🙏`; break;
    case 'breakup': T = `${te.n}, నిన్ను కోల్పోవడం నాకు ఇష్టం లేదు. ఒక్కసారి మాట్లాడదాం, ప్లీజ్ 🙏`; E = `${en.n}, I don't want to lose you. Can we talk, just once? 🙏`; break;
    case 'long_distance': T = `${te.n}, మన మధ్య దూరం ఎంత ఉన్నా, నా మనసు నీ పక్కనే ఉంది. త్వరలో కలుద్దాం ✈️`; E = `${en.n}, however far apart we are, my heart is right next to you. See you soon ✈️`; break;
    case 'missing_you': T = `${te.n}, నువ్వు లేక ఏదీ బాగోలేదు. నిన్ను చాలా మిస్ అవుతున్నా 💭`; E = `${en.n}, nothing feels right without you. Missing you so much 💭`; break;
    case 'proposal': T = `${te.n}, చాలా రోజులుగా చెప్పాలనుకుంటున్నా... నువ్వంటే నాకు చాలా ఇష్టం ❤️`; E = `${en.n}, I've wanted to tell you this for a long time... I really, really like you ❤️`; break;
    case 'birthday': T = `హ్యాపీ బర్త్‌డే ${te.n}! నువ్వు నవ్వితే నా ప్రతి రోజూ పండగే 🎂`; E = `Happy birthday ${en.n}! Your smile makes every day a celebration 🎂`; break;
    case 'anniversary': T = `${te.n}, నీతో గడిపిన ప్రతి రోజూ ఒక పండగే. హ్యాపీ యానివర్సరీ 💑`; E = `${en.n}, every day with you has been a celebration. Happy anniversary 💑`; break;
    case 'wedding': T = `${te.n}, కొత్త జీవితానికి శుభాకాంక్షలు! ఎప్పటికీ ఇలాగే సంతోషంగా ఉండాలి 💐`; E = `${en.n}, congratulations on your new life together! Stay this happy forever 💐`; break;
    default:
      if (f.emotion) { T = `${te.n}, కోపంలో కూడా నువ్వు అందంగానే ఉన్నావు 😄 కానీ నాకు నీ నవ్వే కావాలి. సారీ బంగారం 🙏`; E = `${en.n}, you look cute even when you're angry 😄 but I miss your smile. I'm sorry 🙏`; }
      else { T = `${te.n}, నువ్వు నా జీవితంలో ఉండటం నా అదృష్టం ❤️ ఈ పాట నీ కోసం`; E = `${en.n}, I'm so lucky to have you ❤️ This song is for you`; }
  }
  const apology = ['missed_plans', 'forgot_day', 'late', 'broke_promise', 'ignored_busy', 'jealousy', 'fight_words'].includes(c) || f.emotion === 'angry' || f.emotion === 'upset';
  if (apology && tone === 'playful') { T += ' పనిష్మెంట్ ఏదైనా ఓకే, కానీ మాట్లాడకుండా మాత్రం ఉండకు 😅'; E += " Any punishment is fine, just don't stop talking to me 😅"; }
  if (apology && tone === 'emotional') { T += ' నువ్వే నా ప్రపంచం.'; E += ' You mean the world to me.'; }
  return { te: T, en: E, tone };
}
export function describeFacets(f) {
  const out = [];
  if (f.name || f.rel) out.push(['Who', [f.rel === 'partner' ? (f.relWord || (f.gender === 'm' ? 'boyfriend' : f.gender === 'f' ? 'girlfriend' : 'partner')) : REL_LABEL[f.rel], f.name].filter(Boolean).join(' ')]);
  if (f.causes.length) out.push(['Why', f.causes.map(c => CAUSE_SHORT[c] + (c === 'missed_plans' && f.obj ? ` (${OBJ[f.obj] ? OBJ[f.obj][1] : f.obj})` : '')).join(', ')]);
  if (f.emotion) out.push(['Feeling', f.emotion]);
  if (f.tone.length) out.push(['Tone', f.tone.join(' & ')]);
  return out;
}
export const wantsNote = f => !!(f.name || f.emotion || ['partner', 'mother', 'father', 'friend', 'sibling'].includes(f.rel));
