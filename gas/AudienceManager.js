/**
 * 毎日深夜に実行するオーディエンス同期メイン処理
 */
function batchSyncAudiences() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('名簿');
  const data = sheet.getDataRange().getValues();

  // 同期対象の設定（列インデックスに注意）
  const syncSettings = [
    { name: "地区長", colIndices: [8] },    // I列
    { name: "班長",   colIndices: [9, 10] }, // J列(班長) または K列(班長代理) を合算
    { name: "防災部", colIndices: [11] },   // L列
    { name: "その他役員", colIndices: [12] } // M列
  ];

  syncSettings.forEach(setting => {
    const userIds = [];
    for (let i = 1; i < data.length; i++) {
      const userId = data[i][1]; // B列: UserID
      if (!userId) continue;

      // 指定された列のいずれかが "YES" ならリストに追加
      const isTarget = setting.colIndices.some(col => data[i][col] === "YES");

      if (isTarget) {
        userIds.push({ id: userId });
      }
    }
    
    const audienceName = "[AUTO] " + setting.name;
    
    if (userIds.length > 0) {
      console.log(audienceName + " の同期を開始します（人数: " + userIds.length + "人）");
      executeAudienceReplace(audienceName, userIds);
    }
  });
}

/**
 * LINEオーディエンスを「最新の状態」に差し替える
 */
function executeAudienceReplace(description, audiences) {
  const uploadUrl = 'https://api.line.me/v2/bot/audienceGroup/upload';
  const payload = {
    'description': description,
    'isIfaAudience': false,
    'audiences': audiences 
  };
  const options = {
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ACCESS_TOKEN
    },
    'method': 'post',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  const response = UrlFetchApp.fetch(uploadUrl, options);
  console.log(description + " 反映結果: " + response.getContentText());
}