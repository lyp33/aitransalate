// 测试翻译 API 返回内容

const testText = "what's your name";
const apiUrl = 'https://portal.insuremo.com/api/mo-re/ai-qa-service/aiqa/api/chat';

// 你需要提供 token
const token = 'YOUR_TOKEN_HERE'; // 请替换为实际的 token

async function testTranslation() {
  const requestBody = {
    query: `请将以下英文文本翻译成中文，只返回翻译结果，不要添加任何额外的说明、标记或格式：\n\n${testText}`,
    messages: [],
    temperature: 0.2,
    llm_code: 'qwen-max',
    stream: false
  };

  console.log('发送的请求内容：');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n---\n');

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('响应状态:', response.status, response.statusText);
    
    const data = await response.json();
    
    console.log('\n完整响应：');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n提取的翻译结果 (data.data)：');
    console.log(data.data);
    
  } catch (error) {
    console.error('请求失败:', error);
  }
}

testTranslation();
