# Receipt Price · 小票比价

**Try it:** https://yueyu-rose.github.io/receipt-price/

Snap your grocery receipts, let AI read them, and find out which store sells each item for less.

## How it works
- Take photos one by one or pick several from your gallery. They are read in a queue by the AI service you choose.
- Each receipt becomes a table: store, date, items, prices, and sizes when the receipt prints them.
- **Compare** shows, for every item, the store with the lowest price. When all sizes are known it ranks by unit price (per oz / fl oz / each); otherwise by package price, marked as rough.
- Switch between **Same product** (exact brand and variant, or UPC) and **Same type** (any brand, e.g. any Greek yogurt).
- Prices are compared before tax.

## Free, no accounts, private
- **Bring your own key.** Everyone uses their own API key, and nobody pays for anyone else. Supported services:

  | Service | Default model | Cost |
  |---|---|---|
  | [Google Gemini](https://aistudio.google.com/apikey) | gemini-2.5-flash | free tier |
  | [OpenRouter](https://openrouter.ai/keys) | openrouter/free | free models |
  | [Zhipu GLM 智谱](https://open.bigmodel.cn/usercenter/apikeys) | glm-4v-flash | free, works in mainland China |
  | [Alibaba Qwen 阿里云百炼](https://bailian.console.aliyun.com/) | qwen-vl-plus | free credit, then paid |
  | [OpenAI](https://platform.openai.com/api-keys) | gpt-5-mini | paid |
  | [Anthropic Claude](https://console.anthropic.com/settings/keys) | claude-haiku-4-5 | paid |
  | Any OpenAI-compatible API | your choice | — |

- **Your data stays on your device.** The key and all receipts live in your browser's local storage. There is no server and no account.
- **Keep it safe:** on iPhone, add the site to your Home Screen (Safari may clear site data after 7 days without a visit otherwise), and export a backup now and then (Receipts → Export backup).
- Receipt photos go straight from your browser to the service you pick. Free tiers may use content to improve their models.

## Run locally
It's a static site with no build step:
```
python -m http.server 8000
```
then open http://localhost:8000.

---

## 中文说明
拍照或上传购物小票，AI 自动识别成表格，找出每件商品在哪家店买最便宜。

- 每个人用自己的 AI 服务密钥（Gemini、OpenRouter、智谱 GLM-4V-Flash 都有免费额度；智谱国内可直接用），不需要注册账号，也不花别人的钱
- 密钥和小票数据只存在自己设备的浏览器里，没有服务器
- iPhone 建议"添加到主屏幕"使用，并定期在"小票"页导出备份

## License
MIT
