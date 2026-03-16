// ========== PROFANITY FILTER ==========
// Hard blocks inappropriate usernames at signup and username change.
// Uses a comprehensive blocklist + aggressive leet speak normalization.
// No suggestions — just a hard reject with a clean error message.
//
// To add new blocked words: add them to the BLOCKLIST array (lowercase).
// The filter checks both original and leet-speak-normalized versions,
// AND checks if any blocked word appears as a substring of the username.

// ========== BLOCKLIST ==========
// All entries lowercase. The filter uses substring matching so
// 'fuck' will catch 'fuckboy', 'motherfuck', 'fuckface' etc automatically.
const BLOCKLIST = [

    // ===== CORE PROFANITY =====
    'fuck', 'fuk', 'fvck', 'fucc', 'feck', 'phuck', 'phuk',
    'shit', 'shyt', 'sheit', 'shiit', 'shitt',
    'bitch', 'biitch', 'bytch', 'b1tch',
    'ass', 'arse', 'azzhole', 'asshole', 'arsehole', 'assh0le',
    'bastard', 'basstard',
    'crap', 'piss', 'poop', 'turd', 'fart',
    'damn', 'damnit', 'damned',
    'cunt', 'cvnt', 'kunt',
    'cock', 'cawk', 'c0ck',
    'dick', 'dik', 'd1ck', 'diick',
    'prick', 'prik',
    'jackass', 'dipshit', 'dumbass', 'dumbfuck', 'dumbshit',
    'numbskull', 'moron', 'idiot', 'retard', 'retarded',
    'motherfucker', 'motherf', 'mf', 'mfer',
    'wtf', 'stfu', 'gtfo',
    'hellhole',

    // ===== SEXUAL =====
    'sex', 'sexy', 'sexxy',
    'porn', 'porno', 'pr0n', 'p0rn',
    'pussy', 'pvssy', 'pu55y', 'pussi',
    'vagina', 'vag', 'vajayjay',
    'penis', 'peenis', 'penis',
    'cum', 'cuming', 'cumming', 'cumshot', 'cumslut',
    'creampie', 'creampi',
    'dildo', 'dild0',
    'anal', 'anus',
    'blowjob', 'bl0wjob', 'blowj0b',
    'handjob', 'handj0b',
    'milf', 'gilf', 'dilf',
    'nude', 'nudes', 'naked',
    'nsfw', 'hentai',
    'boob', 'boobs', 'boobies', 'booby',
    'tit', 'tits', 'titty', 'titties', 'tittes',
    'hooters', 'jugs',
    'whore', 'wh0re', 'hooker', 'slut', 'sl0t', 'slutty',
    'skank', 'tramp', 'harlot',
    'erotic', 'erotica',
    'orgasm', 'orgy',
    'masturbat', 'jerkoff', 'jackoff',
    'ballsack', 'ballsak', 'nutsack', 'gooch', 'taint',
    'butthole', 'butth0le', 'buttplug',
    'foreskin', 'scrotum',
    'hardcock', 'harddick',
    'sexting', 'sextape',
    'onlyfans', 'camgirl', 'camboy',

    // ===== RACIAL SLURS =====
    'nigger', 'nigga', 'nigg', 'nig', 'n1gger', 'n1gga',
    'chink', 'ch1nk',
    'spic', 'spick', 'sp1c',
    'kike', 'k1ke',
    'gook', 'g00k',
    'wetback', 'wetbak',
    'beaner', 'beanr',
    'cracker', 'honky', 'honkey',
    'coon', 'c00n',
    'jigaboo', 'jiggaboo',
    'raghead', 'towelhead',
    'zipperhead',
    'redskin',
    'darkie', 'darky',
    'sambo',
    'pickaninny',
    'mulatto',
    'halfbreed', 'halfbreed',
    'camel jockey', 'cameljockey',
    'sandnigger', 'sandnigga',
    'jungle bunny', 'junglebunny',
    'porch monkey', 'porchmonkey',
    'uncle tom', 'uncletom',
    'white trash', 'whitetrash',
    'redneck',
    'trailer trash', 'trailertrash',
    'cholo',
    'gringo',
    'crip', 'blood',  // gang references

    // ===== HOMOPHOBIC / TRANSPHOBIC SLURS =====
    'faggot', 'fag', 'f4ggot', 'f4g',
    'dyke', 'dike',
    'tranny', 'tr4nny',
    'shemale', 'she-male',
    'queer', // context-dependent but blocking to be safe
    'homo', 'homofag',

    // ===== VIOLENCE / HATE =====
    'kill', 'killall', 'killeveryone',
    'murder', 'murderer',
    'rape', 'rapist', 'raper', 'r4pe',
    'terrorist', 'terror1st',
    'nazi', 'n4zi', 'naz1',
    'hitler', 'h1tler',
    'genocide', 'genoc1de',
    'lynch', 'lynching',
    'suicide', 'su1cide', 'su1c1de',
    'selfharm', 'selfhurt', 'cuttingmyself',
    'kkk', 'kkklan', 'klansman',
    'jihad', 'jihadist',
    'shooting', 'shooter', 'gunman',
    'bomber', 'bombing',
    'massacre',
    'pedophile', 'pedo', 'ped0',
    'molester', 'molest',
    'predator',
    'groomer',

    // ===== DRUG REFERENCES =====
    'weed', 'marijuana', 'cannabis', 'maryjane',
    'cocaine', 'coke', 'crack',
    'heroin', 'her01n',
    'meth', 'methhead', 'tweaker',
    'druggie', 'drugdealer', 'dealer',
    'crackhead', 'crackfiend',
    'stoner', 'pothead',
    'junkie', 'junkhead',
    'xanax', 'oxy', 'oxycontin', 'fentanyl',
    'molly', 'ecstasy', 'mdma',
    'lsd', 'acid', 'shrooms',

    // ===== CREATIVE COMBINATIONS PEOPLE TRY =====
    'dickhead', 'dickface', 'dickwad', 'dickweed', 'dicksucker',
    'asswipe', 'assbag', 'assclown', 'assface', 'asslicker',
    'asshat', 'assmunch', 'assnugget', 'asspirate',
    'shithead', 'shitface', 'shitbag', 'shitstain', 'shitshow',
    'shitweasel', 'shitlord', 'shitgibbon',
    'fuckface', 'fuckhead', 'fuckboy', 'fuckgirl', 'fuckwit',
    'fuckstick', 'fuckwad', 'fucknugget', 'fuckbag',
    'bitchass', 'bitchboy', 'bitchface',
    'cumface', 'cumrag', 'cumdumpster', 'cumbag',
    'cocksucker', 'cocksuck', 'cockface', 'cockhead', 'cockwad',
    'douchebag', 'douche', 'd0uche', 'douchcanoe',
    'scumbag', 'scumface', 'scumlord',
    'taintface', 'taintlicker',
    'twat', 'tw4t', 'twatface', 'twatwaffle',
    'buttmunch', 'buttface', 'buttwipe', 'buttsniffer',
    'ballsucker', 'ballface', 'balllicker',
    'nutjob', 'nutcase', 'nutsack',
    'skankface', 'slutbag', 'slutface',
    'whorebag', 'whoreface', 'whorehouse',
    'jizz', 'jizzface', 'jizzbag',
    'spunk', 'spunkface',
    'queef', 'queefface',
    'turdface', 'turdburger', 'turdburglar',
    'poopface', 'poophead', 'poopstain',
    'pissface', 'pisshead', 'pissbag',

    // ===== THINGS SNEAKY PEOPLE TRY =====
    'xvideos', 'xhamster', 'pornhub', 'redtube', 'youporn',
    'onlyfan', 'fansonly',
    'admin', 'administrator', 'moderator', 'mod', // prevent impersonation
    'support', 'helpdesk',
    'official', 'territorycapture', 'territory_capture',
];

// ========== AGGRESSIVE LEET SPEAK NORMALIZER ==========
// Converts every known character substitution to its letter equivalent.
// Runs BEFORE the blocklist check to catch all variations.
const normalizeLeetSpeak = (str) => {
    return str
        .toLowerCase()
        // Numbers → letters
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/2/g, 'z')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/6/g, 'g')
        .replace(/7/g, 't')
        .replace(/8/g, 'b')
        .replace(/9/g, 'g')
        // Symbols → letters
        .replace(/@/g, 'a')
        .replace(/\$/g, 's')
        .replace(/!/g, 'i')
        .replace(/\+/g, 't')
        .replace(/\|/g, 'i')
        .replace(/\(/g, 'c')
        .replace(/\)/g, 'o')
        .replace(/\[/g, 'l')
        .replace(/\]/g, 'i')
        .replace(/\{/g, 'c')
        .replace(/\}/g, 'o')
        // Common letter substitutions
        .replace(/ph/g, 'f')     // phuck → fuck
        .replace(/ck/g, 'k')     // fvck → fvk (then normalized)
        .replace(/vv/g, 'w')     // vvhore → whore
        .replace(/x/g, 'ks')     // not always but helps
        .replace(/z/g, 's');     // slutz → slut
};

// ========== MAIN CHECK ==========
// Checks both original and normalized versions for any blocked word.
// Uses substring matching so 'fuckboy' is caught by 'fuck' in the list.
const isProfane = (username) => {
    if (!username) return false;

    const original = username.toLowerCase();
    const normalized = normalizeLeetSpeak(username);

    return BLOCKLIST.some(word =>
        original.includes(word) || normalized.includes(word)
    );
};

// ========== VALIDATE USERNAME ==========
// Single entry point for all username validation.
// Returns { valid: true } or { valid: false, message: String }
const validateUsername = (username) => {
    if (!username) {
        return { valid: false, message: 'Username is required' };
    }

    // Letters and numbers only, must start with a letter, 3-20 chars
    const formatRegex = /^[a-zA-Z][a-zA-Z0-9]{2,19}$/;
    if (!formatRegex.test(username)) {
        return {
            valid: false,
            message: 'Username must be 3-20 characters, letters and numbers only, and start with a letter'
        };
    }

    if (isProfane(username)) {
        return {
            valid: false,
            message: 'That username is not allowed. Please choose a different one.'
        };
    }

    return { valid: true };
};

module.exports = { validateUsername, isProfane };