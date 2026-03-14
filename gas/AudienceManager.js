/**
 * @fileoverview LINEオーディエンス自動同期バッチ
 *
 * 概要:
 *   名簿シートの役職列（YES/NO）をもとに、LINEオーディエンスを毎日最新に同期する。
 *   PropertiesService に audienceGroupId を保存し、
 *   「旧オーディエンス削除 → 新規作成 → ID保存」の流れで常に1つだけ維持する。
 *
 * 同期対象:
 *   地区長 (M列)、班長+代理 (N・O列)、防災部 (P列)、その他役員 (Q列)、応援団 (T列)
 *
 * 前提:
 *   - Registration.js で定義される SHEET_ID, ACCESS_TOKEN を参照する
 *   - GAS のトリガー（毎日深夜など）で batchSyncAudiences() を実行する
 *
 * 制限事項:
 *   - LINE API に「オーディエンスのメンバーを丸ごと差し替える」機能がないため、
 *     削除→再作成で対応している。再作成時に audienceGroupId が変わる点に注意。
 */

/**
 * 毎日深夜に実行するオーディエンス同期メイン処理
 *
 * 名簿シートを読み込み、各役職に該当するユーザーIDを収集して
 * LINEオーディエンスを最新の状態に同期する。
 */
function batchSyncAudiences() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('名簿');
  const data = sheet.getDataRange().getValues();

  /**
   * 同期対象の設定
   * name       : オーディエンスの表示名（LINEの管理画面で見える名前）
   * colIndices : 名簿シートの列インデックス（0始まり）。いずれかが "YES" なら対象
   *
   * 名簿シートの列構成（Registration.js と一致させること）:
   *   A(0):登録日  B(1):更新日  C(2):UserID  D(3):LINE名  E(4):ステータス
   *   F(5):ハウスID G(6):姓  H(7):名  I(8):地区  J(9):班  K(10):戸番
   *   L(11):年代  M(12):地区長  N(13):班長  O(14):班長代理
   *   P(15):防災部  Q(16):その他役員  R(17):一般  S(18):環境情報  T(19):DX応援団
   */
  const syncSettings = [
    { name: "地区長",     colIndices: [12] },    // M列
    { name: "班長",       colIndices: [13, 14] }, // N列(班長) + O列(班長代理)
    { name: "防災部",     colIndices: [15] },    // P列
    { name: "その他役員", colIndices: [16] },    // Q列
    { name: "応援団",     colIndices: [19] }     // T列: DX応援団
  ];

  syncSettings.forEach(setting => {
    const userIds = [];

    for (let i = 1; i < data.length; i++) {
      const userId = data[i][2]; // C列: LINEユーザーID
      const status = data[i][4]; // E列: ステータス

      if (!userId || status !== "有効") continue;

      const isTarget = setting.colIndices.some(col => data[i][col] === "YES");

      if (isTarget) {
        userIds.push({ id: userId });
      }
    }

    const audienceName = "[AUTO] " + setting.name;

    if (userIds.length > 0) {
      console.log(audienceName + " の同期を開始します（人数: " + userIds.length + "人）");
      executeAudienceReplace(audienceName, userIds);
    } else {
      console.log(audienceName + " の対象者が0人のためスキップします");
    }
  });
}

/**
 * LINEオーディエンスを「最新の状態」に差し替える
 *
 * 処理の流れ:
 *   1. PropertiesService から保存済みの audienceGroupId を取得
 *   2. 存在すれば DELETE API で旧オーディエンスを削除
 *   3. POST API で新しいオーディエンスを作成
 *   4. 新しい audienceGroupId を PropertiesService に保存
 *
 * @param {string} description - オーディエンスの説明（例: "[AUTO] 地区長"）
 * @param {Array<{id: string}>} audiences - 登録するユーザーIDの配列
 */
function executeAudienceReplace(description, audiences) {
  const props = PropertiesService.getScriptProperties();
  const propKey = "audience_" + description;
  const existingId = props.getProperty(propKey);

  // --- ① 既存のオーディエンスがあれば削除 ---
  if (existingId) {
    try {
      const deleteUrl = "https://api.line.me/v2/bot/audienceGroup/" + existingId;
      const deleteResponse = UrlFetchApp.fetch(deleteUrl, {
        "headers": { "Authorization": "Bearer " + ACCESS_TOKEN },
        "method": "delete",
        "muteHttpExceptions": true
      });
      const deleteCode = deleteResponse.getResponseCode();
      if (deleteCode === 200 || deleteCode === 202) {
        console.log(description + " 旧オーディエンス(ID:" + existingId + ")を削除しました");
      } else {
        console.log(description + " 旧オーディエンス削除で想定外のレスポンス: " +
          "code=" + deleteCode + ", body=" + deleteResponse.getContentText());
      }
    } catch (deleteError) {
      console.log(description + " 旧オーディエンス削除中にエラー: " + deleteError.message);
    }
  }

  // --- ② 新しいオーディエンスを作成 ---
  const createUrl = "https://api.line.me/v2/bot/audienceGroup/upload";
  const payload = {
    "description": description,
    "isIfaAudience": false,
    "audiences": audiences
  };
  const options = {
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + ACCESS_TOKEN
    },
    "method": "post",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(createUrl, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode === 200 || responseCode === 202) {
    // --- ③ 新しいIDを保存 ---
    const result = JSON.parse(responseBody);
    if (result.audienceGroupId) {
      props.setProperty(propKey, String(result.audienceGroupId));
      console.log(description + " 新オーディエンス作成成功 (ID:" + result.audienceGroupId + ")");
    } else {
      console.log(description + " 作成レスポンスに audienceGroupId が含まれていません: " + responseBody);
    }
  } else {
    console.log(description + " 作成失敗: code=" + responseCode + ", body=" + responseBody);
  }
}
