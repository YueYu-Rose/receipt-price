# Receipt Price · 小票比价

**Try it:** https://yueyu-rose.github.io/receipt-price/

Snap your grocery receipts, let AI read them, and find out which store sells each item for less.

## How it works
- Take photos one by one or pick several from your gallery. They are read in a queue by the AI service you choose.
- Each receipt becomes a table: store, date, items, prices, and sizes when the receipt prints them.
- **Compare** shows, for every item, the store with the lowest price. When all sizes are known it ranks by unit price (per oz / fl oz / each); otherwise by package price, marked as rough.
- Switch between **Same product** (exact brand and variant, or UPC) and **Same type** (any brand, e.g. any Greek yogurt).
- Prices are compared before tax.
- **Spending** shows a weekly bar chart of what you spent, with previous weeks browsable and a tap-to-see-that-day breakdown.

## Reliability
- Every photo you add is saved to IndexedDB (this device only) the moment you pick it, before any AI call — so if the tab gets suspended or evicted while backgrounded (very possible after leaving it for a while) and reloads, nothing you picked is lost. Reopening the page **automatically resumes** any photos that hadn't finished yet.
- Uploads are hashed byte-for-byte; an exact repeat of a photo you already scanned is skipped instead of spending an AI call on it, and can be force-processed anyway.
- A second receipt with the same store, date and total as one already saved is flagged "possible duplicate" (never auto-deleted) — catches the same paper photographed twice.
- Transient failures (rate limits, an overloaded provider, a dropped connection, a response cut off by the model's internal "thinking" eating its own token budget) retry automatically with backoff instead of dumping manual retries on you; only real problems (bad key, missing model) stop and ask you to fix something, and keep the photo saved until you do.
- A durable **scan history** below the upload queue survives reloads, so a batch interrupted by the page getting backgrounded/suspended still shows what was attempted and what's left unfinished.

## Free, no accounts, private
- **Bring your own key.** Everyone uses their own API key, and nobody pays for anyone else. Supported services:

  | Service | Default model | Cost |
  |---|---|---|
  | [Google Gemini](https://aistudio.google.com/apikey) | gemini-flash-latest | free tier |
  | [OpenRouter](https://openrouter.ai/keys) | openrouter/free | free models |
  | [Zhipu GLM 智谱](https://open.bigmodel.cn/usercenter/apikeys) | glm-4v-flash | free, works in mainland China |
  | [Alibaba Qwen 阿里云百炼](https://bailian.console.aliyun.com/) | qwen-vl-plus | free credit, then paid |
  | [DeepSeek](https://platform.deepseek.com/api_keys) | deepseek-flash | paid, very cheap (well under $0.01/receipt) |
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

- 每个人用自己的 AI 服务密钥（Gemini、OpenRouter、智谱 GLM-4V-Flash 都有免费额度；智谱国内可直接用；也支持 DeepSeek），不需要注册账号，也不花别人的钱
- 密钥和小票数据只存在自己设备的浏览器里，没有服务器
- iPhone 建议"添加到主屏幕"使用，并定期在"小票"页导出备份
- 照片按字节去重，完全相同的照片不会重复调用 AI；店名+日期+总价都相同的两张小票会标"可能重复"提醒
- 服务繁忙、限速这类临时错误会自动重试；扫描记录会保留下来，页面被切走中断了也能看到哪些没处理完
- **照片一选好就会存进手机的 IndexedDB，不再只存在网页的临时内存里** ——就算页面被系统挂起或直接关掉重开，没处理完的照片重新打开网页会自动接着识别，不用重新选一遍
- 新增"记账"页：按周查看每天花了多少钱，可以翻看之前几周

## License
MIT
