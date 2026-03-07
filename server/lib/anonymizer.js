// ============================================
// ANONYMIZER
// Strips PII from raw messages before sending to Groq
// Privacy-first: no real names, emails, or phones go to the AI
// ============================================

// Regex patterns for common PII
const PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(\+?\d{1,4}[-.\s]?)?(\(?\d{1,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g,
    url: /https?:\/\/[^\s]+/g,
    // Common name patterns (capitalized words at start or after "From:", "Hi ", "Dear ")
    greetingName: /(?:Hi|Hey|Hello|Dear|From:?)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g,
};

/**
 * Anonymize a raw message string by replacing PII with placeholders.
 * @param {string} text - The raw message text
 * @returns {{ anonymized: string, replacements: object[] }} - Cleaned text + mapping
 */
export function anonymize(text) {
    if (!text || typeof text !== 'string') {
        return { anonymized: '', replacements: [] };
    }

    let anonymized = text;
    const replacements = [];

    // Replace emails
    anonymized = anonymized.replace(PATTERNS.email, (match) => {
        replacements.push({ type: 'EMAIL', original: match });
        return '[EMAIL]';
    });

    // Replace phone numbers
    anonymized = anonymized.replace(PATTERNS.phone, (match) => {
        // Skip very short matches (likely not phone numbers)
        if (match.replace(/\D/g, '').length < 7) return match;
        replacements.push({ type: 'PHONE', original: match });
        return '[PHONE]';
    });

    // Replace URLs (keep domain for context)
    anonymized = anonymized.replace(PATTERNS.url, (match) => {
        try {
            const domain = new URL(match).hostname;
            replacements.push({ type: 'URL', original: match });
            return `[LINK:${domain}]`;
        } catch {
            return match;
        }
    });

    // Replace names in greeting patterns
    anonymized = anonymized.replace(PATTERNS.greetingName, (match, name) => {
        replacements.push({ type: 'PERSON', original: name });
        return match.replace(name, '[PERSON]');
    });

    return { anonymized, replacements };
}

/**
 * De-anonymize text by restoring original values.
 * Useful for storing the final result with real references.
 * @param {string} text - Anonymized text
 * @param {object[]} replacements - The replacements array from anonymize()
 * @returns {string} - Restored text
 */
export function deanonymize(text, replacements) {
    let restored = text;

    for (const r of replacements) {
        const placeholder = r.type === 'URL'
            ? `[LINK:${new URL(r.original).hostname}]`
            : `[${r.type}]`;
        restored = restored.replace(placeholder, r.original);
    }

    return restored;
}
