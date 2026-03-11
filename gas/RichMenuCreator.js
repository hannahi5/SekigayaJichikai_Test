function createRichMenu() {
  const token = "ds6DnD+vOqJhGExDdbIrQj1d3NsbUhb11lVr1GIkswC1OCygrKN7cfSCzOePxPmr1JUrrV6MlJFFOrPcFAX74G7n/m9J/GV8nGBSgOF5gMOQ+EkJqSCZd0vngsFj/ocdhNkY6kQdmLEoZGA2khqCsgdB04t89/1O/w1cDnyilFU=";
  const url = "https://api.line.me/v2/bot/richmenu";

  // メニューの「設計図」です
  const postData = {
    "size": { "width": 2500, "height": 843 }, // ハーフサイズ
    "selected": false, // 自動的に表示するかどうか
    "name": "一般メニュー（API作成）",
    "chatBarText": "メニュー",
    "areas": [
      {
        "bounds": { "x": 0, "y": 0, "width": 2500, "height": 843 }, 
        "action": { "type": "postback", "data": "action=menu", "displayText": "メニューを表示します" } 
      }
    ]
  };

  const options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    "payload": JSON.stringify(postData),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log("実行結果: " + response.getContentText());
}


function uploadRichMenuImage() {
  const token = "ds6DnD+vOqJhGExDdbIrQj1d3NsbUhb11lVr1GIkswC1OCygrKN7cfSCzOePxPmr1JUrrV6MlJFFOrPcFAX74G7n/m9J/GV8nGBSgOF5gMOQ+EkJqSCZd0vngsFj/ocdhNkY6kQdmLEoZGA2khqCsgdB04t89/1O/w1cDnyilFU=";
  const richMenuId = "richmenu-88bcc94ec2c770bcfeb7438a664a4d09"; // 正解のID
  const fileId = "1usJmcfgi-jrjN5IDiUK1WMcWZoHlnI6o"; // 画像のID

  // 1. Googleドライブからデータを取得し、強制的に画像形式(png)として読み込む
  const file = DriveApp.getFileById(fileId);
  const imageBlob = file.getBlob().getAs('image/jpeg'); // ここでPNG形式を強制指定

  const url = `https://api.line.me/v2/bot/richmenu/${richMenuId}/content`;
  const options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + token,
      "Content-Type": "image/jpeg" // ヘッダーもpngで固定
    },
    "payload": imageBlob.getBytes(),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(url, options);
  const resText = response.getContentText();
  
  // 応答が空なら成功、何か入っていればエラー内容を表示
  console.log("アップロード応答: " + (resText || "成功しました（空レスポンス）"));
}

// 3. 削除する
function deleteOldRichMenu() {
  const token = "ds6DnD+vOqJhGExDdbIrQj1d3NsbUhb11lVr1GIkswC1OCygrKN7cfSCzOePxPmr1JUrrV6MlJFFOrPcFAX74G7n/m9J/GV8nGBSgOF5gMOQ+EkJqSCZd0vngsFj/ocdhNkY6kQdmLEoZGA2khqCsgdB04t89/1O/w1cDnyilFU=";
  // 消したいIDをここに入れる（今回は下の2つを1回ずつ消すと良いです）
  const menuId = "richmenu-9352a6747527bf26df73a131d672dee8"; 
  
  const url = "https://api.line.me/v2/bot/richmenu/" + menuId;
  const res = UrlFetchApp.fetch(url, {
    "method": "delete",
    "headers": { "Authorization": "Bearer " + token }
  });
  
  console.log("削除結果: " + res.getContentText()); // 空の {} が返れば成功
}




function uploadRichMenuImageDirect() {
  const token = "ds6DnD+vOqJhGExDdbIrQj1d3NsbUhb11lVr1GIkswC1OCygrKN7cfSCzOePxPmr1JUrrV6MlJFFOrPcFAX74G7n/m9J/GV8nGBSgOF5gMOQ+EkJqSCZd0vngsFj/ocdhNkY6kQdmLEoZGA2khqCsgdB04t89/1O/w1cDnyilFU=";
  const richMenuId = "richmenu-3403fc2324a939fdcb61a9e2d45f4ed9"; 
  
  // ★ここに変換した長い文字列（data:image/png;base64,...）を貼り付け
  const base64Data = "ここに貼り付け"; 

  try {
    const splitData = base64Data.split(',');
    const contentType = splitData[0].split(':')[1].split(';')[0];
    const bytes = Utilities.base64Decode(splitData[1]);

    const url = `https://api.line.me/v2/bot/richmenu/${richMenuId}/content`;
    const options = {
      "method": "post",
      "headers": {
        "Authorization": "Bearer " + token,
        "Content-Type": contentType
      },
      "payload": bytes,
      "muteHttpExceptions": true
    };

    const response = UrlFetchApp.fetch(url, options);
    console.log("アップロード結果: " + response.getContentText());
    
    // 直後に確認
    const checkUrl = `https://api.line.me/v2/bot/richmenu/${richMenuId}/content`;
    const checkRes = UrlFetchApp.fetch(checkUrl, {
      "headers": { "Authorization": "Bearer " + token },
      "muteHttpExceptions": true
    });
    
    if (checkRes.getResponseCode() === 200) {
      console.log("✅ ついに成功しました！画像が紐付きました。");
    } else {
      console.log("❌ まだダメなようです。レスポンス: " + checkRes.getContentText());
    }
  } catch (e) {
    console.log("エラー: " + e.message);
  }
}
