# AI 智能翻译助手 Chrome 插件

一个智能的Chrome浏览器翻译插件，鼠标悬停即可自动识别并翻译指定语言内容。

## 功能特性

- 智能语言检测：支持泰语、英语、日语、韩语、越南语、俄语等多种语言
- 鼠标悬停翻译：无需点击，悬停即翻译
- 多源语言支持：可配置多种源语言同时检测
- eBao AI集成：使用eBao AI QA Service进行翻译
- 美观UI：渐变色设计，流畅动画效果

## 项目结构

```
translate/
├── manifest.json       # 插件配置文件
├── content.js          # 内容脚本（鼠标悬停检测、翻译逻辑）
├── content.css         # 翻译提示框样式
├── background.js       # 后台脚本（API调用处理）
├── popup.html          # 设置弹窗界面
├── popup.css           # 设置界面样式
├── popup.js            # 设置界面逻辑
└── icons/              # 图标文件夹（需手动添加）
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 安装步骤

### 1. 添加图标文件

在项目根目录创建 `icons` 文件夹，并添加以下尺寸的图标文件：
- `icon16.png` (16x16像素)
- `icon48.png` (48x48像素)
- `icon128.png` (128x128像素)

### 2. 加载插件到Chrome

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择此项目的 `translate` 文件夹

### 3. 配置API

1. 点击Chrome工具栏中的插件图标
2. 在设置界面中填写API信息：

   **必填项：**
   - **API Token**：你的eBao API认证令牌

   **可选项（已有默认值）：**
   - **API地址**：默认为eBao API地址
   - **LLM模型代码**：默认为 `qwen-max`
   - **Temperature**：默认为 `0.2`（0-1之间，值越低翻译越保守）
   - **超时时间**：默认为 `10000ms`

3. 选择要检测的源语言（如泰语、英语）
4. 选择目标翻译语言（如中文）
5. 点击"保存设置"
6. 点击"测试API"验证配置是否正确

## API格式

### 请求格式 (eBao AI QA Service)

```javascript
POST https://portal.insuremo.com/api/mo-re/ai-qa-service/aiqa/api/chat

Headers:
  Content-Type: application/json
  Authorization: Bearer {your_token}
  Accept: application/json

Body:
{
  "query": "把如下文本从泰文翻译为中文：ไๆำๆไำๆไำๆำ",
  "messages": [],
  "temperature": 0.2,
  "llm_code": "qwen-max",
  "stream": false
}
```

### 响应格式

```json
{
  "data": "翻译后的文本内容"
}
```

## 配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| 启用翻译助手 | 总开关，开启/关闭翻译功能 | 开启 |
| 检测语言 | 选择需要检测并翻译的源语言 | 泰语、英语 |
| 翻译为 | 选择目标翻译语言 | 中文 |
| 同时显示原文 | 在翻译结果中显示原文内容 | 开启 |
| 悬停延迟时间 | 鼠标悬停多久后触发翻译（毫秒） | 500ms |
| API地址 | eBao API的URL | eBao地址 |
| API Token | API认证令牌 | 需填写 |
| LLM模型代码 | 使用的LLM模型 | qwen-max |
| Temperature | AI生成温度参数 | 0.2 |
| 超时时间 | API请求超时时间（毫秒） | 10000ms |

## 支持的语言代码

| 代码 | 语言 | 中文名称 |
|------|------|----------|
| `th` | Thai | 泰文 |
| `en` | English | 英文 |
| `ja` | Japanese | 日文 |
| `ko` | Korean | 韩文 |
| `vi` | Vietnamese | 越南文 |
| `ru` | Russian | 俄文 |
| `zh` | Chinese | 中文 |
| `ar` | Arabic | 阿拉伯文 |

## 使用方法

1. 配置好API Token后，浏览任意网页
2. 将鼠标悬停在外语文本上
3. 等待片刻（根据设置的延迟时间，默认500ms）
4. 翻译结果会显示在鼠标附近

## 工作原理

1. **语言检测**：使用Unicode字符范围正则表达式快速识别文本语言
2. **API调用**：通过background.js调用eBao AI QA Service API
3. **结果显示**：在鼠标附近显示美观的渐变色提示框

## 注意事项

- 翻译延迟时间建议设置为500ms，避免误触发
- API Token需要保密，不要分享给他人
- 需要网络连接才能使用翻译功能
- 某些网站可能有内容安全策略(CSP)限制
- Temperature参数影响翻译的创造性：
  - 值越低（接近0），翻译越保守、准确
  - 值越高（接近1），翻译越自由、灵活

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| 无法翻译 | 检查API Token是否正确配置 |
| 翻译失败 | 点击"测试API"检查连接 |
| 翻译不准确 | 调整Temperature参数 |
| 误触发频繁 | 增加悬停延迟时间 |
| 不翻译某些语言 | 在设置中勾选对应语言 |

## 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript (无框架依赖)
- CSS3 渐变和动画
- Fetch API
- Chrome Storage API
