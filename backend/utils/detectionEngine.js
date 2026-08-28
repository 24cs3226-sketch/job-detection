// ============================================
// Detection Engine - Rule-Based Fake Job Detector
// ============================================
// This is the "brain" of the project. It scans job/internship
// text against a list of red-flag keywords (fetched from DB),
// checks for suspicious patterns (regex), and checks the
// company name against the known_companies safety table.
// It returns a risk score (0-100) and a final verdict.

const pool = require('../config/db');

// ---------- Pattern-based checks (not just keywords) ----------
const patternChecks = [
    {
        name: 'Asks for money/payment',
        regex: /(pay|payment|fee|deposit|transfer)\s*(of)?\s*(rs\.?|inr|₹|\$)?\s*\d+/i,
        weight: 30,
        category: 'payment'
    },
    {
        name: 'Suspiciously high salary for entry level',
        regex: /(earn|salary|income)\s*(upto|up to)?\s*(rs\.?|inr|₹)?\s*[1-9]\d{1,2},?\d{3,}\s*(per day|\/day|daily)/i,
        weight: 25,
        category: 'salary'
    },
    {
        name: 'Personal email domain used for hiring (gmail/yahoo)',
        regex: /[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|rediffmail)\.com/i,
        weight: 12,
        category: 'email'
    },
    {
        name: 'Shortened/suspicious link',
        regex: /(bit\.ly|tinyurl\.com|cutt\.ly|shorturl)/i,
        weight: 18,
        category: 'link'
    },
    {
        name: 'Asks for bank/Aadhar/OTP details',
        regex: /(aadhar|aadhaar|otp|bank account|ifsc|cvv|debit card|credit card)/i,
        weight: 28,
        category: 'document'
    },
    {
        name: 'Excessive exclamation / urgency tone',
        regex: /(!{2,}|hurry|act now|limited time|limited seats|urgent(ly)? (hiring|required))/i,
        weight: 10,
        category: 'urgency'
    },
    {
        name: 'No interview / instant selection claim',
        regex: /(no interview|without interview|directly selected|guaranteed selection|100%\s*job)/i,
        weight: 20,
        category: 'process'
    },
    {
        name: 'Contact only via WhatsApp/Telegram',
        regex: /(whatsapp\s*(only|number)?|telegram\s*(only|group|channel)?)\s*[:\-]?\s*(\+?\d{10,13})?/i,
        weight: 14,
        category: 'contact'
    }
];

// ---------- Helper: fetch keywords from DB ----------
async function getKeywords() {
    try {
        const [rows] = await pool.query('SELECT keyword, category, weight FROM red_flag_keywords');
        return rows;
    } catch (err) {
        console.error('Error fetching keywords, using fallback list:', err.message);
        // fallback hardcoded list in case DB is down
        return [
            { keyword: 'registration fee', category: 'payment', weight: 25 },
            { keyword: 'processing fee', category: 'payment', weight: 25 },
            { keyword: 'security deposit', category: 'payment', weight: 25 },
            { keyword: 'send money', category: 'payment', weight: 30 },
            { keyword: 'urgent hiring', category: 'urgency', weight: 10 },
            { keyword: 'no experience needed earn lakhs', category: 'process', weight: 20 }
        ];
    }
}

// ---------- Helper: check company name against safety DB ----------
async function checkCompanySafety(text) {
    try {
        const [companies] = await pool.query('SELECT company_name, official_domain, status, notes FROM known_companies');

        const lowerText = text.toLowerCase();
        for (const c of companies) {
            if (lowerText.includes(c.company_name.toLowerCase())) {
                return {
                    matched: true,
                    company_name: c.company_name,
                    status: c.status,
                    official_domain: c.official_domain,
                    notes: c.notes
                };
            }
        }
        return { matched: false, company_name: null, status: 'unknown', official_domain: null, notes: null };
    } catch (err) {
        console.error('Error checking company safety:', err.message);
        return { matched: false, company_name: null, status: 'unknown', official_domain: null, notes: null };
    }
}

// ---------- Helper: extract a possible company name (very simple heuristic) ----------
function extractCompanyGuess(text) {
    // Looks for patterns like "at XYZ Pvt Ltd" or "Company: XYZ"
    const patterns = [
        /company\s*[:\-]\s*([A-Za-z0-9&.,\s]{2,50})/i,
        /at\s+([A-Z][A-Za-z0-9&.\s]{2,40}(Pvt Ltd|Ltd|LLP|Inc|Technologies|Solutions|Corp)?)/,
        /hiring\s+(for)?\s*([A-Z][A-Za-z0-9&.\s]{2,40})/
    ];
    for (const p of patterns) {
        const match = text.match(p);
        if (match) {
            return (match[1] || match[2] || '').trim();
        }
    }
    return null;
}

// ---------- MAIN FUNCTION: analyze text and return verdict ----------
async function analyzeJobText(rawText) {
    const text = rawText || '';
    const lowerText = text.toLowerCase();

    let score = 0;
    const matchedFlags = [];

    // 1. Keyword-based scoring (from DB)
    const keywords = await getKeywords();
    for (const k of keywords) {
        if (lowerText.includes(k.keyword.toLowerCase())) {
            score += k.weight;
            matchedFlags.push({
                type: 'keyword',
                match: k.keyword,
                category: k.category,
                weight: k.weight
            });
        }
    }

    // 2. Pattern-based scoring (regex)
    for (const p of patternChecks) {
        if (p.regex.test(text)) {
            score += p.weight;
            matchedFlags.push({
                type: 'pattern',
                match: p.name,
                category: p.category,
                weight: p.weight
            });
        }
    }

    // 3. Company safety cross-check
    const companyInfo = await checkCompanySafety(text);
    if (companyInfo.matched) {
        if (companyInfo.status === 'blacklisted') {
            score += 55;
            matchedFlags.push({
                type: 'company',
                match: `${companyInfo.company_name} is BLACKLISTED`,
                category: 'company_safety',
                weight: 55
            });
        } else if (companyInfo.status === 'trusted') {
            score -= 20; // reduce risk if it's a verified trusted company
            matchedFlags.push({
                type: 'company',
                match: `${companyInfo.company_name} is a VERIFIED trusted company`,
                category: 'company_safety',
                weight: -20
            });
        }
    } else {
        // unknown company adds a small risk since it can't be verified
        score += 5;
    }

    // 4. Text length sanity check - extremely short posts are often scams
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 15) {
        score += 10;
        matchedFlags.push({
            type: 'structure',
            match: 'Very short job description (lacks detail)',
            category: 'structure',
            weight: 10
        });
    }

    // Clamp score between 0-100
    score = Math.max(0, Math.min(100, score));

    // 5. Determine verdict based on final score
    let verdict;
    if (score >= 50) {
        verdict = 'FAKE';
    } else if (score >= 25) {
        verdict = 'SUSPICIOUS';
    } else {
        verdict = 'REAL';
    }

    const companyGuess = extractCompanyGuess(text);

    return {
        risk_score: score,
        verdict,
        matched_flags: matchedFlags,
        company_check: companyInfo,
        company_guess: companyGuess,
        word_count: wordCount
    };
}

module.exports = {
    analyzeJobText,
    checkCompanySafety,
    getKeywords
};
