export const parseModelJSON = (text) => {
    if (typeof text !== 'string') return text;
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            const markdownRegex = new RegExp('`{3}(?:json)?\\s*([\\s\\S]*?)\\s*`{3}', 'i');
            const match = text.match(markdownRegex);
            if (match) return JSON.parse(match[1].trim());

            const objMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (objMatch) return JSON.parse(objMatch[1].trim());
        } catch(err) {}
        throw new Error("JSON 解析彻底失败，数据格式不合规");
    }
};
