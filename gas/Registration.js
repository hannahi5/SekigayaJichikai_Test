// @ts-nocheck
/**
 * スプレッドシートとLINEの設定を読み込んで処理を開始する
 */
const SHEET_ID = "168Y3g20bxjmro_zQMEOe6yiinknUZKED90pfQw5D4p4";
const ACCESS_TOKEN = "Nto/Mz556zupyvSIIUjDiTJMx0PaaCl2kfZ6UcY9gBe9ZXneiqZLt3P6CiC3Au7PMA52+ya8TxtlmwJZa5S+KsyyvapFoL2HKm6a9v2tJrhqSPdFhZFTUThfX5S48IxW/dRDAeLwtuKNuXR6OEIu9gdB04t89/1O/w1cDnyilFU="; 

// SpreadsheetのURL
//const spreadSheet = SpreadsheetApp.getActiveSpreadsheet();
// Spreadsheetのシート名（タブ名）
//const menuSheet = spreadSheet.getSheetByName("メニュー構成");
//const richmenuSheet = spreadSheet.getSheetByName("リッチメニュー管理");


/**
 * ブラウザからの直接アクセスに応答する関数
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status: 'ok', message: 'This endpoint accepts POST requests only.'}))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * ユーザーのアクセスを受け取る関数
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);

// --- 【高速版】登録情報の取得 ---
    if (postData.action === "get_user_info") {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName('名簿');
      const userId = postData.userId;
      
      // 全データを取らずに「C列」だけを検索して行番号を特定する
      const finder = sheet.getRange("C:C").createTextFinder(userId).matchEntireCell(true).findNext();
      
      if (finder) {
        const row = finder.getRow();
        // 見つかった1行だけをピンポイントで取得（これが速い！）
        const rowData = sheet.getRange(row, 1, 1, 20).getValues()[0]; 

        // 役職リストの復元（列番号は rowData のインデックス 0〜19 に対応）
        let roles = [];
        if (rowData[12] === "YES") roles.push("2026前期 - 地区長"); // M列
        if (rowData[13] === "YES") roles.push("2026前期 - 班長");   // N列
        if (rowData[14] === "YES") roles.push("2026前期 - 班長（代理）"); // O列
        if (rowData[15] === "YES") roles.push("防災部");           // P列
        if (rowData[16] === "YES") roles.push("その他役員");       // Q列
        if (rowData[17] === "YES") roles.push("一般");             // R列

        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          data: {
            lastName: rowData[6],        // G列
            firstName: rowData[7],       // H列
            han: parseInt(rowData[9]),   // J列
            koban: parseInt(rowData[10]),// K列
            age: rowData[11],            // L列
            roles: roles.join('/')
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'not_found'})).setMimeType(ContentService.MimeType.JSON);
    }

    // --- Aグループ：LINE公式からの通知（eventsがある場合） ---
    if (postData.events && postData.events.length > 0) {
      const event = postData.events[0];
      
      // １．【リプライ処理】「で登録します。」への返信
      if (event.type === "message" && event.message.text && (event.message.text.includes("【新規登録】") || event.message.text.includes("【情報更新】"))) {
        const replyToken = event.replyToken;
        let replyText = "";
        if (event.message.text.includes("【新規登録】")) {
          replyText = "登録完了しました！\n\n下のメニュー＞マイページからいつでも修正できます。";
        } else {
          replyText = "情報を更新しました！";
        }
        
        UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
          'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + ACCESS_TOKEN,
          },
          'method': 'post',
          'payload': JSON.stringify({
            'replyToken': replyToken,
            'messages': [{ 'type': 'text', 'text': replyText }]
          }),
        });
              console.log("リプライ送信を試みました: " + replyToken);

        return ContentService.createTextOutput("OK");
      }


      // ２．【ブロック検知】ここを「if (postData.events...」の中に移動しました
      if (event.type === "unfollow") {
        updateBlockStatus(event.source.userId);
        return ContentService.createTextOutput("OK");
      }
    } // ←  eventsここまで
    
    // --- Bグループ：LIFFからの直接データ送信 ---
    // １．デバイス情報を取得
    const deviceInfo = postData.deviceInfo || "不明";
    
    // ２．仮登録処理
    if (postData.action === "temp_register") {
      saveTempUser(postData.userId, postData.displayName, deviceInfo);
      return ContentService.createTextOutput(JSON.stringify({status: 'temp_success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ３．本登録処理
    if (postData.userId && postData.lastName) { 
      const p = postData;
      updateFullUserInfo(
        p.userId, p.lastName, p.firstName, p.hanban, p.koban, 
        p.roles, p.displayName, p.ageGeneration,deviceInfo
      );
      
      linkRichMenuToUser(p.userId);
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    console.log("Error: " + err);
    if (typeof ADMIN_USER_ID !== 'undefined') {
      sendPushMessage(ADMIN_USER_ID, "エラー発生: " + err.message);
    }
  }
}


/**
 * 仮登録用：名簿の末尾に「仮ステータス」で保存
 */
function saveTempUser(userId, displayName, deviceInfo) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('名簿');
  const data = sheet.getDataRange().getValues();
  
// 既存のユーザー（UserID）を探す
  let targetRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][2] === userId) {
      targetRow = i + 1; // 行番号を特定
      break;
    }
  }

  if (targetRow > 0) {
    // --- 2回目以降のアクセス：B列とデバイス情報を更新 ---
    const now = new Date();
    sheet.getRange(targetRow, 2).setValue(now);         // B列: 更新日時
    sheet.getRange(targetRow, 4).setValue(displayName); // D列: 名前（変更があるかもなので上書き）
    sheet.getRange(targetRow, 20).setValue(deviceInfo); 
    
    console.log("既存ユーザーの更新日時を更新しました: " + userId);
  } else {
    // --- 初回アクセス：新規行を追加 ---
    // A:登録日, B:更新日, C:ID, D:LINE名, E:ステータス(TEMP) ... S:デバイス情報
    const row = [
      new Date(), // A: 登録日
      new Date(), // B: 更新日
      userId,     // C: UserID
      displayName || "", // D: LINE名
      "TEMP",     // E: ステータス
      "", "", "", "", "", "", "", "", "", "", "", "", "", // F〜Q列を空で埋める
      deviceInfo  // R: デバイス情報
    ];
    sheet.appendRow(row);
    console.log("新規ユーザーを仮登録しました: " + userId);
  }
}

/**
 * ★時限トリガーで動かす関数：放置された人を救出
 */
function checkDropoutUsers() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('名簿');
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  
  // 下から順にチェック（削除が発生するため）
for (let i = 1; i < data.length; i++) {
    const regDate = new Date(data[i][0]);
    const userId  = data[i][2];
    const statusFlag = data[i][4]; // E列（index 4）を判定に使う

    // 条件：E列が「TEMP」かつ 10分以上経過
    if (statusFlag === "TEMP" && (now - regDate) > 10 * 60 * 1000) {
      sendPushMessage(userId, "利用登録が中断されているようです。お手数ですが、もう一度はじめから入力をやり直してください。");
    // E列（5列目）を「済」に更新
      sheet.getRange(i + 1, 5).setValue("リマインド済"); 
    }
  }
}

/**
 * ユーザー情報を名簿に保存する関数
 */
function updateFullUserInfo(userId, lastName, firstName, hanban, koban, roles, displayName, ageGeneration, deviceInfo) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // 1. 地区番号の取得
  const refSheet = ss.getSheetByName('Ref');
  const refData = refSheet.getDataRange().getValues();
  let chikuBan = ""; 
  for (let i = 1; i < refData.length; i++) {
    if (String(refData[i][0]) === String(hanban)) {
      chikuBan = refData[i][1];
      break;
    }
  }

  // 2. 書き込み先の特定
  const mainSheet = ss.getSheetByName('名簿');
  const mainData = mainSheet.getDataRange().getValues();
  let targetRow = -1;
  let originalRegistrationDate = new Date();

  for (let i = 0; i < mainData.length; i++) {
    if (mainData[i][2] === userId) { 
      targetRow = i + 1; 
      originalRegistrationDate = mainData[i][0]; 
      break; 
    }
  }

  // 3. ハウスID作成
  const formattedHan   = String(hanban || "").padStart(3, '0');
  const formattedKoban = String(koban  || "").padStart(2, '0');
  let houseId = `${formattedHan}-${formattedKoban}`;

  // 役職の判定（rolesが空の場合を考慮）
  const roleStr = roles || "";
  const roleList = roleStr.split('/');
  const isIppan = (roleList.includes("一般") || roleList.length === 0 || roleStr === "") ? "YES" : "NO";
  const isChikuchou = roleList.includes("2026前期 - 地区長")   ? "YES" : "NO";
  const isHanchou  = roleList.includes("2026前期 - 班長")     ? "YES" : "NO";
  const isDairi    = roleList.includes("2026前期 - 班長（代理）") ? "YES" : "NO";
  const isBosai    = roleList.includes("防災部")   ? "YES" : "NO";
  const isEtc      = roleList.includes("その他役員") ? "YES" : "NO";

  // 4. 保存データの作成
  const rowData = [
    originalRegistrationDate, // A: 登録日
    new Date(),               // B: 更新日
    userId,                   // C: LINEユーザーID
    displayName || "",        // D: LINE名
    "有効",                    // E: ステータス
    houseId,                  // F: ハウスID
    lastName,                 // G: 姓
    firstName,                // H: 名
    chikuBan,                 // I: 地区
    formattedHan,             // J: 班
    formattedKoban,           // K: 戸番
    ageGeneration || "未選択", // L: 年代
    isChikuchou,              
    isHanchou, 
    isDairi, 
    isBosai, 
    isEtc,
    isIppan,                   // R: 一般
    deviceInfo                 // T: ここに環境情報を保存
  ];  

  if (targetRow > 0) {
    mainSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    mainSheet.appendRow(rowData);
  }
}

/**
 * 各種補助関数
 */
function linkRichMenuToUser(userId) {
  const url = `https://api.line.me/v2/bot/user/${userId}/richmenu/${RICH_MENU_ID}`;
  try {
    UrlFetchApp.fetch(url, {
      'method': 'post',
      'headers': { 'Authorization': 'Bearer ' + ACCESS_TOKEN }
    });
  } catch (e) { console.log("メニュー切り替えエラー: " + e); }
}


/**
 * ユーザーがブロックした際に「ステータス列」を更新する
 */
function updateBlockStatus(userId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('名簿');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][2] === userId) {
      const targetRow = i + 1;
      // E列（5列目）を「ブロック済」にする
      sheet.getRange(targetRow, 5).setValue("ブロック済");
      break;
    }
  }
}



function sendPushMessage(to, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    'headers': { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ACCESS_TOKEN },
    'method': 'post',
    'payload': JSON.stringify({ 'to': to, 'messages': [{ 'type': 'text', 'text': text }] })
  });
}
