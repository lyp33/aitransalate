// AI智能翻译助手 - Background Service Worker

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslateRequest(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开启以支持异步响应
  } else if (request.action === 'getErrorSuggestion') {
    handleErrorSuggestionRequest(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 处理翻译请求
async function handleTranslateRequest(request) {
  const { text, sourceLang, targetLang } = request;

  console.log('[Background] 收到翻译请求');
  console.log('[Background] 原文:', text);
  console.log('[Background] 源语言:', sourceLang, '目标语言:', targetLang);

  try {
    // 获取存储的API配置
    const result = await chrome.storage.sync.get(['translateConfig']);
    const config = result.translateConfig?.apiConfig;

    if (!config || !config.url || !config.token) {
      return {
        success: false,
        error: 'API配置未设置，请在插件设置中配置'
      };
    }

    // 调用翻译API
    const translation = await callTranslationAPI(text, sourceLang, targetLang, config);

    console.log('[Background] 翻译成功，结果:', translation);
    console.log('[Background] 翻译结果原始值:', JSON.stringify(translation));

    return {
      success: true,
      translation: translation
    };
  } catch (error) {
    console.error('[Background] 翻译请求失败:', error);
    return {
      success: false,
      error: error.message || '翻译请求失败'
    };
  }
}

// 处理错误建议请求
async function handleErrorSuggestionRequest(request) {
  const { errorMessage } = request;

  try {
    // 获取存储的API配置
    const result = await chrome.storage.sync.get(['translateConfig']);
    const config = result.translateConfig?.apiConfig;

    if (!config || !config.url || !config.token) {
      return {
        success: false,
        error: 'API配置未设置'
      };
    }

    // 调用AI API获取错误建议
    const suggestion = await getErrorSuggestion(errorMessage, config);

    return {
      success: true,
      suggestion: suggestion
    };
  } catch (error) {
    console.error('获取错误建议失败:', error);
    return {
      success: false,
      error: error.message || '获取建议失败'
    };
  }
}

// 调用翻译API - eBao AI QA Service
async function callTranslationAPI(text, sourceLang, targetLang, apiConfig) {
  const { url, token, llm_code = 'qwen-max', temperature = 0.2, timeout = 10000 } = apiConfig;

  // 语言代码映射
  const languageNames = {
    th: '泰文',
    en: '英文',
    ja: '日文',
    ko: '韩文',
    vi: '越南文',
    ru: '俄文',
    zh: '中文',
    ar: '阿拉伯文'
  };

  const sourceLangName = languageNames[sourceLang] || sourceLang;
  const targetLangName = languageNames[targetLang] || targetLang;

  // 构建请求 - 根据eBao API格式
  const requestBody = {
    query: `请将以下${sourceLangName}文本翻译成${targetLangName}，只返回翻译结果，不要添加任何额外的说明、标记或格式：\n\n${text}`,
    messages: [],
    temperature: temperature,
    llm_code: llm_code,
    stream: false
  };

  console.log('[翻译API] 发送请求 - 原文:', text);
  console.log('[翻译API] 发送的query:', requestBody.query);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('[翻译API] 完整响应:', data);
    console.log('[翻译API] 提取的翻译结果 (data.data):', data.data);
    console.log('[翻译API] 翻译结果类型:', typeof data.data);
    console.log('[翻译API] 翻译结果长度:', data.data?.length);

    // 解析响应 - eBao API返回格式为 { "data": "..." }
    if (data.data) {
      return data.data;
    } else {
      throw new Error('API响应格式错误: 未找到data字段');
    }

  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 获取错误建议 - 调用AI API
async function getErrorSuggestion(errorMessage, apiConfig) {
  const { url, token, llm_code = 'qwen-max', temperature = 0.2, timeout = 15000 } = apiConfig;

  // 构建请求
  const requestBody = {
    query: `作为一个技术支持助手，请分析以下错误信息并给出简洁的解决建议（不超过100字）：\n\n${errorMessage}`,
    messages: [],
    temperature: temperature,
    llm_code: llm_code,
    stream: false
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data) {
      return data.data;
    } else {
      throw new Error('API响应格式错误: 未找到data字段');
    }

  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 插件安装时设置默认配置
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(['translateConfig']);
  if (!existing.translateConfig) {
    const defaultConfig = {
      enabled: true,
      sourceLanguages: ['th', 'en'], // 默认检测泰语和英语
      targetLanguage: 'zh', // 翻译为中文
      showOriginal: true,
      debounceTime: 500,
      domainWhitelist: [], // 域名白名单，空表示所有网站
      ignoreNativeTooltips: true, // 忽略有原生tooltip的元素
      apiConfig: {
        url: 'https://portal.insuremo.com/api/mo-re/ai-qa-service/aiqa/api/chat',
        token: '',
        llm_code: 'qwen-max',
        temperature: 0.2,
        timeout: 10000
      }
    };

    await chrome.storage.sync.set({ translateConfig: defaultConfig });
    console.log('默认配置已设置');
  }
});
