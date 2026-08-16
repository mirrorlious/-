const CURRENT_GEMINI_TEXT_MODEL = "gemini-3.5-flash";

const CURRENT_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";

const RETIRED_GEMINI_MODELS = new Set([
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-lite-001"
]);

const normalizeApiConfig = (config = {}) => {
    const normalized = { ...config };
    if ((normalized.apiType || "gemini") === "gemini" && RETIRED_GEMINI_MODELS.has((normalized.model || "").trim().toLowerCase())) {
        normalized.model = CURRENT_GEMINI_TEXT_MODEL;
    }
    return normalized;
};

const buildGeminiEndpoint = (config, model) => {
    const key = config?.key || window.apiKey || "";
    const apiVersion = config?.apiVersion || "v1beta";
    let baseUrl = (config?.baseUrl || "https://generativelanguage.googleapis.com").trim().replace(/\/+$/, "");
    let endpoint;

    if (/:generateContent(?:\?.*)?$/i.test(baseUrl)) {
        endpoint = baseUrl.replace(/(\/models\/)[^/:?]+(:generateContent)/i, `$1${model}$2`);
    } else if (/\/models\/[^/]+$/i.test(baseUrl)) {
        endpoint = `${baseUrl}:generateContent`;
    } else if (/\/models$/i.test(baseUrl)) {
        endpoint = `${baseUrl}/${model}:generateContent`;
    } else if (/\/v1(?:beta|alpha)?$/i.test(baseUrl)) {
        endpoint = `${baseUrl}/models/${model}:generateContent`;
    } else {
        endpoint = `${baseUrl}/${apiVersion}/models/${model}:generateContent`;
    }

    if (key && !/[?&]key=/i.test(endpoint)) {
        endpoint += `${endpoint.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    }
    return endpoint;
};

const buildOpenAIEndpoint = (baseUrl) => {
    const normalized = (baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1").trim().replace(/\/+$/, "");
    return /\/chat\/completions$/i.test(normalized) ? normalized : `${normalized}/chat/completions`;
};

const getEndpoint = (config, isTTS = false) => {
    const normalized = normalizeApiConfig(config);
    const rawModel = isTTS ? CURRENT_GEMINI_TTS_MODEL : (normalized.model || CURRENT_GEMINI_TEXT_MODEL);
    const cleanModel = rawModel.trim().toLowerCase().replace(/\s+/g, '-');
    return buildGeminiEndpoint(normalized, cleanModel);
};

export {
  CURRENT_GEMINI_TEXT_MODEL,
  CURRENT_GEMINI_TTS_MODEL,
  normalizeApiConfig,
  buildOpenAIEndpoint,
  getEndpoint
};
