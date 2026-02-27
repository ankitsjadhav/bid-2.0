'use server';

import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function parseRfqAction(text: string) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an AI assistant that extracts structured data from a contractor's free-text Request for Quote (RFQ). 
          You must return ONLY a raw JSON string parsing the request. 
          Use this exact schema:
          {
            "category": "String (e.g. Lumber, Plumbing, Electrical, Windows, Concrete, HVAC, Roofing, General Construction. Infer if not explicit.)",
            "items": [
              { "name": "String", "quantity": "String or Number", "unit": "String" }
            ],
            "delivery": {
              "city": "String",
              "zip": "String"
            },
            "neededBy": "String (Date or 'ASAP')",
            "clarifyingQuestions": ["Array of Strings asking for missing critical information if any"]
          }
          Do not include any markdown backticks \`\`\`json or \`\`\`. Output raw JSON only.`
                },
                {
                    role: "user",
                    content: text,
                },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            max_tokens: 1024,
        });

        let resultText = completion.choices[0]?.message?.content || "";

        // Cleanup any markdown if the model hallucinated it
        resultText = resultText.replace(/```json/gi, "").replace(/```/g, "").trim();

        try {
            const parsedData = JSON.parse(resultText);

            // Normalize exactly as the backend expects to prevent matching drift
            if (parsedData.category) {
                parsedData.category = parsedData.category.trim().toLowerCase();
            }
            if (parsedData.delivery && parsedData.delivery.city) {
                parsedData.delivery.city = parsedData.delivery.city.trim().toLowerCase();
            }

            return { success: true, data: parsedData };
        } catch (parseError) {
            console.warn("Standard JSON parse failed, attempting strict brace extraction.");

            const firstBrace = resultText.indexOf('{');
            const lastBrace = resultText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                try {
                    const jsonString = resultText.substring(firstBrace, lastBrace + 1);
                    const parsedDataFallback = JSON.parse(jsonString);

                    if (parsedDataFallback.category) {
                        parsedDataFallback.category = parsedDataFallback.category.trim().toLowerCase();
                    }
                    if (parsedDataFallback.delivery && parsedDataFallback.delivery.city) {
                        parsedDataFallback.delivery.city = parsedDataFallback.delivery.city.trim().toLowerCase();
                    }

                    return { success: true, data: parsedDataFallback };
                } catch (sliceError) {
                    throw new Error("Could not parse JSON even after string slice extraction.");
                }
            }
            throw new Error("Invalid output format returned by AI.");
        }

    } catch (error: any) {
        console.error("Groq parsing error:", error);
        return { success: false, error: error.message || "Failed to parse RFQ" };
    }
}
