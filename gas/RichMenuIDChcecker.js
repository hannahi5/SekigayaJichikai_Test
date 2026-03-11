function checkAllRichMenus() {
  const token = "ds6DnD+vOqJhGExDdbIrQj1d3NsbUhb11lVr1GIkswC1OCygrKN7cfSCzOePxPmr1JUrrV6MlJFFOrPcFAX74G7n/m9J/GV8nGBSgOF5gMOQ+EkJqSCZd0vngsFj/ocdhNkY6kQdmLEoZGA2khqCsgdB04t89/1O/w1cDnyilFU=";
  
  // 1. デフォルトのリッチメニューIDを確認
  const resDefault = UrlFetchApp.fetch("https://api.line.me/v2/bot/user/all/richmenu", {
    "headers": { "Authorization": "Bearer " + token },
    "method": "get",
    "muteHttpExceptions": true
  });
  
  // 2. 作成済みのリッチメニュー一覧を確認
  const resList = UrlFetchApp.fetch("https://api.line.me/v2/bot/richmenu/list", {
    "headers": { "Authorization": "Bearer " + token },
    "method": "get",
    "muteHttpExceptions": true
  });

  console.log("現在のデフォルトメニューID: " + resDefault.getContentText());
  console.log("全メニューリスト: " + resList.getContentText());


  
}

function checkRichMenuImage() {
  const token = "ds6DnD+vOqJhGExDdbIrQj1d3NsbUhb11lVr1GIkswC1OCygrKN7cfSCzOePxPmr1JUrrV6MlJFFOrPcFAX74G7n/m9J/GV8nGBSgOF5gMOQ+EkJqSCZd0vngsFj/ocdhNkY6kQdmLEoZGA2khqCsgdB04t89/1O/w1cDnyilFU=";
  const richMenuId = "richmenu-88bcc94ec2c770bcfeb7438a664a4d09";
  
  const url = `https://api.line.me/v2/bot/richmenu/${richMenuId}/content`;
  const res = UrlFetchApp.fetch(url, {
    "method": "get",
    "headers": { "Authorization": "Bearer " + token },
    "muteHttpExceptions": true
  });

  if (res.getResponseCode() === 200) {
    Logger.log("✅ 画像は正しくアップロードされています。");
  } else {
    Logger.log("❌ 画像がまだアップロードされていないか、エラーです。内容: " + res.getContentText());
  }
}