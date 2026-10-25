// =====================================================================
//  メール見張り番 v1.0
//
//  ・自分のGmailの受信箱を1時間ごとに見回り、詐欺っぽいメールを見つけたら知らせます。
//  ・毎朝7時に「きのうから届いたメールのまとめ」を送ります（届くこと自体が、動いている証明）。
//  ・判定は「これ、あやしい？」の部品（Engine.gs）で行います。AIは使いません＝メールの中身は外に出ません。
//  ・メールを消したり、動かしたり、代わりに返信したりは一切しません（読むだけ）。
//
//  最初に動かす関数： setup
//  試しに判定だけ見る： tryRecent（最近20通を判定して、結果を「実行ログ」に出すだけ）
// =====================================================================

// ---- 設定（必要なら変える） ----
var 設定 = {
  知らせる先: '',          // 空なら、自分のGmailに届く
  朝のまとめの時刻: 7,     // 0〜23
  一回に見る数: 50         // 1回の見回りで見るスレッドの数
};
var 目印 = '【メール見張り番】';   // このプログラムが送るメールの件名の頭（自分の通知を見回りしないため）

// =====================================================================
//  見分けるしくみ（ここは Gmail と関係のない部分＝パソコンでも試験できる）
// =====================================================================

// 送り主の名前で「どの会社を名乗っているか」を見る言葉。右は Engine.gs の会社の目印。
var 名乗りの言葉 = [
  [/amazon|アマゾン/i,'amazon'], [/楽天|rakuten/i,'rakuten'], [/ヤマト|クロネコ/,'kuroneko'], [/佐川/,'sagawa'],
  [/日本郵便|ゆうちょ|郵便局/,'japanpost'], [/apple|アップル|icloud/i,'apple'], [/三井住友|smbc|vpass/i,'smbc'],
  [/三菱UFJ|mufg/i,'mufg'], [/みずほ/,'mizuho'], [/paypay|ペイペイ/i,'paypay'], [/メルカリ|mercari/i,'mercari'],
  [/ETC/,'etc-meisai'], [/えきねっと/,'eki-net'], [/ドコモ|docomo/i,'docomo'], [/KDDI/,'kddi'],
  [/ソフトバンク|softbank/i,'softbank'], [/SBI/,'sbisec'], [/国税|e-Tax/i,'e-tax'], [/マイナンバー|マイナポイント/,'mynumber'],
  [/microsoft|マイクロソフト|outlook/i,'microsoft'], [/netflix|ネットフリックス/i,'netflix'], [/東京電力|TEPCO/i,'tepco'],
  [/イオン|aeon/i,'aeon'], [/JCB/,'jcb'], [/セゾン/,'saison']
];
var 無料のメール = ['gmail.com','yahoo.co.jp','yahoo.com','outlook.com','outlook.jp','hotmail.com','hotmail.co.jp','icloud.com','live.jp','aol.com','proton.me','protonmail.com','qq.com','163.com','126.com'];

function 送り主を分ける(from){
  var s = String(from||''), m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  var 名前 = m ? m[1].trim() : '', アドレス = (m ? m[2] : s).trim().toLowerCase();
  var ドメイン = アドレス.split('@')[1] || '';
  return {名前:名前, アドレス:アドレス, ドメイン:ドメイン};
}

function リンクを集める(plain, html){
  var 集めた = [], m;
  var re1 = /https?:\/\/[^\s<>"'「」『』（）)]+/gi;
  while((m = re1.exec(String(plain||'')))) 集めた.push(m[0]);
  var re2 = /href\s*=\s*["']\s*(https?:\/\/[^"'\s]+)/gi;   // 文字の裏に隠れている本当のリンク先
  while((m = re2.exec(String(html||'')))) 集めた.push(m[1].replace(/&amp;/g,'&'));
  return 集めた;
}

// 1通のメールを見分ける。 m = {from, subject, plain, html, auth}
function メールをしらべる(m){
  var 理由 = [];
  function add(lv, what, why, src){ 理由.push({lv:lv, what:what, why:why, src:src||''}); }
  var 送り主 = 送り主を分ける(m.from);
  var 送り主の住所 = 送り主.ドメイン ? Ayashii.URLをしらべる(送り主.ドメイン).住所 : '';

  // 送り主が「本物の会社の住所」で、Gmail のなりすまし確認（dmarc）にも通っているか。
  // 通っていれば本物の会社のお知らせなので、本文の言葉やその会社のリンクでは「危険」にしない。
  var 送り主の会社 = '';
  // ※ gmail.com などの無料メールは誰でも作れるので、Google の住所でも信用しない。
  if(送り主.ドメイン && /dmarc=pass/i.test(m.auth||'') && 無料のメール.indexOf(送り主.ドメイン)<0){
    var 公式 = Ayashii.URLをしらべる(送り主.ドメイン).理由.filter(function(x){ return x.lv===0 && /の本物の住所/.test(x.what); })[0];
    if(公式) 送り主の会社 = 公式.what.split(' の本物の住所')[0];
  }

  // ① なりすましの確認（Gmail が受け取ったときに調べた結果）
  if(/dmarc=fail/i.test(m.auth||'')) add(3,'送り主が本物か確かめられませんでした','送り主のアドレスを偽って送られた疑いがあります（なりすまし）。', 送り主.アドレス);

  // ② 送り主の名前は会社なのに、アドレスがその会社のものではない
  //    Engine.gs の「会社名が住所に入っているのに本物の住所ではない」を使うため、
  //    「会社の目印.送り主のドメイン」という仮の住所を作って調べる。
  if(送り主.名前 && 送り主.ドメイン){
    for(var i=0;i<名乗りの言葉.length;i++){
      if(!名乗りの言葉[i][0].test(送り主.名前)) continue;
      var 仮 = Ayashii.URLをしらべる(名乗りの言葉[i][1]+'.'+送り主.ドメイン).理由;
      var ニセ = 仮.filter(function(x){ return x.lv===3 && /名乗って/.test(x.what); })[0];
      if(ニセ) add(3,'送り主の名前は「'+送り主.名前+'」ですが、本物の会社のアドレスではありません', ニセ.why.replace(/^行き先は/,'送り主は'), 送り主.アドレス);
      break;
    }
  }
  // ③ 送り主のアドレスそのもの（.top などの怪しい末尾、似た文字へのすり替え）
  if(送り主.ドメイン){
    Ayashii.URLをしらべる(送り主.ドメイン).理由.forEach(function(x){
      if(x.lv>=2 && !/名乗って/.test(x.what)) add(x.lv,'送り主のアドレス：'+x.what, x.why, 送り主.アドレス);
    });
    if(無料のメール.indexOf(送り主.ドメイン)>=0 && /(銀行|証券|カード|株式会社|事務局|サポート|カスタマー|お客様|警察|税務|国税|市役所|区役所|配送|宅配)/.test(送り主.名前+' '+(m.subject||'')))
      add(2,'会社や役所を名乗るのに、無料のメールアドレスから届いています','まともな会社や役所は、自分の組織のアドレス（〇〇.co.jp や 〇〇.go.jp など）から送ります。', 送り主.アドレス);
  }

  // ④ 件名と本文の言葉
  var 本文 = String(m.plain||'').slice(0,6000);
  var 文 = Ayashii.文章をしらべる((m.subject||'')+'\n'+本文);
  if(送り主の会社){
    文.forEach(function(x){ x.lv = Math.min(x.lv, 1); });   // 本物の会社のログイン通知やキャンペーンは「知っておくこと」どまり
    add(0, '本物の'+送り主の会社+'のアドレスから届き、なりすまし確認にも通っています', '');
  }
  理由 = 理由.concat(文);

  // ⑤ リンク（送り主と同じ会社の住所へのリンクは調べない＝お知らせメールでの誤報を減らす）
  var 見た住所 = {}, よそのリンク = 0, リンクの注意 = false;
  リンクを集める(本文, m.html).slice(0,60).forEach(function(u){
    var r = Ayashii.URLをしらべる(u);
    if(!r.住所 || 見た住所[r.住所]) return;
    見た住所[r.住所] = 1;
    if(r.住所 === 送り主の住所) return;
    よそのリンク++;
    r.理由.forEach(function(x){
      if(送り主の会社 && x.what.indexOf(送り主の会社+' を名乗って')===0) return;   // 同じ会社グループの別の住所（楽天→楽天の別サイトなど）
      if(x.lv===3) add(3,'リンク：'+x.what, x.why, u);
      else if(x.lv===2 && !リンクの注意){ リンクの注意 = true; add(2,'リンク：'+x.what, x.why, u); }  // 注意は1つだけ数える
    });
  });
  if(文.some(function(x){ return x.lv>=2; }) && よそのリンク)
    add(2,'不安にさせる文面と、リンクがセットになっています','「不安にさせる → リンクを押させる → 入力させる」がフィッシング詐欺の型です。リンクは開かず、いつものアプリや公式サイトから確かめてください。');

  // まとめ
  var 見た理由 = {};
  理由 = 理由.filter(function(x){ var k = x.what; if(見た理由[k]) return false; 見た理由[k] = 1; return true; });
  理由.sort(function(a,b){ return b.lv-a.lv; });
  var 最大 = 理由.reduce(function(a,x){ return Math.max(a,x.lv); }, 0);
  var 注意の数 = 理由.filter(function(x){ return x.lv===2; }).length;
  var 判定 = 最大>=3 ? 3 : (注意の数>=3 ? 3 : (最大>=2 ? 2 : 0));
  return {判定:判定, 理由:理由};
}

// 通知の文に、押せるリンクを残さない（foo.top → foo[.]top、http → hxxp）
function 押せなくする(s){
  return String(s||'').replace(/http/gi,'hxxp').replace(/([A-Za-z0-9-])\.(?=[A-Za-z]{2,})/g,'$1[.]');
}

// =====================================================================
//  Gmail とつなぐ部分
// =====================================================================

function 知らせる先(){
  return 設定.知らせる先 || Session.getEffectiveUser().getEmail();
}
function 送る(件名, 本文){
  MailApp.sendEmail({to:知らせる先(), subject:目印+件名, body:本文, name:'メール見張り番'});
}
function 日時(d){ return Utilities.formatDate(d, 'Asia/Tokyo', 'M/d HH:mm'); }
function 開くリンク(id){ return 'https://mail.google.com/mail/u/0/#all/'+id; }

// 保存の大きさに上限（1つ約9KB）があるので、入りきるまで古いものから捨てる
function 小さく保存(p, key, list){
  while(list.length && JSON.stringify(list).length > 8000) list.shift();
  p.setProperty(key, JSON.stringify(list));
}

// 最初に1回だけ手で実行する
function setup(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(['patrol','morningReport'].indexOf(t.getHandlerFunction())>=0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('patrol').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('morningReport').timeBased().atHour(設定.朝のまとめの時刻).everyDays(1).inTimezone('Asia/Tokyo').create();
  var p = PropertiesService.getScriptProperties();
  p.setProperty('最後に見た時刻', String(Date.now() - 24*3600*1000));   // 初回は、この24時間分を見る
  patrol();
  送る('見張りを始めました',
    '受信箱の見回りを始めました。\n\n'+
    '・1時間ごとに新しいメールを見て、危険なものはすぐお知らせします。\n'+
    '・毎朝'+設定.朝のまとめの時刻+'時ごろ、まとめを送ります。このまとめが届かない日は、見張りが止まっています。\n'+
    '・メールを消したり動かしたりはしません。読むだけです。\n'+
    '・判定はこのGoogleアカウントの中だけで行い、メールの中身を外へ送りません。');
}

// 1時間ごとに動く
function patrol(){
  var lock = LockService.getScriptLock();
  if(!lock.tryLock(10000)) return;
  try{
    var p = PropertiesService.getScriptProperties();
    var 前回 = Number(p.getProperty('最後に見た時刻')) || (Date.now() - 24*3600*1000);
    var 今 = Date.now(), 余白 = 10*60*1000;     // Gmail の検索は時刻があらいので、10分さかのぼって重ねて見る
    var 見たID = JSON.parse(p.getProperty('見たID') || '[]');
    var 記録 = JSON.parse(p.getProperty('きのうからの記録') || '[]');
    var 見た数 = Number(p.getProperty('きのうから見た数')) || 0;
    var 自分 = Session.getEffectiveUser().getEmail().toLowerCase();
    var すぐ = [];

    var q = 'in:inbox after:'+Math.floor((前回-余白)/1000)+' -subject:"'+目印+'"';
    GmailApp.search(q, 0, 設定.一回に見る数).forEach(function(th){
      th.getMessages().forEach(function(msg){
        var id = msg.getId();
        if(見たID.indexOf(id)>=0) return;
        if(msg.getDate().getTime() < 前回-余白) return;
        見たID.push(id);
        if(String(msg.getFrom()).toLowerCase().indexOf(自分)>=0) return;   // 自分が送ったものは見ない
        見た数++;
        var r = メールをしらべる({from:msg.getFrom(), subject:msg.getSubject(), plain:msg.getPlainBody(),
                                   html:msg.getBody(), auth:msg.getHeader('Authentication-Results')});
        if(r.判定 < 2) return;
        var 項 = {id:id, 時:日時(msg.getDate()), 判定:r.判定, 件名:String(msg.getSubject()).slice(0,50),
                  送り主:String(msg.getFrom()).slice(0,60), 理由:r.理由.slice(0,2).map(function(x){ return x.what.slice(0,50); })};
        記録.push(項);
        if(r.判定 >= 3) すぐ.push({項:項, 理由:r.理由});
      });
    });

    小さく保存(p, '見たID', 見たID.slice(-300));
    小さく保存(p, 'きのうからの記録', 記録);
    p.setProperty('きのうから見た数', String(見た数));
    p.setProperty('最後に見た時刻', String(今));

    if(すぐ.length){
      var 本文 = '危険なメールが '+すぐ.length+' 通 届いています。\n'+
                 '中のリンクは押さず、電話もかけないでください。\n\n';
      すぐ.forEach(function(x, n){
        本文 += '■ '+(n+1)+'通目（'+x.項.時+'）\n'+
                '送り主：'+押せなくする(x.項.送り主)+'\n'+
                '件名　：'+押せなくする(x.項.件名)+'\n'+
                'あやしい理由：\n'+
                x.理由.slice(0,4).map(function(y){ return '　・'+押せなくする(y.what)+'\n　　'+押せなくする(y.why); }).join('\n')+'\n'+
                'もとのメール：'+開くリンク(x.項.id)+'\n\n';
      });
      本文 += '迷ったら：警察相談 #9110 ／ 消費者ホットライン 188\n'+
              '※まちがいの知らせ（本物のメール）のこともあります。そのときは公式アプリや公式サイトから確かめてください。';
      送る('危険なメールが届いています（'+すぐ.length+'通）', 本文);
    }
  } finally {
    lock.releaseLock();
  }
}

// 毎朝動く
function morningReport(){
  var p = PropertiesService.getScriptProperties();
  var 記録 = JSON.parse(p.getProperty('きのうからの記録') || '[]');
  var 見た数 = Number(p.getProperty('きのうから見た数')) || 0;
  var 最後 = Number(p.getProperty('最後に見た時刻')) || 0;
  var 危険 = 記録.filter(function(x){ return x.判定>=3; }), 注意 = 記録.filter(function(x){ return x.判定===2; });

  var 本文 = 'きのうの朝から今朝までに見たメール：'+見た数+'通\n'+
             '　危険：'+危険.length+'通　／　注意：'+注意.length+'通\n\n';
  if(Date.now() - 最後 > 3*3600*1000)
    本文 += '⚠ 最後の見回りが '+(最後 ? 日時(new Date(最後)) : 'まだ')+' です。見回りが止まっているかもしれません。\n'+
            '　Apps Script を開いて setup をもう一度実行してください。\n\n';
  function 並べる(list){
    return list.map(function(x){
      return '・'+x.時+'　'+押せなくする(x.送り主)+'\n　件名：'+押せなくする(x.件名)+'\n'+
             x.理由.map(function(y){ return '　→ '+押せなくする(y); }).join('\n')+'\n　'+開くリンク(x.id);
    }).join('\n\n');
  }
  if(危険.length) 本文 += '■ 危険（すでにお知らせ済み）\n'+並べる(危険)+'\n\n';
  if(注意.length) 本文 += '■ 注意（念のため。お店のお知らせメールのこともあります）\n'+並べる(注意)+'\n\n';
  if(!記録.length) 本文 += 'あやしいメールはありませんでした。\n\n';
  本文 += 'このまとめは毎朝届きます。届かない日は、見張りが止まっているしるしです。';

  送る('けさのまとめ（危険'+危険.length+'・注意'+注意.length+'）', 本文);
  p.setProperty('きのうからの記録', '[]');
  p.setProperty('きのうから見た数', '0');
}

// 試すとき：最近20通を判定して「実行ログ」に出すだけ（メールは送らない・記録もしない）
function tryRecent(){
  GmailApp.search('in:inbox', 0, 20).forEach(function(th){
    var msg = th.getMessages().pop();
    var r = メールをしらべる({from:msg.getFrom(), subject:msg.getSubject(), plain:msg.getPlainBody(),
                               html:msg.getBody(), auth:msg.getHeader('Authentication-Results')});
    var 印 = r.判定>=3 ? '【危険】' : r.判定===2 ? '【注意】' : '　なし　';
    Logger.log(印+' '+msg.getSubject().slice(0,40)+'  ／ '+msg.getFrom().slice(0,40)+
               (r.理由.length ? '\n　　'+r.理由.filter(function(x){ return x.lv>=2; }).slice(0,3).map(function(x){ return x.what; }).join(' ／ ') : ''));
  });
}
