# 小票比价 Receipt Price

拍照或上传购物小票，用 Google Gemini（免费额度）识别成表格，找出每件商品在哪家店买最便宜。

- 纯静态网站，部署在 GitHub Pages
- API 密钥和小票数据只保存在你自己手机的浏览器里（localStorage），不会进这个仓库
- 比价：规格都已知时按单价比（每 oz / fl oz / 个），缺规格时按包装价比并标注"仅供参考"

## 使用
1. 在 [Google AI Studio](https://aistudio.google.com/apikey) 申请免费 API 密钥
2. 打开网站 → 设置 → 粘贴密钥
3. 拍小票或从相册选多张

注意：Gemini 免费版上传的内容可能会被 Google 用来改进产品。
