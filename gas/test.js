function testPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        userId: "test123",
        lastName: "テスト",
        firstName: "太郎",
        hanban: "1",
        koban: "1",
        roles: "一般",
        displayName: "テストユーザー",
        ageGeneration: "40代"
      })
    }
  };
  doPost(fakeEvent);
}