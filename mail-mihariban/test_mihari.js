// メール見張り番の判定を、パソコンの上で試す（Gmail にはつながない）
//   node test_mihari.js
var fs = require('fs'), vm = require('vm');
var ctx = vm.createContext({console: console});
vm.runInContext(fs.readFileSync(__dirname + '/../ayashii_engine.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), ctx);
var しらべる = ctx.メールをしらべる, 押せなくする = ctx.押せなくする;

var 試験 = [
  // ---- 危険と出てほしいもの ----
  {名:'Amazonを名乗る別のアドレス', 期待:3, m:{from:'"Amazon.co.jp" <info@amazon-security-jp.top>', subject:'お支払い方法の確認', plain:'お客様のアカウントは一時的に停止されました。24時間以内に以下から確認してください。', html:'<a href="https://amazon-security-jp.top/login">確認する</a>', auth:'spf=pass; dmarc=pass'}},
  {名:'三井住友カードを名乗る（文字の裏に隠れたリンク）', 期待:3, m:{from:'"三井住友カード" <noreply@smbc-card-info.com>', subject:'【重要】ご利用確認のお願い', plain:'不正利用の可能性を検知しました。本人確認が必要です。', html:'<a href="https://smbc-card-info.com.verify-jp.xyz/">本人確認はこちら</a>', auth:''}},
  {名:'なりすまし（dmarc=fail）', 期待:3, m:{from:'"楽天カード" <info@mail.rakuten-card.co.jp>', subject:'カードのご利用停止について', plain:'ご確認ください。', html:'', auth:'mx.google.com; spf=fail; dkim=none; dmarc=fail (p=NONE)'}},
  {名:'ニセ警察', 期待:3, m:{from:'keishicho.sousa@gmail.com', subject:'捜査へのご協力のお願い', plain:'警視庁捜査二課です。あなたの口座が資金洗浄に使われた疑いがあります。誰にも言わないでください。LINEで連絡してください。', html:'', auth:'dmarc=pass'}},
  {名:'未払いの脅し＋短縮リンク', 期待:3, m:{from:'support@kakin-center.click', subject:'最終通告', plain:'有料サイトの未払い料金について法的措置に移ります。本日中にご連絡ください。 https://bit.ly/3abcd', html:'', auth:''}},
  {名:'荷物の不在＋怪しいリンク', 期待:3, m:{from:'"ヤマト運輸" <delivery@kuroneko-yamato-jp.shop>', subject:'お荷物のお届けについて', plain:'お荷物をお届けにあがりましたが不在のため持ち帰りました。', html:'<a href="http://kuroneko-yamato-jp.shop/re">再配達の依頼</a>', auth:''}},

  // ---- 注意（朝のまとめ）でよいもの ----
  {名:'知らない店の「本日中」セール＋リンク', 期待:2, m:{from:'"ABCショップ" <news@abc-shop.co.jp>', subject:'本日中！最大50%オフ', plain:'本日中のセールです。', html:'<a href="https://www.instagram.com/abcshop">Instagram</a>', auth:'dmarc=pass'}},

  // ---- 何もなしと出てほしいもの（誤報しないか） ----
  {名:'本物のAmazon', 期待:0, m:{from:'"Amazon.co.jp" <shipment-tracking@amazon.co.jp>', subject:'ご注文の商品を発送しました', plain:'ご注文ありがとうございます。', html:'<a href="https://www.amazon.co.jp/gp/your-account/order-details">注文を表示</a>', auth:'dmarc=pass'}},
  {名:'本物の楽天（サブドメインから）', 期待:0, m:{from:'"楽天市場" <info@emagazine.rakuten.co.jp>', subject:'今週のおすすめ', plain:'今週のおすすめ商品です。', html:'<a href="https://event.rakuten.co.jp/campaign/">見る</a><a href="https://link.rakuten.co.jp/0/123">x</a>', auth:'dmarc=pass'}},
  {名:'友だちからのメール', 期待:0, m:{from:'"山田" <yamada.taro@gmail.com>', subject:'週末どう？', plain:'週末ひま？ご飯行こう。', html:'', auth:'dmarc=pass'}},
  {名:'GitHubのお知らせ', 期待:0, m:{from:'"GitHub" <noreply@github.com>', subject:'[GitHub] A new SSH key was added', plain:'A new public key was added to your account.', html:'<a href="https://github.com/settings/keys">keys</a>', auth:'dmarc=pass'}},
  // 本人の受信箱で誤って「危険」になったもの（10/25 tryRecent）とそっくりなメール
  {名:'本物の楽天の宣伝（楽天グループの別の住所へのリンク）', 期待:0, m:{from:'"ポイントインセンティブニュース" <point-g@emagazine.rakuten.co.jp>', subject:'【クリックしてポイントGET】ソーシャルギフト！初回利用500ポイント【楽天】', plain:'抽選で当選した方にプレゼント！', html:'<a href="https://rakuten-gift.example-cdn.net/">ギフト</a><a href="https://event.rakuten.co.jp/">x</a>', auth:'dkim=pass; spf=pass; dmarc=pass (p=REJECT)'}},
  {名:'本物の楽天証券のログイン通知', 期待:0, m:{from:'"楽天証券からのお知らせ" <service@rakuten-sec.co.jp>', subject:'楽天証券のお取引画面にログインがありました', plain:'お取引画面へのログインがありました。お心当たりがない場合は、パスワードを再設定してください。不正なログインの可能性があります。', html:'<a href="https://www.rakuten-sec.co.jp/">楽天証券</a>', auth:'dmarc=pass'}},
  // 同じ楽天のアドレスでも、なりすまし確認に落ちたら信用しない
  {名:'楽天証券のアドレスを偽ったログイン通知（dmarc=fail）', 期待:3, m:{from:'"楽天証券" <service@rakuten-sec.co.jp>', subject:'ログインがありました', plain:'パスワードを再設定してください。', html:'<a href="https://rakuten-sec-login.top/">再設定</a>', auth:'spf=fail; dmarc=fail'}},
  {名:'本物の三井住友カード（vpass）', 期待:0, m:{from:'"三井住友カード" <mail@contact.vpass.ne.jp>', subject:'ご利用明細のお知らせ', plain:'今月のご利用明細が確定しました。', html:'<a href="https://www.smbc-card.com/mem/index.jsp">Vpass</a>', auth:'dmarc=pass'}}
];

var 合格 = 0;
試験.forEach(function(t){
  var r = しらべる(t.m), ok = r.判定 === t.期待;
  if(ok) 合格++;
  console.log((ok?'○':'×')+' '+t.名+'  判定='+r.判定+'（期待 '+t.期待+'）');
  if(!ok || r.判定) r.理由.filter(function(x){ return x.lv>=2; }).slice(0,4).forEach(function(x){ console.log('     ・['+x.lv+'] '+x.what); });
});

// 通知の文に押せるリンクが残らないか
var 崩し = 押せなくする('行き先は「amazon-security-jp.top」 https://bit.ly/3abcd');
var 崩しOK = !/https?:\/\//.test(崩し) && !/amazon-security-jp\.top/.test(崩し);
console.log((崩しOK?'○':'×')+' 通知の文のリンクを押せない形に崩す → '+崩し);
if(崩しOK) 合格++;

console.log('\n'+合格+' / '+(試験.length+1)+' 合格');
process.exit(合格 === 試験.length+1 ? 0 : 1);
