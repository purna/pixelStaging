export class GeminiManager {
    constructor(app) {
        this.app = app;
        this.apiKey = ""; // Provided by execution environment
    }

    async generateScene(description) {
        const systemPrompt = `
        You are a 3D scene generator. 
        You MUST output ONLY valid JSON.
        The JSON should be an Array of objects representing a 3D scene.
        
        Available types and properties:
        1. Shapes: { "type": "shape", "shapeType": "box"|"sphere"|"cone"|"cylinder"|"pyramid"|"plane"|"torus", "position": {x,y,z}, "rotation": {x,y,z}, "scale": {x,y,z}, "color": "#hex" }
        2. Figures: { "type": "figure", "gender": "male"|"female", "position": {x,y,z}, "rotation": {x,y,z}, "scale": {x,y,z} }
        3. Lights: { "type": "light", "lightType": "point"|"spot"|"directional", "position": {x,y,z}, "color": "#hex", "intensity": number }

        Rules:
        - Place objects logically based on the description.
        - Default "y" position for shapes/figures should be 0 or 1 to sit on the floor.
        - "plane" is usually the floor, rotate x: -1.57 (approx -90 deg).
        - Do not wrap in markdown code blocks. Return raw JSON string.
        `;

        const userPrompt = `Generate a 3D scene layout for: "${description}"`;

        try {
            const response = await this.callGemini(userPrompt, systemPrompt);
            // Clean response if it includes markdown fencing
            let cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanJson);
            return data;
        } catch (e) {
            console.error("Gemini Scene Generation Error:", e);
            throw e;
        }
    }

    async generateMaterialColor(description) {
        const systemPrompt = `
        You are a color theory expert for 3D materials.
        User will describe a material or mood.
        You MUST output ONLY a hex color code (e.g., #FF0000).
        No text, no json, just the hex code.
        `;

        try {
            const color = await this.callGemini(description, systemPrompt);
            return color.trim();
        } catch (e) {
            console.error("Gemini Color Generation Error:", e);
            return "#ffffff"; // Fallback
        }
    }

    async callGemini(userText, systemText) {
        // Retry logic parameters
        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 1000;

        while (retries <= maxRetries) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${this.apiKey}`;

                const payload = {
                    contents: [{ parts: [{ text: userText }] }],
                    systemInstruction: { parts: [{ text: systemText }] }
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }

                const data = await response.json();

                if (data.candidates && data.candidates.length > 0) {
                    return data.candidates[0].content.parts[0].text;
                } else {
                    throw new Error("No candidates returned");
                }
            } catch (error) {
                retries++;
                if (retries > maxRetries) throw error;
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, retries)));
            }
        }
    }
}