// 古い Silk でも動くよう ES5 だけで書く(const/アロー関数/fetch は使わない)
(function () {
  var NIGHT_START = 22, NIGHT_END = 6;   // 夜モードの時間帯
  var UMBRELLA_PCT = 50;                 // この降水確率以上で傘表示
  var CARD_SEC = 20;                     // 右側の切り替え間隔
  var WEATHER_MIN = 30;                  // 天気の更新間隔
  var WD = ['日', '月', '火', '水', '木', '金', '土'];

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // 場所は公開リポジトリに書かず、端末の localStorage にだけ置く
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // WMO 天気コード → 絵文字と日本語
  function wx(code) {
    if (code === 0) return ['☀', '晴れ'];
    if (code <= 2) return ['🌤', '晴れ時々くもり'];
    if (code === 3) return ['☁', 'くもり'];
    if (code <= 48) return ['🌫', '霧'];
    if (code <= 67) return ['🌧', '雨'];
    if (code <= 77) return ['❄', '雪'];
    if (code <= 82) return ['🌦', 'にわか雨'];
    if (code <= 86) return ['🌨', 'にわか雪'];
    return ['⛈', '雷雨'];
  }

  function tick() {
    var d = new Date(), h = d.getHours();
    $('time').innerHTML = h + ':' + pad(d.getMinutes());
    $('date').innerHTML = (d.getMonth() + 1) + '月' + d.getDate() + '日(' + WD[d.getDay()] + ')';
    var night = h >= NIGHT_START || h < NIGHT_END;
    document.body.className = night ? 'night' : '';
    // 焼き付き対策: 1分ごとに数ピクセルずらす
    var m = d.getMinutes();
    $('wrap').style.left = ((m % 5) - 2) + 'px';
    $('wrap').style.top = ((Math.floor(m / 5) % 5) - 2) + 'px';
  }

  var cards = ['c-now', 'c-hours', 'c-tomorrow'], ci = 0;
  function rotate() {
    $(cards[ci]).className = 'card';
    ci = (ci + 1) % cards.length;
    $(cards[ci]).className = 'card on';
  }

  function getWeather() {
    var lat = load('lat'), lon = load('lon');
    if (!lat || !lon) { $('status').innerHTML = '⚙ から場所を設定してください'; return; }
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,weather_code' +
      '&hourly=temperature_2m,precipitation_probability,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=Asia%2FTokyo&forecast_days=2';
    var x = new XMLHttpRequest();
    x.open('GET', url);
    x.timeout = 15000;
    x.onload = function () {
      try { render(JSON.parse(x.responseText)); }
      catch (e) { $('status').innerHTML = '天気の読み取りに失敗'; }
    };
    x.onerror = x.ontimeout = function () {
      $('status').innerHTML = '天気を取得できません(時計は動いています)';
    };
    x.send();
  }

  function render(j) {
    var c = j.current, dl = j.daily, hr = j.hourly, w = wx(c.weather_code);
    $('nowIcon').innerHTML = w[0];
    $('nowTemp').innerHTML = Math.round(c.temperature_2m) + '°';
    $('todayRange').innerHTML = wx(dl.weather_code[0])[1] + ' ' + Math.round(dl.temperature_2m_max[0]) +
      '° / ' + Math.round(dl.temperature_2m_min[0]) + '°  降水 ' + dl.precipitation_probability_max[0] + '%';

    // 今から先12時間の最大降水確率で傘表示を決める
    var now = new Date(), start = 0, i, maxp = 0, html = '';
    for (i = 0; i < hr.time.length; i++) {
      if (new Date(hr.time[i].replace('T', ' ').replace(/-/g, '/')) >= new Date(now.getTime() - 3600000)) { start = i; break; }
    }
    for (i = start; i < start + 12 && i < hr.time.length; i++) {
      if (hr.precipitation_probability[i] > maxp) maxp = hr.precipitation_probability[i];
      if ((i - start) % 2 === 0) {
        html += '<div>' + parseInt(hr.time[i].substr(11, 2), 10) + '時<b>' + wx(hr.weather_code[i])[0] +
          '</b>' + Math.round(hr.temperature_2m[i]) + '° ' + hr.precipitation_probability[i] + '%</div>';
      }
    }
    $('hours').innerHTML = html;
    $('umbrella').style.display = maxp >= UMBRELLA_PCT ? 'block' : 'none';

    var t = wx(dl.weather_code[1]);
    $('tmIcon').innerHTML = t[0];
    $('tmTemp').innerHTML = Math.round(dl.temperature_2m_max[1]) + '° / ' + Math.round(dl.temperature_2m_min[1]) + '°';
    $('tmRain').innerHTML = t[1] + '  降水 ' + dl.precipitation_probability_max[1] + '%';
    $('status').innerHTML = '更新 ' + now.getHours() + ':' + pad(now.getMinutes());
  }

  // 設定画面
  $('gear').onclick = function () {
    $('sLat').value = load('lat') || ''; $('sLon').value = load('lon') || '';
    $('settings').style.display = 'block';
  };
  $('sClose').onclick = function () { $('settings').style.display = 'none'; };
  $('sSave').onclick = function () {
    var la = parseFloat($('sLat').value), lo = parseFloat($('sLon').value);
    if (isNaN(la) || isNaN(lo)) { alert('数字で入力してください'); return; }
    // 細かすぎる位置は不要なので小数2桁(約1km)に丸める
    save('lat', la.toFixed(2)); save('lon', lo.toFixed(2));
    $('settings').style.display = 'none'; getWeather();
  };
  $('sGeo').onclick = function () {
    if (!navigator.geolocation) { alert('この端末では現在地が使えません'); return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      $('sLat').value = p.coords.latitude.toFixed(2); $('sLon').value = p.coords.longitude.toFixed(2);
    }, function () { alert('現在地を取得できませんでした'); });
  };

  tick(); setInterval(tick, 10000);
  setInterval(rotate, CARD_SEC * 1000);
  getWeather(); setInterval(getWeather, WEATHER_MIN * 60000);
  // 長時間開きっぱなしでの不調に備え、毎日3時に再読み込み
  setInterval(function () { var d = new Date(); if (d.getHours() === 3 && d.getMinutes() === 0) location.reload(); }, 60000);
})();
