import { buildOpenAIEndpoint, getEndpoint } from '../core/api-config.js';
import {
  buildCacheKey,
  readReaderStore,
  resolveTaskApiConfig,
  writeReaderStore
} from '../core/persistence.js';
import { REAL_EXAM_CORPUS, getRelevantCorpus } from '../core/vocabulary.js';

const fetchWithRetry = async (url, options, retries = 5) => {
    const delays = [2000, 4000, 8000, 15000, 20000];
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = errorText;
                try {
                    const errObj = JSON.parse(errorText);
                    errorMsg = errObj.error?.message || errObj.message || errorText;
                } catch(e) {}
                errorMsg = String(errorMsg || "未知请求错误").replace(/\s+/g, " ").trim().slice(0, 240);
                if (response.status === 404) {
                    throw new Error(`模型不存在 (HTTP 404)。请确保模型名称填写正确`);
                }
                if (response.status === 401 || response.status === 403) {
                    throw new Error(`API 密钥无效或未授权 (HTTP ${response.status})。`);
                }
                if (response.status === 400) {
                    throw new Error(`请求被拒绝 (HTTP 400)：${errorMsg}`);
                }
                const err = new Error(`HTTP ${response.status}: ${errorMsg}`);
                err.status = response.status;
                throw err;
            }
            return await response.json();
        } catch (error) {
            console.warn(`API 尝试 ${i + 1} 失败，准备重试:`, error.message);
            if (error.message.includes('API 密钥') || error.message.includes('模型不存在') || error.message.includes('请求被拒绝') || (error.status && error.status >= 400 && error.status < 500 && error.status !== 429)) {
                throw error;
            }
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delays[i]));
        }
    }
};

const getCandidateText = (result) => {
    if (!result || !result.candidates || result.candidates.length === 0) {
        throw new Error("API 未返回有效内容或被限流过滤");
    }
    return result.candidates[0].content.parts[0].text;
};

const callLLM = async (prompt, apiConfig, isJson = false, task = 'analysis') => {
    const normalizedConfig = resolveTaskApiConfig(apiConfig, task);
    const type = normalizedConfig?.apiType || 'gemini';
    const key = normalizedConfig?.key || window.apiKey;
    const cacheKey = await buildCacheKey('llm', prompt, normalizedConfig, { task, isJson });
    const cached = await readReaderStore('ai-cache', cacheKey);
    if (cached) return cached.value;
    let value;

    if (type === 'openai') {
        const endpoint = buildOpenAIEndpoint(normalizedConfig?.baseUrl);
        const payload = {
            model: normalizedConfig?.model || "qwen-plus",
            messages: [{ role: "user", content: prompt }]
        };
        const result = await fetchWithRetry(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(payload)
        });
        if (!result.choices || result.choices.length === 0) throw new Error("OpenAI API 未返回有效内容");
        let text = result.choices[0].message.content;
        value = isJson ? window.safeParseJSON(text) : text.trim();
    } else {
        const endpoint = getEndpoint(normalizedConfig);
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const result = await fetchWithRetry(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let text = getCandidateText(result);
        value = isJson ? window.safeParseJSON(text) : text.trim();
    }
    await writeReaderStore('ai-cache', { key: cacheKey, value, createdAt: Date.now(), task });
    return value;
};

const callGeminiFullTranslation = async (fullText, apiConfig) => {
    const prompt = `你是一名深谙政经语境的高级翻译官。请将以下英文文章逐段精翻成中文。
要求：
1. 必须符合中文新闻语感，精准翻译政经/法律术语。
2. 绝对保持与原文完全一致的段落数量。段落与段落之间使用双换行符严格分隔，绝不能合并段落！
3. 仅输出纯中文译文，绝不附加任何开场白、解析或多余的标点。
原文：\n"${fullText}"`;
    return await callLLM(prompt, apiConfig, false);
};

const callGeminiTranslation = async (text, apiConfig) => {
    const prompt = `你是一名深谙政经语境的高级翻译官。请精翻以下段落：\n要求：符合中文新闻语感，精准翻译政经/法律术语。仅输出纯中文译文，绝不附加任何解析。\n原文：\n"${text}"`;
    return await callLLM(prompt, apiConfig, false);
};

const callGeminiWordDisambiguation = async (word, context, rawMeaning, apiConfig) => {
    const prompt = `词汇 "${word}" 在字典中的基础释义有：【${rawMeaning}】。
请结合以下原句语境，分析该词在句中的词性，并指出它在此处**最准确的一个中文意思**。请简明扼要陈述理由（50字以内）。
原句："${context}"`;
    return await callLLM(prompt, apiConfig, false);
};

const callGeminiIntensiveAnalysis = async (text, apiConfig) => {
    const miniCorpus = getRelevantCorpus(text, REAL_EXAM_CORPUS, 40);
    const prompt = `你是一位考研英语名师。请提取以下段落中所有具有考研语法拆解价值的长难句。
对每一个提取出的长难句：
1. 必须一字不差地摘录原文中的这句长难句作为 originalSentence（不得增删任何标点和空格，必须是原文的完整原句）。
2. 将该句按语法群切片(chunks)。注意：切片内容拼接起来必须与 originalSentence 完全一致！【核心警告】：标注属性(type)严格且只能从以下5个词中选择："主干", "非谓语动词", "介词短语", "从句", "其他"。绝对不允许创造新词！
3. 提供该句型的考研作文实战应用指南(writingTip)。保留你最擅长的模板化写作技巧和句型框架。
4. 核心语法点分析（双轨对比）：
   - 必须基于该句的核心语法点，生成一个【🤖 AI 模拟例句】(aiExample)。
   - 【绝对指令 - 真题原句追踪】(realExamMatch)：你必须扫描下方的《真题语料库》，挑选出一个语法结构最相似的原句作为匹配项。

《真题语料库》：
${JSON.stringify(miniCorpus, null, 2)}

待解析段落：\n"${text}"

务必以纯正的 JSON 格式输出，包含以下结构：
{
  "hasComplexSentence": true,
  "complexSentences": [
    {
      "originalSentence": "...",
      "chunks": [{"text": "...", "type": "主干/非谓语动词/介词短语/从句/其他"}],
      "sentenceTranslation": "...",
      "writingTip": "...",
      "aiExample": {"sentence": "...", "translation": "..."},
      "realExamMatch": {"sentence": "...", "translation": "...", "source": "..."}
    }
  ]
}
只输出 JSON 字符串，不要有多余的标记。`;
    return await callLLM(prompt, apiConfig, true);
};

const callGeminiReadingAnalysis = async (text, apiConfig) => {
    const prompt = `你是一名“考研英语阅读命题专家”。请对以下全文文本进行全局分析：
1. 指代分析：明确贯穿全文的核心指代词。
2. 逻辑结构拆解：给这篇文章打上“逻辑标签”并说明论述展开过程。
3. 同义替换映射：列出原文核心关键词及考研等价替换。
4. 选项陷阱识别：预判命题人陷阱。
5. 核心主旨：一句话还原真实意思。

待解析文本：\n"${text}"

务必以纯正的 JSON 格式输出，包含以下结构：
{
  "referenceAnalysis": ["...", "..."],
  "logicalStructure": "...",
  "synonymMapping": [{"keyword": "...", "replacement": "..."}],
  "trapIdentification": "...",
  "coreMeaning": "..."
}
只输出 JSON 字符串，不要有多余的标记。`;
    return await callLLM(prompt, apiConfig, true);
};

const callGeminiQuiz = async (text, apiConfig) => {
    const prompt = `根据段落生成一道考研英语阅读理解单项选择题（全英文选项，带解析）：\n"${text}"

务必以纯正的 JSON 格式输出，包含以下结构：
{
  "questionEn": "...",
  "questionZh": "...",
  "options": [
    {"id": "A", "textEn": "...", "textZh": "..."},
    {"id": "B", "textEn": "...", "textZh": "..."},
    {"id": "C", "textEn": "...", "textZh": "..."},
    {"id": "D", "textEn": "...", "textZh": "..."}
  ],
  "correctAnswerId": "A",
  "analysis": "..."
}
只输出 JSON 字符串，不要有多余的标记。`;
    return await callLLM(prompt, apiConfig, true);
};

const normalizeQuizQuestions = (quizData) => {
    if (!quizData) return [];
    if (Array.isArray(quizData)) return quizData.filter(Boolean);
    if (Array.isArray(quizData.questions)) return quizData.questions.filter(Boolean);
    if (quizData.questionEn || quizData.options) return [quizData];
    return [];
};

const callGeminiFullQuiz = async (text, apiConfig) => {
    const prompt = `你是一名考研英语阅读命题专家。请根据以下完整文章生成恰好3道单项选择题。
题目要求：
1. 第1题考查全文主旨或作者观点。
2. 第2题考查重要细节、推断或逻辑关系。
3. 第3题考查语境词义、作者态度或写作目的。
4. 每题必须有A-D四个英文选项，干扰项要符合考研命题方式。
5. questionZh、选项中文和analysis用于用户提交答案后显示，不能在题干中泄露答案。
6. 三题答案不应全部相同。

文章：
"${text}"

只输出纯JSON，结构必须为：
{
  "questions": [
    {
      "id": "Q1",
      "questionEn": "...",
      "questionZh": "...",
      "options": [
{"id": "A", "textEn": "...", "textZh": "..."},
{"id": "B", "textEn": "...", "textZh": "..."},
{"id": "C", "textEn": "...", "textZh": "..."},
{"id": "D", "textEn": "...", "textZh": "..."}
      ],
      "correctAnswerId": "A",
      "analysis": "..."
    }
  ]
}`;
    const result = await callLLM(prompt, apiConfig, true);
    const questions = normalizeQuizQuestions(result).slice(0, 3);
    if (questions.length !== 3) throw new Error(`全文练习应返回3题，实际返回${questions.length}题`);
    return { questions };
};

const callGeminiSummary = async (fullText, apiConfig) => {
    const prompt = `提取外刊文章核心主旨，构建3层深度的中英双语逻辑树。直接输出JSON：
{
  "mindmap": {
    "nameEn": "Core topic English",
    "nameZh": "核心议题中文",
    "children": [{"nameEn": "...", "nameZh": "...", "children": []}]
  }
}
原文：\n${fullText}`;
    return await callLLM(prompt, apiConfig, true);
};

const callGeminiTTS = async (text, apiConfig) => {
    const normalizedConfig = resolveTaskApiConfig(apiConfig, 'tts');
    const cacheKey = await buildCacheKey('tts', text, normalizedConfig, { voice: 'Aoede' });
    const cached = await readReaderStore('tts-cache', cacheKey);
    if (cached?.blob) return URL.createObjectURL(cached.blob);
    const endpoint = getEndpoint(normalizedConfig, true);
    const payload = {
        contents: [{ parts: [{ text: `Please read clearly: ${text}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } } },
    };
    const result = await fetchWithRetry(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const base64PCM = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64PCM) throw new Error("API 未返回有效音频数据");
    const audioUrl = createWavFileFromPCM(base64PCM, 24000);
    try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        await writeReaderStore('tts-cache', { key: cacheKey, blob, createdAt: Date.now() });
    } catch (error) {
        console.warn('TTS cache save failed');
    }
    const stored = await readReaderStore('tts-cache', cacheKey);
    if (stored?.blob) {
        URL.revokeObjectURL(audioUrl);
        return URL.createObjectURL(stored.blob);
    }
    return audioUrl;
};

const createWavFileFromPCM = (base64PCM, sampleRate = 24000) => {
    const binaryString = window.atob(base64PCM);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const buffer = bytes.buffer;
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const writeString = (view, offset, string) => { for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); };
    writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + buffer.byteLength, true); writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeString(view, 36, 'data'); view.setUint32(40, buffer.byteLength, true);
    const blob = new Blob([wavHeader, buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
};

const extractTextFromMedia = async (base64Data, mimeType, apiConfig) => {
    const prompt = "Extract English text accurately. CRITICAL: Fix physical line breaks mid-sentence so paragraphs are continuous. Separate different paragraphs with double newlines strictly. Output ONLY the English text.";
    const normalizedConfig = resolveTaskApiConfig(apiConfig, 'ocr');
    const type = normalizedConfig?.apiType || 'gemini';

    if (type === 'openai') {
        const result = await fetchWithRetry(buildOpenAIEndpoint(normalizedConfig.baseUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${normalizedConfig.key || window.apiKey}` },
            body: JSON.stringify({
                model: normalizedConfig.model || "qwen-plus",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                    ]
                }]
            })
        });
        const text = result.choices?.[0]?.message?.content;
        if (!text) throw new Error("OpenAI 兼容接口未返回有效内容");
        return text.replace(/(?<!\n)\n(?!\n)/g, ' ');
    }

    const result = await fetchWithRetry(getEndpoint(normalizedConfig), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }] })
    });
    return getCandidateText(result).replace(/(?<!\n)\n(?!\n)/g, ' ');
};

export {
  callLLM,
  callGeminiFullTranslation,
  callGeminiTranslation,
  callGeminiWordDisambiguation,
  callGeminiIntensiveAnalysis,
  callGeminiReadingAnalysis,
  callGeminiQuiz,
  normalizeQuizQuestions,
  callGeminiFullQuiz,
  callGeminiSummary,
  callGeminiTTS,
  extractTextFromMedia
};
