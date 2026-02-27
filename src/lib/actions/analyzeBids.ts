'use server';

import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function analyzeBidsAction(structuredData: any, bids: any[]) {
    if (!bids || bids.length === 0) {
        return { success: false, error: "No bids provided for analysis." };
    }

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an expert procurement assistant. Your job is to compare supplier bids against the contractor's Request for Quote (RFQ) requirements and recommend ONE winning bid.
                    
          You must return ONLY a raw JSON string. 
          Use this exact schema:
          {
            "recommendedBidId": "String (the ID of the exact recommended bid)",
            "reasoning": [
              "String (bullet point 1 explaining why)",
              "String (bullet point 2 explaining why)"
            ],
            "riskNote": "String (Optional note about potential risks like longer lead times, missing delivery specs, etc. Keep extremely brief or omit.)"
          }
          Do not include formatting or markdown backticks like \`\`\`json. Output raw JSON only.`
                },
                {
                    role: "user",
                    content: `RFQ Requirements:\n${JSON.stringify(structuredData, null, 2)}\n\nSubmitted Bids:\n${JSON.stringify(bids.map(b => ({ id: b.id, supplierName: b.supplierName, pricing: b.pricing, leadTime: b.leadTime, delivery: b.delivery, notes: b.notes })), null, 2)}`,
                },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            max_tokens: 1024,
        });

        let resultText = completion.choices[0]?.message?.content || "";
        resultText = resultText.replace(/```json/gi, "").replace(/```/g, "").trim();

        try {
            return { success: true, data: JSON.parse(resultText) };
        } catch (parseError) {
            console.warn("Standard JSON parse failed, attempting strict brace extraction.");

            const firstBrace = resultText.indexOf('{');
            const lastBrace = resultText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                try {
                    const jsonString = resultText.substring(firstBrace, lastBrace + 1);
                    return { success: true, data: JSON.parse(jsonString) };
                } catch (sliceError) {
                    throw new Error("Could not parse JSON even after string slice extraction.");
                }
            }
            throw new Error("Invalid output format returned by AI.");
        }

    } catch (error: any) {
        console.error("Groq bid analysis error:", error);
        return { success: false, error: error.message || "Failed to analyze bids" };
    }
}
