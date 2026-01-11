// AI智能翻译助手 - Content Script

(function() {
  'use strict';

  // 状态管理
  let isProcessing = false;
  let tooltipElement = null;
  let hoverTimer = null;
  let config = {
    enabled: true,
    sourceLanguages: ['th', 'en'], // 默认支持泰语、英语
    targetLanguage: 'zh', // 默认翻译为中文
    apiConfig: {
      url: 'https://portal.insuremo.com/api/mo-re/ai-qa-service/aiqa/api/chat',
      token: '',
      llm_code: 'qwen-max',
      temperature: 0.2,
      timeout: 10000
    },
    showOriginal: true, // 是否显示原文
    debounceTime: 500, // 鼠标悬停延迟时间(ms)
    domainWhitelist: [], // 域名白名单
    ignoreNativeTooltips: true // 忽略有原生tooltip的元素
  };

  // 语言检测模式 (使用正则表达式快速检测)
  const languagePatterns = {
    th: /[\u0E00-\u0E7F]/, // 泰语
    en: /[a-zA-Z]/, // 英语
    ja: /[\u3040-\u309F\u30A0-\u30FF]/, // 日语
    ko: /[\uAC00-\uD7AF\u1100-\u11FF]/, // 韩语
    ru: /[\u0400-\u04FF]/, // 俄语
    ar: /[\u0600-\u06FF]/, // 阿拉伯语
    vi: /[\u1EA0-\u1EF9]/, // 越南语
    zh: /[\u4E00-\u9FFF\u3400-\u4DBF]/ // 中文
  };

  // 存储原始title属性
  const originalTitles = new WeakMap();

  // 初始化：从storage加载配置
  function init() {
    chrome.storage.sync.get(['translateConfig'], (result) => {
      if (result.translateConfig) {
        config = { ...config, ...result.translateConfig };
      }
      console.log('翻译助手已加载，配置:', config);
      
      // 先禁用原生tooltips，再设置监听器
      disableNativeTooltips();
      setupMouseListeners();
      
      // 立即扫描页面上已存在的title属性
      document.querySelectorAll('[title]').forEach(element => {
        const title = element.getAttribute('title');
        if (title) {
          originalTitles.set(element, title);
        }
      });
    });
  }

  // 禁用原生tooltip，防止与翻译框冲突
  function disableNativeTooltips() {
    // 使用捕获阶段，更早地拦截事件
    document.addEventListener('mouseover', (event) => {
      const target = event.target;
      if (target.hasAttribute && target.hasAttribute('title')) {
        const title = target.getAttribute('title');
        // 只有当title有值时才处理
        if (title) {
          // 保存原始title
          if (!originalTitles.has(target)) {
            originalTitles.set(target, title);
          }
          // 立即移除title属性，防止原生tooltip显示
          target.setAttribute('data-original-title', title);
          target.removeAttribute('title');
        }
      }
    }, true); // true = 捕获阶段

    document.addEventListener('mouseout', (event) => {
      const target = event.target;
      // 恢复title属性
      if (target.hasAttribute && target.hasAttribute('data-original-title')) {
        const originalTitle = target.getAttribute('data-original-title');
        if (originalTitle) {
          target.setAttribute('title', originalTitle);
          target.removeAttribute('data-original-title');
        }
      }
    }, true);

    // 额外的保护：定期扫描并处理新添加的元素
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('title')) {
            // 对新添加的带title的元素也进行处理
            const title = node.getAttribute('title');
            if (title) {
              originalTitles.set(node, title);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 设置鼠标事件监听
  function setupMouseListeners() {
    // 使用捕获阶段，确保我们的事件先于其他事件处理
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('scroll', hideTooltip, true);
    
    // 监听文本选中事件
    document.addEventListener('mouseup', handleTextSelection, true);
    document.addEventListener('keyup', handleTextSelection, true);
    
    // 额外添加：阻止title属性的默认tooltip行为
    document.addEventListener('mouseenter', (event) => {
      const target = event.target;
      if (target.hasAttribute && target.hasAttribute('title')) {
        const title = target.getAttribute('title');
        if (title && !originalTitles.has(target)) {
          originalTitles.set(target, title);
        }
        target.removeAttribute('title');
      }
    }, true);
  }

  // 鼠标悬停处理
  function handleMouseOver(event) {
    if (!config.enabled || isProcessing) return;

    // 检查当前域名是否在白名单中
    if (!isCurrentDomainAllowed()) {
      return;
    }

    const target = event.target;

    // 排除某些不应该翻译的元素
    if (shouldIgnoreElement(target)) {
      return;
    }

    const text = getTargetText(target);

    if (!text || text.trim().length < 1) return;

    // 清除之前的定时器
    if (hoverTimer) {
      clearTimeout(hoverTimer);
    }

    // 检查是否是错误消息
    const isError = isErrorMessage(target);

    // 设置延迟，避免快速移动鼠标时频繁触发
    hoverTimer = setTimeout(async () => {
      // 检查是否是trace id格式（32位十六进制字符串）
      const traceIdPattern = /^[a-f0-9]{32}$/i;
      const isTraceId = traceIdPattern.test(text.trim());
      
      const detectedLang = detectLanguage(text);
      if (shouldTranslate(detectedLang) || isError || isTraceId) {
        showTooltipAt(event.clientX, event.clientY, isTraceId ? '正在加载...' : '正在翻译...');
        try {
          if (isError) {
            // 处理错误消息：翻译 + AI建议 + 追踪链接
            await handleErrorMessageTranslation(text, detectedLang, target);
          } else {
            // 普通翻译或trace id显示
            await translateText(text, detectedLang);
          }
        } catch (error) {
          console.error('翻译调用失败:', error);
          updateTooltipContent('翻译失败，请重试', true);
        }
      }
    }, config.debounceTime);
  }

  // 鼠标移出处理
  function handleMouseOut(event) {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    // 延迟隐藏，给用户时间移动到tooltip上
    setTimeout(() => {
      if (!isMouseOverTooltip()) {
        hideTooltip();
      }
    }, 300); // 增加延迟时间到300ms
  }

  // 鼠标按下处理（立即隐藏tooltip）
  function handleMouseDown() {
    hideTooltip();
  }

  // 处理文本选中
  async function handleTextSelection(event) {
    if (!config.enabled || isProcessing) return;

    // 检查当前域名是否在白名单中
    if (!isCurrentDomainAllowed()) {
      return;
    }

    // 延迟一点点，确保选中操作完成
    setTimeout(async () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      // 只有当选中的文本长度在合理范围内才翻译
      if (selectedText && selectedText.length > 0 && selectedText.length <= 500) {
        // 清除之前的定时器
        if (hoverTimer) {
          clearTimeout(hoverTimer);
        }

        // 获取选中文本的位置
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 在选中文本附近显示翻译框
        const x = rect.left + rect.width / 2;
        const y = rect.bottom + 5; // 在选中文本下方5px

        // 检测语言并翻译
        const detectedLang = detectLanguage(selectedText);
        // 检查是否是trace id格式
        const traceIdPattern = /^[a-f0-9]{32}$/i;
        const isTraceId = traceIdPattern.test(selectedText.trim());
        
        if (shouldTranslate(detectedLang) || isTraceId) {
          showTooltipAt(x, y, isTraceId ? '正在加载...' : '正在翻译...');
          try {
            await translateText(selectedText, detectedLang);
          } catch (error) {
            console.error('选中文本翻译失败:', error);
            updateTooltipContent('翻译失败，请重试', true);
          }
        }
      }
    }, 100);
  }

  // 检查当前域名是否允许翻译
  function isCurrentDomainAllowed() {
    // 如果白名单为空，允许所有域名
    if (!config.domainWhitelist || config.domainWhitelist.length === 0) {
      return true;
    }

    const currentDomain = window.location.hostname;

    // 检查是否匹配白名单中的任一域名
    return config.domainWhitelist.some(pattern => {
      // 支持通配符 *
      const regexPattern = pattern
        .replace(/\./g, '\\.')  // 转义点号
        .replace(/\*/g, '.*');  // * 转换为 .*
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(currentDomain);
    });
  }

  // 判断是否应该忽略该元素
  function shouldIgnoreElement(element) {
    const tagName = element.tagName;
    
    // 忽略SELECT下拉框
    if (tagName === 'SELECT') {
      return true;
    }

    // 忽略script和style标签
    if (tagName === 'SCRIPT' || tagName === 'STYLE') {
      return true;
    }

    // 忽略已经有我们自己tooltip的元素
    if (element.classList && element.classList.contains('ai-translate-tooltip')) {
      return true;
    }

    return false;
  }

  // 获取目标文本
  function getTargetText(element) {
    // 优先获取保存的原始title（从data-original-title或WeakMap）
    let title = element.getAttribute('data-original-title') || originalTitles.get(element);
    if (title) {
      return title;
    }

    // 获取title属性（如果还存在）
    if (element.getAttribute('title')) {
      return element.getAttribute('title');
    }

    // 获取alt属性
    if (element.getAttribute('alt')) {
      return element.getAttribute('alt');
    }

    // 对于INPUT和TEXTAREA，优先获取value（用户输入的内容）
    const tagName = element.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
      const value = element.value;
      if (value && value.trim()) {
        return value.trim();
      }
      // 如果没有value，获取placeholder
      if (element.getAttribute('placeholder')) {
        return element.getAttribute('placeholder');
      }
    }

    // 获取aria-label属性
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }

    // 获取元素的直接文本内容（不包括子元素）
    let text = '';
    
    // 尝试获取元素的直接文本节点
    for (let node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    
    // 如果没有直接文本节点，获取所有文本内容
    if (!text.trim()) {
      text = element.textContent || '';
    }

    // 清理文本，去除多余空白
    text = text.trim();
    
    // 如果文本太长，只取前500个字符
    return text.substring(0, 500);
  }

  // 语言检测
  function detectLanguage(text) {
    let maxMatch = 0;
    let detectedLang = null;

    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      const matches = (text.match(pattern) || []).length;
      if (matches > maxMatch) {
        maxMatch = matches;
        detectedLang = lang;
      }
    }

    return detectedLang;
  }

  // 判断是否需要翻译
  function shouldTranslate(detectedLang) {
    if (!detectedLang) return false;
    return config.sourceLanguages.includes(detectedLang);
  }

  // 翻译文本（调用AI API）
  async function translateText(text, sourceLang) {
    isProcessing = true;

    try {
      // 检查是否是trace id格式（32位十六进制字符串）
      const traceIdPattern = /^[a-f0-9]{32}$/i;
      if (traceIdPattern.test(text.trim())) {
        // 这是一个trace id，直接显示跳转链接
        const traceId = text.trim();
        const env = extractEnvFromDomain();
        const trackingUrl = `http://localhost:3000/?traceid=${traceId}&env=${env}`;
        
        const displayContent = `🔍 Trace ID: ${traceId}\n\n🔗 点击查看追踪详情：\n${trackingUrl}`;
        updateTooltipContentWithLink(displayContent, trackingUrl);
        return;
      }

      // 检查API配置
      if (!config.apiConfig.url || !config.apiConfig.token) {
        updateTooltipContent('请先在插件设置中配置API', true);
        return;
      }

      // 调用后台脚本处理API请求（避免CORS问题）
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        sourceLang: sourceLang,
        targetLang: config.targetLanguage
      });

      if (response.success) {
        const displayText = config.showOriginal
          ? `${text}\n----------\n${response.translation}`
          : response.translation;
        updateTooltipContent(displayText);
      } else {
        updateTooltipContent(`翻译失败: ${response.error}`, true);
      }
    } catch (error) {
      console.error('翻译错误:', error);
      updateTooltipContent('翻译出错，请重试', true);
    } finally {
      isProcessing = false;
    }
  }

  // 处理错误消息的翻译（包含翻译、AI建议和追踪链接）
  async function handleErrorMessageTranslation(text, sourceLang, element) {
    isProcessing = true;

    try {
      // 检查API配置
      if (!config.apiConfig.url || !config.apiConfig.token) {
        updateTooltipContent('请先在插件设置中配置API', true);
        return;
      }

      // 提取trace id
      const traceId = extractTraceId(text);
      const env = extractEnvFromDomain();

      // 并行请求：翻译 + AI建议
      const [translationResponse, suggestionResponse] = await Promise.all([
        // 翻译请求
        chrome.runtime.sendMessage({
          action: 'translate',
          text: text,
          sourceLang: sourceLang,
          targetLang: config.targetLanguage
        }),
        // AI建议请求
        chrome.runtime.sendMessage({
          action: 'getErrorSuggestion',
          errorMessage: text
        })
      ]);

      // 构建显示内容
      let displayContent = '';

      // 1. 原文（如果配置显示）
      if (config.showOriginal) {
        displayContent += `${text}\n\n`;
      }

      // 2. 翻译
      if (translationResponse.success) {
        displayContent += `📝 翻译：\n${translationResponse.translation}\n\n`;
      }

      // 3. AI建议
      if (suggestionResponse && suggestionResponse.success) {
        displayContent += `💡 AI建议：\n${suggestionResponse.suggestion}\n\n`;
      }

      // 4. 追踪链接
      if (traceId) {
        const trackingUrl = `http://localhost:3000/?traceid=${traceId}&env=${env}`;
        displayContent += `🔗 追踪链接：\n${trackingUrl}`;
        
        // 更新tooltip内容，并添加可点击的链接
        updateTooltipContentWithLink(displayContent, trackingUrl);
      } else {
        updateTooltipContent(displayContent);
      }

    } catch (error) {
      console.error('错误消息处理失败:', error);
      updateTooltipContent('处理错误消息失败，请重试', true);
    } finally {
      isProcessing = false;
    }
  }

  // 显示tooltip
  function showTooltipAt(x, y, content) {
    hideTooltip();

    tooltipElement = document.createElement('div');
    tooltipElement.className = 'ai-translate-tooltip';
    tooltipElement.innerHTML = `
      <div class="tooltip-content">${escapeHtml(content)}</div>
    `;

    // 添加鼠标事件监听，防止tooltip在鼠标悬停时消失
    tooltipElement.addEventListener('mouseenter', () => {
      // 鼠标进入tooltip时，清除可能的隐藏定时器
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
    });

    tooltipElement.addEventListener('mouseleave', () => {
      // 鼠标离开tooltip时，延迟隐藏
      setTimeout(() => {
        hideTooltip();
      }, 200);
    });

    document.body.appendChild(tooltipElement);

    // 计算位置，确保不超出视口
    const rect = tooltipElement.getBoundingClientRect();
    let posX = x + 15;
    let posY = y + 15;

    if (posX + rect.width > window.innerWidth) {
      posX = x - rect.width - 10;
    }
    if (posY + rect.height > window.innerHeight) {
      posY = y - rect.height - 10;
    }

    tooltipElement.style.left = posX + 'px';
    tooltipElement.style.top = posY + 'px';
    tooltipElement.style.opacity = '1';
  }

  // 更新tooltip内容
  function updateTooltipContent(content, isError = false) {
    if (!tooltipElement) return;

    const contentDiv = tooltipElement.querySelector('.tooltip-content');
    if (contentDiv) {
      contentDiv.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
      if (isError) {
        tooltipElement.classList.add('error');
      }
    }
  }

  // 更新tooltip内容（带可点击链接）
  function updateTooltipContentWithLink(content, linkUrl) {
    if (!tooltipElement) return;

    const contentDiv = tooltipElement.querySelector('.tooltip-content');
    if (contentDiv) {
      // 将内容转换为HTML，但保留链接部分
      const parts = content.split(linkUrl);
      let html = escapeHtml(parts[0]).replace(/\n/g, '<br>');
      
      if (parts.length > 1) {
        // 添加可点击的链接
        html += `<a href="${linkUrl}" target="_blank" style="color: #0066cc; text-decoration: underline; cursor: pointer;">${linkUrl}</a>`;
        html += escapeHtml(parts[1]).replace(/\n/g, '<br>');
      }
      
      contentDiv.innerHTML = html;
    }
  }

  // 隐藏tooltip
  function hideTooltip() {
    if (tooltipElement) {
      tooltipElement.style.opacity = '0';
      setTimeout(() => {
        if (tooltipElement && tooltipElement.parentNode) {
          tooltipElement.parentNode.removeChild(tooltipElement);
        }
        tooltipElement = null;
      }, 200);
    }
  }

  // 检查鼠标是否在tooltip上
  function isMouseOverTooltip() {
    return tooltipElement && tooltipElement.matches(':hover');
  }

  // HTML转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 检查是否是错误消息元素
  function isErrorMessage(element) {
    // 检查元素文本内容是否包含trace id模式
    const text = element.textContent || '';
    // 匹配类似 "traceid=xxx" 或 "trace id: xxx" 或包含32位十六进制字符串的模式
    const traceIdPattern = /(?:traceid[=:\s]+|trace\s*id[=:\s]+)?([a-f0-9]{32})/i;
    return traceIdPattern.test(text);
  }

  // 从错误消息中提取trace id
  function extractTraceId(text) {
    const traceIdPattern = /(?:traceid[=:\s]+|trace\s*id[=:\s]+)?([a-f0-9]{32})/i;
    const match = text.match(traceIdPattern);
    return match ? match[1] : null;
  }

  // 从域名中提取环境名称（"-"之前的第一个字符串）
  function extractEnvFromDomain() {
    const hostname = window.location.hostname;
    // 例如：thailifesit-sandbox-thailife-th.insuremo.com -> thailifesit
    const parts = hostname.split('-');
    return parts[0];
  }

  // 启动
  init();

  // 监听配置更新
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.translateConfig) {
      config = { ...config, ...changes.translateConfig.newValue };
      console.log('配置已更新:', config);
    }
  });
})();
