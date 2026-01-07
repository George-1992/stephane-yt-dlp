
const priceList = {
    openai: {
        'gpt-5-nano': {
            input: 0.050, // per 1m tokens
            cached_input: 0.005, // per 1m tokens
            output: 0.400 // per 1m tokens
        },
        'gpt-5-mini': {
            input: 0.250, // per 1m tokens
            cached_input: 0.025, // per 1m tokens
            output: 2.000 // per 1m tokens
        },
        'gpt-5': {
            input: 1.250, // per 1m tokens
            cached_input: 0.125, // per 1m tokens
            output: 10.000 // per 1m tokens
        }
    }
};

function estimateTokens(text, provider = 'openai', model = 'gpt-5-nano') {
    if (!text || typeof text !== 'string') {
        return 0;
    }

    if (provider === 'words') {
        // Simple word-based estimation (1 token ≈ 0.75 words)
        const wordCount = text.trim().split(/\s+/).length;
        return Math.ceil(wordCount / 0.75);
    } else if (provider === 'chars') {
        // Character-based estimation (1 token ≈ 4 characters)
        return Math.ceil(text.length / 4);
    } else if (provider === 'openai') {
        // OpenAI-style estimation (more accurate for GPT models)
        // Accounts for punctuation, special characters, and common patterns
        const cleanText = text.replace(/\s+/g, ' ').trim();
        const wordCountOpenAI = cleanText.split(' ').length;
        const chars = cleanText.length;
        const punctuation = (cleanText.match(/[.,!?;:(){}[\]"'-]/g) || []).length;

        // Weighted estimation based on OpenAI's tokenization patterns
        return Math.ceil((wordCountOpenAI * 1.3) + (chars * 0.25) + (punctuation * 0.1));
    } else if (provider === 'conservative') {
        // Conservative high estimate (safer for API limits)
        const wordsConservative = text.trim().split(/\s+/).length;
        return Math.ceil(wordsConservative * 1.5);
    } else {
        // Default to OpenAI method
        return estimateTokens(text, 'openai');
    }
}

const getTokensCost = (items = [{
    provider: 'openai',
    model: 'gpt-5-nano',
    type: 'input', // input, cached_input, output
    tokens: 0
}]) => {

    // console.log('Token cost details:', items);

    try {
        const allResults = [];

        for (const item of items) {
            if (item.provider && item.model && item.type && item.tokens) {
                const unitPrice = priceList?.[item.provider]?.[item.model]?.[item.type] || 0;
                const cost = (item.tokens / 1000000) * unitPrice;
                allResults.push({ ...item, cost });
            }
        }

        const total = allResults.reduce((sum, curr) => sum + (curr.cost || 0), 0);

        return {
            total, items: allResults
        };
    } catch (error) {
        console.error('Error in getTokensCost:', error);
        return [];
    }
};

const tokenizer = (items) => {
    return items.map(item => {
        const text = item.text || '';
        const provider = item.provider || 'openai';
        const model = item.model || 'gpt-5-nano';
        const tokens = estimateTokens(text, provider, model);


        return {
            ...item,
            tokens
        };
    });
};

module.exports = { tokenizer, estimateTokens, getTokensCost };