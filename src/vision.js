//Messaging API Channel access token
var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // "LINE Messaging APIのチャンネルトークン指定"
var google_drive_id = PropertiesService.getScriptProperties().getProperty('GOOGLE_DRIVE_ID'); // 'Google Drive のID指定'
var cloud_vision_api_key = PropertiesService.getScriptProperties().getProperty('CLOUD_VISION_API_KEY'); // 'Google Vision APIのAPIキー指定'

//動作確認用（動作確認が完了したら削除してOK）
function test() {
  //Driveから保存したファイルをFileName指定でファイルを取得する
  var myFolder = DriveApp.getFolderById(google_drive_id);
  var getImage = myFolder.getFilesByName("ocr2.png").next();
  
  //画像ファイルにリンクでアクセスできるように権限付与
  getImage.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  //画像ファイル取得及びbase64形式にエンコード
  var realImageURL = 'https://drive.google.com/uc?export=view&id=' + getImage.getId();
  var fetchImage = Utilities.base64Encode(UrlFetchApp.fetch(realImageURL).getContent());
  
  //画像ファイルをVision APIで解析する
  var answerMessage = executeOCR(fetchImage);
  Logger.log(answerMessage);
}

// ボットにメッセージ送信/フォロー/アンフォローした時の処理
function doPost(e) {
  var events = JSON.parse(e.postData.contents).events;
  events.forEach(function(event) {
    if(event.type == "message") {
      reply(event);
    } else if(event.type == "follow") {
      follow(event);
    } else if(event.type == "unfollow") {
      unFollow(event);
    }
 });
}

// 入力された画像をOCR解析して結果を返す
function reply(e) {
  var replyToken = e.replyToken;
  if(e.message.type=="image"){
  } else {
    replyMessage(replyToken, "これは画像ではありません");
    return;
  }
  
  try {
    //LINE上から画像のバイナリーデータを取得
    var imageBinary = getImageBinary(e);
    
    //GoogleVisionAPIで解析可能な形に変換
    var imageInfo = encodeImage(imageBinary);

    //画像ファイルをVision APIで解析する
    var answerMessage = executeOCR(imageInfo.encodedFile);
    
    //解析結果を返答する
    replyMessage(replyToken, answerMessage);
    
    //OCR解析が完了したら一時保存した画像ファイルを削除
    removeFile(imageInfo);
  } catch(error) {
    replyMessage(replyToken, "エラーが発生しました。もう一度やり直してください。");
    Logger.log("Error");
    Logger.log(error);
  }
}

//一時保存した画像ファイルを削除
function removeFile(imageInfo) {
  var folder = imageInfo.folder;
  var file = imageInfo.file;
  folder.removeFile(file);
}

//LINEから画像データをバイナリー形式で取得
function getImageBinary(e) {
  var contentsEndPoint = 'https://api.line.me/v2/bot/message/' + e.message.id + '/content';
  var image_get_option = {
    "method":"get",
    "headers": {
      "Content-Type" : "application/json",
      "Authorization" : "Bearer " + access_token      
    }
  }
  var imageBinary = UrlFetchApp.fetch(contentsEndPoint,image_get_option);
  return imageBinary;
}

//画像データをCloudVisionで使えるようにDriveを利用して加工する
function encodeImage(imageBinary){
  //取得したバイナリーデータを一時的にGoogleDriveに保存
  var folder = DriveApp.getFolderById(google_drive_id);
  var fileName = Math.random().toString(36).slice(-8);
  var imageFile = folder.createFile(imageBinary.getBlob().setName(fileName));
  
  //画像ファイルにリンクでアクセスできるように権限付与
  imageFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  //画像ファイル取得及びbase64形式にエンコード
  var imageURL = 'https://drive.google.com/uc?export=view&id=' + imageFile.getId();
  var fetchImage = Utilities.base64Encode(UrlFetchApp.fetch(imageURL).getContent());

  //処理後にファイルを削除するため必要な情報をまとめる
  var imageInfo = {
    folder:folder,
    file:imageFile,
    encodedFile:fetchImage
  }
  return imageInfo;
}

//ユーザーにメッセージを返信します。
function replyMessage(replyToken, message) {
  var postData = {
    "replyToken" : replyToken,
    "messages" : [
      {
        "type" : "text",
        "text" : message
      }
    ]
  };
  var options_reply = {
    "method" : "post",
    "headers" : {
      "Content-Type" : "application/json",
      "Authorization" : "Bearer " + access_token
    },
    "payload" : JSON.stringify(postData)
  };
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", options_reply);
}

//画像からテキストを抽出する(Google Cloud Vision API)
function executeOCR(contents) {
  //Google vision api key
  var apiKey = cloud_vision_api_key;
  var url = 'https://vision.googleapis.com/v1/images:annotate?key=' + apiKey;
  
  // vision API
  var body = {
    "requests":[
      {
        "image": {
          "content": contents
        },
        "features":[
          {
            "type":"TEXT_DETECTION",
            "maxResults":1
          }
        ]
      }
    ]
  };
  var head = {
    "method":"post",
    "contentType":"application/json",
    "payload":JSON.stringify(body),
    "muteHttpExceptions": true
  };
  var response = UrlFetchApp.fetch(url, head);
  var description = "";
  if(JSON.parse(response).responses[0].textAnnotations) {
    description = JSON.parse(response).responses[0].textAnnotations[0].description;
  } else {
    description = "画像に文字が含まれていません";
  }
  return description;
}

/* フォローされた時の処理 */
function follow(e) {
}

/* アンフォローされた時の処理 */
function unFollow(e){
}
