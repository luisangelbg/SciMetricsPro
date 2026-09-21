/* SciMetricsPro — country of an affiliation.
   Records store the ISO 3166-1 alpha-2 code (MX, US, BR …); names in any interface
   language come from Intl.DisplayNames when shown. The lookup table is built from
   the English, Spanish and Portuguese names the browser knows for every code, plus
   the spellings bibliographic databases use (USA, Peoples R China, England …). */
'use strict';

function smpCountries(P) {
  const CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE ' +
    'GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP ' +
    'KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF ' +
    'NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN ' +
    'SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ' +
    'ZA ZM ZW').split(' ');
  P.COUNTRY_CODES = CODES;

  const US_STATES = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware',
    'district of columbia', 'florida', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
    'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
    'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
    'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia',
    'washington', 'west virginia', 'wisconsin', 'wyoming'];
  const US_POSTAL = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));

  /* Spellings found in exports, already normalised with norm() */
  const ALIASES = {
    'usa': 'US', 'us': 'US', 'united states': 'US', 'united states of america': 'US', 'eeuu': 'US', 'eua': 'US', 'estados unidos de america': 'US',
    'uk': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB', 'north ireland': 'GB', 'great britain': 'GB', 'united kingdom': 'GB',
    'peoples r china': 'CN', 'peoples republic of china': 'CN', 'pr china': 'CN', 'p r china': 'CN', 'prc': 'CN', 'mainland china': 'CN', 'china': 'CN',
    'taiwan': 'TW', 'republic of china': 'TW', 'taiwan roc': 'TW', 'hong kong': 'HK', 'hong kong sar': 'HK', 'hong kong sar china': 'HK', 'macau': 'MO', 'macao': 'MO',
    'south korea': 'KR', 'korea': 'KR', 'republic of korea': 'KR', 'rep of korea': 'KR', 'korea republic of': 'KR', 'korea south': 'KR', 's korea': 'KR',
    'north korea': 'KP', 'dem peoples r korea': 'KP', 'democratic peoples republic of korea': 'KP', 'korea north': 'KP',
    'russia': 'RU', 'russian federation': 'RU', 'ussr': 'RU', 'iran': 'IR', 'islamic republic of iran': 'IR', 'iran islamic republic of': 'IR',
    'viet nam': 'VN', 'vietnam': 'VN', 'czech republic': 'CZ', 'czechia': 'CZ', 'slovak republic': 'SK', 'turkey': 'TR', 'turkiye': 'TR',
    'u arab emirates': 'AE', 'uae': 'AE', 'united arab emirates': 'AE',
    'cote ivoire': 'CI', 'cote d ivoire': 'CI', 'cote divoire': 'CI', 'ivory coast': 'CI',
    'dem rep congo': 'CD', 'democratic republic of the congo': 'CD', 'democratic republic of congo': 'CD', 'congo kinshasa': 'CD', 'zaire': 'CD', 'dr congo': 'CD',
    'rep congo': 'CG', 'republic of the congo': 'CG', 'republic of congo': 'CG', 'congo': 'CG', 'congo brazzaville': 'CG',
    'bosnia and herceg': 'BA', 'bosnia and herzegovina': 'BA', 'bosnia herzegovina': 'BA',
    'trinidad tobago': 'TT', 'trinidad and tobago': 'TT', 'antigua and barbu': 'AG', 'st kitts and nevi': 'KN', 'saint kitts and nevis': 'KN',
    'st lucia': 'LC', 'saint lucia': 'LC', 'st vincent': 'VC', 'saint vincent and the grenadines': 'VC', 'sao tome and prin': 'ST', 'sao tome and principe': 'ST',
    'papua n guinea': 'PG', 'papua new guinea': 'PG', 'syria': 'SY', 'syrian arab republic': 'SY', 'laos': 'LA', 'lao pdr': 'LA',
    'lao peoples democratic republic': 'LA', 'brunei': 'BN', 'brunei darussalam': 'BN', 'bolivia': 'BO', 'plurinational state of bolivia': 'BO',
    'venezuela': 'VE', 'bolivarian republic of venezuela': 'VE', 'tanzania': 'TZ', 'united republic of tanzania': 'TZ', 'moldova': 'MD',
    'republic of moldova': 'MD', 'macedonia': 'MK', 'north macedonia': 'MK', 'fyr macedonia': 'MK', 'republic of north macedonia': 'MK',
    'swaziland': 'SZ', 'eswatini': 'SZ', 'burma': 'MM', 'myanmar': 'MM', 'cape verde': 'CV', 'cabo verde': 'CV', 'vatican': 'VA', 'holy see': 'VA',
    'palestine': 'PS', 'state of palestine': 'PS', 'palestinian territories': 'PS', 'gaza strip': 'PS', 'west bank': 'PS',
    'byelarus': 'BY', 'belarus': 'BY', 'rep of georgia': 'GE', 'micronesia': 'FM', 'fed states micronesia': 'FM', 'guinea bissau': 'GW',
    'equat guinea': 'GQ', 'central african republ': 'CF', 'central african republic': 'CF', 'dominican rep': 'DO', 'dominican republic': 'DO',
    'netherlands': 'NL', 'the netherlands': 'NL', 'holland': 'NL', 'south africa': 'ZA', 'rep south africa': 'ZA', 'kosovo': 'XK',
    'serbia': 'RS', 'serbia and montenegro': 'RS', 'yugoslavia': 'RS', 'montenegro': 'ME', 'west germany': 'DE', 'fed rep ger': 'DE',
    'ger dem rep': 'DE', 'deutschland': 'DE', 'espana': 'ES', 'brasil': 'BR', 'mexico': 'MX', 'peru': 'PE', 'turks and caicos': 'TC',
    'british virgin isl': 'VG', 'us virgin isl': 'VI', 'new caledonia': 'NC', 'fr polynesia': 'PF', 'french polynesia': 'PF', 'reunion': 'RE',
    'french guiana': 'GF', 'guadeloupe': 'GP', 'martinique': 'MQ', 'curacao': 'CW', 'greenland': 'GL', 'faroe islands': 'FO',
    'timor leste': 'TL', 'east timor': 'TL', 'gambia': 'GM', 'the gambia': 'GM', 'bahamas': 'BS', 'the bahamas': 'BS', 'falkland island': 'FK',
    'solomon islands': 'SB', 'marshall island': 'MH', 'northern mariana islands': 'MP', 'cayman islands': 'KY', 'puerto rico': 'PR',
    'guam': 'GU', 'american samoa': 'AS', 'sri lanka': 'LK', 'new zealand': 'NZ', 'singapore': 'SG', 'israel': 'IL',
  };
  US_STATES.forEach(s => { ALIASES[s] = 'US'; });

  function norm(s) {
    return P.fold(s).replace(/&/g, ' and ').replace(/['’.]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  let index = null;
  P.countryIndex = function () {
    if (index) return index;
    index = Object.create(null);
    const add = (name, code) => {
      const k = norm(name);
      if (k && !(k in index)) index[k] = code;
      /* "Myanmar (Burma)" → "myanmar"; "Congo - Kinshasa" → "congo" (the aliases below settle ambiguities) */
      const simple = norm(String(name).replace(/\(.*?\)/g, ' ').replace(/\s-\s.*$/, ''));
      if (simple && !(simple in index)) index[simple] = code;
    };
    for (const lang of ['en', 'es', 'pt']) {
      let dn = null;
      try { dn = new Intl.DisplayNames([lang], { type: 'region' }); } catch (e) { dn = null; }
      if (!dn) continue;
      for (const code of CODES) {
        let name = null;
        try { name = dn.of(code); } catch (e) { name = null; }
        if (name && name !== code) add(name, code);
      }
    }
    for (const k in ALIASES) index[k] = ALIASES[k];
    return index;
  };

  function matchPart(part, idx, extra) {
    const f = norm(part);
    if (!f) return null;
    const look = key => (extra && extra.has(key) ? extra.get(key) : idx[key]);
    if (look(f)) return look(f);
    /* the last words, longest first, ignoring postal codes: "ca 94305 usa", "04510 mexico city mexico" */
    const words = f.split(' ').filter(w => !/\d/.test(w));
    for (let n = Math.min(5, words.length); n >= 1; n--) {
      const key = words.slice(words.length - n).join(' ');
      if (look(key)) return look(key);
    }
    /* United States address without the country: "NY 10027", "CA 94305-5020" */
    const m = String(part).trim().match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?$/);
    if (m && US_POSTAL.has(m[1])) return 'US';
    return null;
  }

  /* user aliases [{ text, code }] → Map in the same normalised form as the built-in table */
  P.countryAliasMap = function (rows) {
    const m = new Map();
    for (const r of rows || []) { const k = norm(r.text); if (k && /^[A-Z]{2}$/.test(r.code)) m.set(k, r.code); }
    return m;
  };

  /* Country of one affiliation string, or null. Looks at the last comma-separated
     parts (the country is written last), after removing e-mail addresses.
     extra: Map of user aliases (P.countryAliasMap), consulted before the built-in table. */
  P.countryOf = function (affiliation, extra) {
    if (!affiliation) return null;
    const idx = P.countryIndex();
    let s = String(affiliation)
      .replace(/electronic address\s*:.*$/i, '')
      .replace(/\bemail\s*:.*$/i, '')
      .replace(/\S+@\S+/g, ' ')
      /* identifiers appended to affiliations: "ORCID: …", "ROR: https://…", "GRID: grid.…", "ISNI: 0000 …" */
      .replace(/\b(ORCID|ROR|GRID|ISNI|Ringgold)\s*:.*$/i, '')
      .replace(/(\p{L})\d{1,2}(?=[.;,]?\s*$)/u, '$1')        // footnote mark: "South Africa1."
      .replace(/[\s.;,]+$/, '')
      .replace(/\s*\([^()]*\)$/, '')                       // trailing acronym: "Costa Rica (ITCR)"
      .replace(/[\s.;,]+$/, '');
    const parts = s.split(',').map(x => x.trim()).filter(Boolean);
    for (let k = parts.length - 1; k >= Math.max(0, parts.length - 3); k--) {
      const code = matchPart(parts[k], idx, extra);
      if (code) return code;
    }
    return null;
  };
}

(window.PARSER_PARTS = window.PARSER_PARTS || []).push(smpCountries);
