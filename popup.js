// AI翻译助手 - Popup Script

(function() {
  'use strict';

  // 默认配置
  const defaultConfig = {
    enabled: true,
    sourceLanguages: ['th', 'en'],
    targetLanguage: 'zh',
    showOriginal: true,
    debounceTime: 500,
    domainWhitelist: [], // 域名白名单，空数组表示所有网站
    ignoreNativeTooltips: true, // 忽略有原生tooltip的元素
    apiConfig: {
      url: 'https://portal.insuremo.com/api/mo-re/ai-qa-service/aiqa/api/chat',
      token: '',
      llm_code: 'qwen-max',
      temperature: 0.2,
      timeout: 10000
    }
  };

  let currentConfig = { ...defaultConfig };

  // 初始化
  function init() {
    loadConfig();
    bindEvents();
  }

  // 加载配置
  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['translateConfig']);
      if (result.translateConfig) {
        currentConfig = { ...defaultConfig, ...result.translateConfig };
      }
      applyConfigToUI();
    } catch (error) {
      console.error('加载配置失败:', error);
      showStatus('加载配置失败', 'error');
    }
  }

  // 将配置应用到UI
  function applyConfigToUI() {
    // 启用开关
    document.getElementById('enabledToggle').checked = currentConfig.enabled;

    // 源语言
    const sourceLangCheckboxes = document.querySelectorAll('input[name="sourceLang"]');
    sourceLangCheckboxes.forEach(checkbox => {
      checkbox.checked = currentConfig.sourceLanguages.includes(checkbox.value);
    });

    // 目标语言
    document.getElementById('targetLanguage').value = currentConfig.targetLanguage;

    // 显示原文
    document.getElementById('showOriginal').checked = currentConfig.showOriginal;

    // 域名白名单
    const domainList = currentConfig.domainWhitelist || [];
    document.getElementById('domainWhitelist').value = domainList.join('\n');

    // 忽略原生tooltip
    document.getElementById('ignoreNativeTooltips').checked = currentConfig.ignoreNativeTooltips !== false;

    // API配置
    document.getElementById('apiUrl').value = currentConfig.apiConfig.url || '';
    document.getElementById('apiToken').value = currentConfig.apiConfig.token || '';
    document.getElementById('llmCode').value = currentConfig.apiConfig.llm_code || 'qwen-max';
    document.getElementById('temperature').value = currentConfig.apiConfig.temperature || 0.2;
    document.getElementById('temperatureValue').textContent = currentConfig.apiConfig.temperature || 0.2;
    document.getElementById('apiTimeout').value = currentConfig.apiConfig.timeout || 10000;

    // 悬停延迟
    document.getElementById('debounceTime').value = currentConfig.debounceTime;
    document.getElementById('debounceValue').textContent = currentConfig.debounceTime;
  }

  // 从UI获取配置
  function getConfigFromUI() {
    const sourceLanguages = [];
    document.querySelectorAll('input[name="sourceLang"]:checked').forEach(checkbox => {
      sourceLanguages.push(checkbox.value);
    });

    // 解析域名白名单
    const domainText = document.getElementById('domainWhitelist').value.trim();
    const domainWhitelist = domainText
      ? domainText.split('\n')
          .map(d => d.trim())
          .filter(d => d.length > 0)
      : [];

    return {
      enabled: document.getElementById('enabledToggle').checked,
      sourceLanguages: sourceLanguages,
      targetLanguage: document.getElementById('targetLanguage').value,
      showOriginal: document.getElementById('showOriginal').checked,
      debounceTime: parseInt(document.getElementById('debounceTime').value),
      domainWhitelist: domainWhitelist,
      ignoreNativeTooltips: document.getElementById('ignoreNativeTooltips').checked,
      apiConfig: {
        url: document.getElementById('apiUrl').value.trim(),
        token: document.getElementById('apiToken').value.trim(),
        llm_code: document.getElementById('llmCode').value.trim(),
        temperature: parseFloat(document.getElementById('temperature').value),
        timeout: parseInt(document.getElementById('apiTimeout').value)
      }
    };
  }

  // 绑定事件
  function bindEvents() {
    // 保存按钮
    document.getElementById('saveBtn').addEventListener('click', saveConfig);

    // 测试API按钮
    document.getElementById('testBtn').addEventListener('click', testAPI);

    // 滑块值显示
    document.getElementById('debounceTime').addEventListener('input', (e) => {
      document.getElementById('debounceValue').textContent = e.target.value;
    });

    // Temperature滑块值显示
    document.getElementById('temperature').addEventListener('input', (e) => {
      document.getElementById('temperatureValue').textContent = e.target.value;
    });
  }

  // 保存配置
  async function saveConfig() {
    try {
      const newConfig = getConfigFromUI();

      // 验证源语言至少选择一个
      if (newConfig.sourceLanguages.length === 0) {
        showStatus('请至少选择一种检测语言', 'error');
        return;
      }

      // 保存到storage
      await chrome.storage.sync.set({ translateConfig: newConfig });
      currentConfig = newConfig;

      showStatus('✓ 设置已保存', 'success');

      // 2秒后隐藏消息
      setTimeout(() => {
        hideStatus();
      }, 2000);
    } catch (error) {
      console.error('保存配置失败:', error);
      showStatus('保存失败: ' + error.message, 'error');
    }
  }

  // 测试API
  async function testAPI() {
    const config = getConfigFromUI();

    if (!config.apiConfig.url || !config.apiConfig.token) {
      showStatus('请先配置API地址和Token', 'error');
      return;
    }

    showStatus('正在测试API连接...', 'info');

    try {
      const testText = 'Hello'; // 测试文本

      const response = await fetch(config.apiConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiConfig.token}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          query: `把如下文本从英文翻译为中文：${testText}`,
          messages: [],
          temperature: config.apiConfig.temperature,
          llm_code: config.apiConfig.llm_code,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // eBao API返回格式为 { "data": "..." }
      const translation = data.data || JSON.stringify(data);

      showStatus('✓ API测试成功！响应: ' + translation.substring(0, 50), 'success');

      setTimeout(() => {
        hideStatus();
      }, 3000);
    } catch (error) {
      console.error('API测试失败:', error);
      showStatus('✗ API测试失败: ' + error.message, 'error');
      setTimeout(() => {
        hideStatus();
      }, 5000);
    }
  }

  // 显示状态消息
  function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = 'status-message ' + type;
  }

  // 隐藏状态消息
  function hideStatus() {
    const statusEl = document.getElementById('statusMessage');
    statusEl.className = 'status-message';
  }

  // 启动
  init();
})();
