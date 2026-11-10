const AI_SETTINGS_KEY = 'pixel3d-ai-settings';

const SCENE_SYSTEM_PROMPT = `You create scene layouts for Pixel3D. Return only a JSON array. Each item must be one of:
{"type":"shape","shapeType":"box"|"sphere"|"cone"|"cylinder"|"pyramid"|"plane"|"torus","position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1},"color":"#hex"}
{"type":"figure","gender":"male"|"female","position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":1,"y":1,"z":1}}
{"type":"light","lightType":"point"|"spot"|"directional","position":{"x":0,"y":0,"z":0},"color":"#hex","intensity":1}
Use sensible positions and scales; place objects on or above the floor. Do not include markdown or explanation.`;

const DEFAULTS = {
    provider: 'gemini',
    openrouterFallbackEnabled: false,
    gemini: { apiKey: '', model: 'gemini-3.8-flash' },
    openai: { apiKey: '', model: 'gpt-4.1-mini' },
    claude: { apiKey: '', model: 'claude-sonnet-5' },
    openrouter: { apiKey: '', model: 'openrouter/auto' }
};

export class GeminiManager {
    constructor(app) {
        this.app = app;
        this.settings = this.loadSettings();
    }

    loadSettings() {
        try {
            const stored = JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) || '{}');
            const settings = { ...DEFAULTS, ...stored };
            for (const provider of ['gemini', 'openai', 'claude', 'openrouter']) {
                settings[provider] = { ...DEFAULTS[provider], ...(stored[provider] || {}) };
            }
            if (!DEFAULTS[settings.provider]) settings.provider = DEFAULTS.provider;
            settings.openrouterFallbackEnabled = stored.openrouterFallbackEnabled === true;
            return settings;
        } catch {
            return JSON.parse(JSON.stringify(DEFAULTS));
        }
    }

    saveSettings(settings) {
        const provider = DEFAULTS[settings.provider] ? settings.provider : DEFAULTS.provider;
        this.settings = { ...DEFAULTS, ...settings, provider };
        for (const name of ['gemini', 'openai', 'claude', 'openrouter']) {
            this.settings[name] = { ...DEFAULTS[name], ...(settings[name] || {}) };
        }
        this.settings.openrouterFallbackEnabled = settings.openrouterFallbackEnabled === true;
        localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(this.settings));
    }

    get activeProvider() { return this.settings.provider; }

    async generateScene(description) {
        const text = await this.request(`Generate a 3D scene layout for: ${description}`, SCENE_SYSTEM_PROMPT);
        const parsed = this.parseJSON(text);
        const items = Array.isArray(parsed) ? parsed : parsed?.objects;
        if (!Array.isArray(items) || items.length > 300) throw new Error('The AI response was not a valid scene array.');
        return items.map((item, index) => this.validateSceneItem(item, index));
    }

    async generateMaterialColor(description) {
        const text = await this.request(`Return one hex color for this material or mood: ${description}`, 'Return only a six-digit hex color such as #FF0000.');
        const color = text.trim().match(/#[0-9a-fA-F]{6}\b/)?.[0];
        if (!color) throw new Error('The AI did not return a valid hex color.');
        return color;
    }

    async request(userText, systemText) {
        const primaryProvider = this.settings.provider;
        const primaryConfig = this.settings[primaryProvider];
        if (!primaryConfig?.apiKey?.trim()) throw new Error(`Add your ${this.providerLabel(primaryProvider)} API key in Settings → AI first.`);
        if (!primaryConfig?.model?.trim()) throw new Error('Enter a model name in Settings → AI.');

        try {
            const text = await this.requestWithProvider(primaryProvider, userText, systemText);
            this.lastUsedProvider = primaryProvider;
            this.lastUsedModel = primaryConfig.model.trim();
            return text;
        } catch (primaryError) {
            if (primaryProvider !== 'openrouter' || !this.settings.openrouterFallbackEnabled || !this.isRetryableProviderError(primaryError)) {
                throw primaryError;
            }

            const freeModels = await this.getOpenRouterFreeModels();
            if (freeModels.length < 2) throw primaryError;
            const currentModel = primaryConfig.model.trim();
            const currentIndex = freeModels.findIndex(model => model.id === currentModel);
            const nextModels = currentIndex < 0
                ? freeModels
                : [...freeModels.slice(currentIndex + 1), ...freeModels.slice(0, currentIndex)];
            const fallbackErrors = [primaryError];

            for (const model of nextModels) {
                try {
                    const text = await this.requestWithProvider('openrouter', userText, systemText, model.id);
                    this.lastUsedProvider = 'openrouter';
                    this.lastUsedModel = model.id;
                    return text;
                } catch (error) {
                    fallbackErrors.push(error);
                    if (!this.isRetryableProviderError(error)) throw error;
                }
            }

            const failures = fallbackErrors.map(error => error.message).join(' | ');
            throw new Error(`OpenRouter and its remaining free models are unavailable. ${failures}`);
        }
    }

    isRetryableProviderError(error) {
        return error instanceof TypeError || [402, 408, 425, 429].includes(error.status) || error.status >= 500;
    }

    async requestWithProvider(provider, userText, systemText, modelOverride = '') {
        const config = this.settings[provider];
        if (!config?.apiKey?.trim()) throw new Error(`Add your ${this.providerLabel(provider)} API key in Settings → AI first.`);
        const model = modelOverride || config.model.trim();
        if (!model) throw new Error('Enter a model name in Settings → AI.');

        let response;
        if (provider === 'gemini') {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemInstruction: { parts: [{ text: systemText }] }, contents: [{ parts: [{ text: userText }] }] })
            });
        } else {
            const isClaude = provider === 'claude';
            // Accept either the raw key or a copied "Bearer <key>" value.
            const apiKey = config.apiKey.trim().replace(/^Bearer\s+/i, '');
            const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions'
                : isClaude ? 'https://api.anthropic.com/v1/messages' : 'https://openrouter.ai/api/v1/chat/completions';
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
            let body;
            if (isClaude) {
                headers['x-api-key'] = apiKey;
                headers['anthropic-version'] = '2023-06-01';
                headers['anthropic-dangerous-direct-browser-access'] = 'true';
                delete headers.Authorization;
                body = { model, max_tokens: 2048, system: systemText, messages: [{ role: 'user', content: userText }] };
            } else {
                if (provider === 'openrouter') headers['X-OpenRouter-Title'] = 'Pixel3D';
                body = { model, messages: [{ role: 'system', content: systemText }, { role: 'user', content: userText }], temperature: 0.2 };
            }
            response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
        }

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = result.error?.message || result.message || `HTTP ${response.status}`;
            const error = new Error(`${this.providerLabel(provider)} request failed: ${detail}`);
            error.status = response.status;
            throw error;
        }
        const text = provider === 'gemini' ? result.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('')
            : provider === 'claude' ? result.content?.filter(p => p.type === 'text').map(p => p.text).join('')
                : result.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error('The AI provider returned an empty response.');
        return text;
    }

    async getOpenRouterFreeModels() {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Could not load OpenRouter's free model list (HTTP ${response.status}).`);
        return (Array.isArray(data.data) ? data.data : [])
            .filter(model => Number(model.pricing?.prompt) === 0 && Number(model.pricing?.completion) === 0 && typeof model.id === 'string')
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    parseJSON(text) {
        const cleaned = text.replace(/```(?:json)?/gi, '').trim();
        const start = cleaned.indexOf('[');
        const objectStart = cleaned.indexOf('{');
        const first = start < 0 ? objectStart : objectStart < 0 ? start : Math.min(start, objectStart);
        const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
        if (first < 0 || end < first) throw new Error('The AI response did not contain JSON.');
        return JSON.parse(cleaned.slice(first, end + 1));
    }

    validateSceneItem(item, index) {
        const fail = () => { throw new Error(`AI scene item ${index + 1} is invalid.`); };
        if (!item || typeof item !== 'object' || !['shape', 'figure', 'light'].includes(item.type)) fail();
        const allowedShapes = ['box', 'sphere', 'cone', 'cylinder', 'pyramid', 'plane', 'torus'];
        if (item.type === 'shape' && !allowedShapes.includes(item.shapeType)) fail();
        if (item.type === 'figure' && !['male', 'female'].includes(item.gender)) fail();
        if (item.type === 'light' && !['point', 'spot', 'directional'].includes(item.lightType)) fail();
        for (const key of ['position', 'rotation', 'scale']) {
            if (item[key] !== undefined && (!item[key] || !['x', 'y', 'z'].every(axis => Number.isFinite(Number(item[key][axis]))))) fail();
        }
        if (item.color && !/^#[0-9a-fA-F]{6}$/.test(item.color)) fail();
        return item;
    }

    providerLabel(provider) {
        return ({ gemini: 'Gemini', openai: 'OpenAI', claude: 'Claude', openrouter: 'OpenRouter' })[provider] || 'AI';
    }
}
