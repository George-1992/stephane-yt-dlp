const { getTokensCost } = require("./tokenizer");

const API_KEY =  env.process.OPENAI_API_KEY || '';


async function askChatGpt({
    messages,
    apiKey = API_KEY,
    model = 'gpt-5-nano',
    // maxTokens = 40000,
    max_completion_tokens,
}) {

    let resObj = {
        success: false,
        message: '',
        data: null,
        stat: Date.now(),
        end: Date.now(),
        time: 0
    };

    if (!messages || (Array.isArray(messages) && messages.length === 0)) {
        resObj.message = 'Messages are required';
        return resObj;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: messages,
                // max_tokens: maxTokens,
                // max_completion_tokens,
                // temperature: 0, // deterministic output
            }),
        });
        resObj.end = Date.now();
        resObj.time = resObj.end - resObj.stat;

        if (!response.ok) {
            const errorText = await response.text();
            resObj.message = `OpenAI API error: ${response.status} ${errorText}`;
            return resObj;
        }


        const data = await response.json();
        const usage = data.usage || {};
        resObj.success = true;
        resObj.data = data;

        // calculate token pricing
        if (usage && usage.total_tokens) {
            const priceRes = getTokensCost([
                {
                    provider: 'openai',
                    model,
                    type: 'input',
                    tokens: usage.prompt_tokens
                },
                {
                    provider: 'openai',
                    model,
                    type: 'output',
                    tokens: usage.completion_tokens
                }
            ]);

            resObj.cost = priceRes;
        }


    } catch (error) {
        resObj.message = `Error: ${error.message}`;
    }
    return resObj;
}


module.exports = { askChatGpt };