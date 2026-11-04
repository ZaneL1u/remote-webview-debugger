import type { Dict } from './en.ts'

// 日本語の文案。構成は en.ts と同じ。

export const ja: Dict = {
  meta: {
    title: 'Remote WebView Debugger：AI エージェントに実機の WebView をデバッグさせる',
    description:
      'オープンソース・セルフホスト：ページに script タグを 1 つ追加するだけで、Claude Code、Codex、Cursor などの MCP クライアントが、ユーザーのスマートフォン上の H5 ページやアプリ内 WebView を読み取り、操作できます。接続にはユーザーの許可が必要で、機密情報はマスクされ、いつでも引き継げます。USB ケーブルもデバッグ用ポートも不要です。',
    ogTitle: 'Remote WebView Debugger',
    ogDescription: 'AI エージェントに、ユーザーのスマートフォン内の WebView をデバッグさせましょう。script タグ 1 つ、デバイスコード 1 つ、MCP のアドレス 1 つ。オープンソースです。',
  },
  nav: {
    skip: '本文へスキップ',
    demo: 'デモ',
    live: '自分で試す',
    how: '仕組み',
    features: '機能',
    highlights: '注目ポイント',
    privacy: 'プライバシー',
    selfHost: 'セルフホスト',
    faq: 'よくある質問',
    github: 'GitHub',
    menu: 'メニュー',
    themeToggle: 'ライト / ダークを切り替え',
    langLabel: '言語',
  },
  hero: {
    eyebrow: 'オープンソース · MIT · MCP',
    titleHtml: 'AI エージェントに、<em>ユーザーのスマートフォン内</em>の WebView をデバッグさせる。',
    sub:
      'H5 ページやアプリの WebView に script タグを 1 つ追加します。ユーザーが短いデバイスコードを読み上げれば、Claude Code、Codex、Cursor などの MCP クライアントがページを見て、console とネットワークを読み、自分でタップして不具合を再現できます。その様子はユーザーに見えていて、いつでも引き継げます。',
    ctaDemo: 'デモを見る',
    ctaLive: '自分のエージェントで試す',
    ctaGithub: 'GitHub で Star',
    ctaSelfHost: '5 分でセルフホスト',
    /** The quick-start box under the buttons: a prompt for your agent, or the script tag. */
    quick: {
      label: 'クイックスタート',
      agent: 'エージェントに頼む',
      script: 'script タグ',
      agentHint: 'Claude Code・Codex・Cursor に貼り付け',
      prompt: 'https://debugger.site/llms.txt に従って、このプロジェクトに Remote WebView Debugger を導入してください。',
    },
    flow: {
      label: 'AI エージェントは MCP でセルフホストのゲートウェイに接続し、ゲートウェイが WebSocket でユーザーのスマートフォン上のページ SDK に届きます。',
      agent: 'AI エージェント',
      agentSub: 'Claude Code · Codex · Cursor などの MCP クライアント',
      gw: 'ゲートウェイ',
      gwSub: 'セルフホスト · 承認 · 監査',
      phone: 'ユーザーのスマートフォン',
      phoneSub: 'H5 ページ / アプリ WebView + SDK',
      mcp: 'MCP · HTTPS',
      ws: 'WebSocket',
      state: 'AI 操作中',
    },
  },
  demo: {
    kicker: 'ライブデモ',
    title: '「実機」で本物の不具合を突き止める',
    lead:
      'スマートフォンではデモショップの中で本物のページ SDK が動いています。シミュレートしているのはゲートウェイだけで、それもこのタブの中です。下のスナップショット、クリック、console の 1 行、ライブパッチは、すべて実際に起きています。',
    agentTitle: 'AI エージェント',
    agentSub: 'Remote WebView Debugger の MCP サーバーに接続済み',
    skinLabel: 'エージェントのスタイル',
    skinClaude: 'Claude Code',
    skinCodex: 'Codex',
    /** The two ways to use the demo: one phone, two modes. */
    modeLabel: 'デモのモード',
    modeWatch: 'エージェントの不具合修正を見る',
    modeWatchSub: 'スクリプト再生 · ブラウザ内で動作',
    modeTry: '自分のエージェントで試す',
    modeTrySub: '本物のゲートウェイ · 自分のキー',
    phoneLabel: 'お客さまのスマートフォン',
    play: '再生',
    pause: '一時停止',
    restart: '最初から',
    speed: '速度',
    start: 'デモを再生',
    startHint: 'エージェントがスマートフォンに接続し、決済の不具合を再現して根本原因を突き止め、修正をその場で検証するまでを見てみましょう。',
    expand: '結果をすべて表示',
    collapse: '閉じる',
    running: '実行中',
    done: '完了',
    error: 'エラー',
    you: 'サポート担当',
    agent: 'エージェント',
    customer: 'お客さま',
    /** The hand that points at “Allow” when nobody taps it. */
    guideTap: '「許可」をタップ',
    guideAuto: (s: number) => `${s} 秒後に自動`,
    footnote: 'iframe 内は無改変の <code>sdk.js</code> · その WebSocket は postMessage 経由でこのタブ内の模擬ゲートウェイへ · RPC はすべて実際に実行。',
    stateIdle: '準備完了',
    statePrelude: 'お客さまが不具合に遭遇',
    stateRunning: 'エージェント実行中',
    statePaused: '一時停止中',
    stateWaitApproval: 'お客さまの許可を待っています',
    stateWaitControl: 'お客さまが操作を戻すのを待っています',
    stateDone: '完了',
    stateStopped: '停止しました',
  },
  live: {
    kicker: '実際に試す',
    title: '次は自分のエージェントで試してみてください',
    lead:
      'こちらは本物です。<code>demo.debugger.site</code> に公開のデモゲートウェイがあり、ほかのすべてから隔離されていて毎日リセットされます。スマートフォンの中のショップはそこから読み込んでいます。キーを取得してエージェントの接続先に指定すれば、ここで動く様子が見られます。',
    steps: [
      {
        title: '自分用のキーを取得する',
        body: 'クリック 1 回、登録は不要です。このキーはデモゲートウェイでのみ使え、デモがリセットされるまで有効です。',
      },
      {
        title: 'デモゲートウェイをエージェントに追加する',
        body: 'ターミナルでコマンドを一度実行するか、MCP クライアントの設定に書き込みます。キーはすでに埋め込まれています。',
      },
      {
        title: 'エージェントに頼む',
        body: 'スマートフォンの中のショップのデバイスコードはプロンプトに埋め込まれています。エージェントが接続を求めたら、ショップで <em>許可</em> をタップして動く様子を見てください。<em>引き継ぐ</em> や <em>終了</em> はいつでも押せます。',
      },
    ],
    phoneTitle: 'デモショップ（ライブ）',
    phoneHint: 'これは <code>demo.debugger.site</code> そのもので、本物の SDK が動いています。コードを読み取れば、スマートフォンでも開けます。',
    open: '新しいタブで開く',
    scan: 'コードを読み取ってスマートフォンで開く',
    tabsLabel: 'デモ用の MCP 設定',
    getKey: 'キーを取得',
    keyIdle: 'キーを取得すると、下のコマンドに埋め込まれます。',
    keyLoading: 'キーを取得しています…',
    keyReady: 'あなた専用のキーを埋め込みました。デモのリセット時（毎日 04:00 UTC+8）に無効になるので、またここで取得してください。',
    keyFailed: 'いまデモゲートウェイに接続できません。しばらくしてから再試行してください。',
    keyLimited: 'このネットワークからのキー発行が多すぎます。1 時間後に再試行してください。',
    deviceWaiting: 'ショップがオンラインになるのを待っています…',
    deviceReady: (code: string) => `このページのデバイスコードは ${code} です。プロンプトに埋め込みました。`,
    deviceUnavailable: 'ショップがデバイスコードを報告しませんでした。ショップ内のピルから読み取ってください。',
    prompt:
      'rwd-demo の MCP サーバーを使ってデバイス XXXX-XXXX に接続して。ショップで商品に Gift box の包装を選んで決済に進み、合計が「--」と表示される原因を調べて。',
    promptLabel: 'プロンプト',
    promptNote: '<code>XXXX-XXXX</code> はショップに表示されているデバイスコードに置き換えてください。',
    limitsTitle: 'デモの制限',
    limits: [
      '訪問者ごとにキー 1 つ：エージェントが届くのは、あなたがデバイスコードを渡し、許可したページだけです',
      'レベルは <strong>interact</strong> のみ：スクリプト実行、リクエスト本文、ストレージは使えません',
      '1 つのエージェントが 1 ページを占有できるのは最大 15 分（無操作なら 5 分）です',
      'MCP リクエストは IP ごとに毎分 120 件までです',
      '毎日 04:00（UTC+8）にリセットされます。実在する個人情報は入力しないでください',
    ],
  },
  how: {
    kicker: '仕組み',
    title: '「自分のスマートフォンで壊れている」から根本原因まで、3 ステップ',
    steps: [
      {
        title: 'ページに SDK を追加する',
        body:
          '<code>&lt;head&gt;</code> にできるだけ早く script タグを 1 つ。console とネットワークが 1 行目から記録されます。アプリでは、同じスクリプトをドキュメント開始時に注入します。',
      },
      {
        title: 'ユーザーがデバイスコードを伝える',
        body:
          'どのスマートフォンにも <code>K7Q2-9M4X</code> のような固定のデバイスコードがあり、小さなピルに表示されます。ユーザーが <em>サポートを依頼</em> をタップすると、そのデバイスはエージェントの一覧の先頭に並びます。',
      },
      {
        title: 'エージェントが MCP で接続する',
        body:
          'ゲートウェイがホストする MCP のエンドポイントを API キー付きで追加し、あとは問題を説明するだけです。エージェントがデバイスを見つけ、許可を求め、調査を始めます。',
      },
    ],
    pill: { code: 'K7Q2-9M4X', online: 'オンライン', help: 'サポートを依頼' },
    chip1: 'CDN の sdk.js · console とネットワークを 1 行目から記録',
    chip3: 'スマートフォンで許可済み · レベル interact',
    prompt: 'デバイス K7Q2-9M4X で決済できず、合計が「--」と表示される。原因を調べて。',
    tabsLabel: 'MCP クライアントの設定',
    sdkNote: '本番ではバージョンを固定するか、ゲートウェイ自身のコピー <code>/v1/sdk.js</code> を使ってください（SRI の値は管理コンソールにあります）。',
  },
  features: {
    kicker: 'エージェントができること',
    title: 'おなじみの DevTools のやり方を、MCP 経由で他人のスマートフォンに',
    items: [
      { icon: 'tree', title: 'アクセシビリティスナップショット', body: 'Playwright 形式の YAML に要素の ref 付き。エージェントはページをピクセルではなく構造として読み、ref で正確に操作します。' },
      { icon: 'cursor', title: '本物の操作', body: 'クリック、フォーム入力、文字入力、キー押下、選択、ホバー、スクロール、ドラッグ。操作可能かを確認し、React や Vue が受け付けるイベントを発行します。' },
      { icon: 'terminal', title: 'console とネットワーク', body: 'ページの読み込み時から上限付きのバッファに記録するので、エージェントが参加する前のエラーも残っています。本文も必要に応じて取得できます。' },
      { icon: 'layers', title: '複数ページのセッション', body: '一覧 → 詳細 → 決済、あるいは 2 つ目の WebView。1 台のデバイスのすべてのページが 1 つのセッションになり、ページをまたぐタイムラインが見られます。' },
      { icon: 'bell', title: 'セッションの変化をプッシュ', body: 'ツールの結果の末尾には必ず変化が付きます。新しいページ、遷移、エラー、ユーザーによる引き継ぎ。ポーリングは不要です。' },
      { icon: 'list', title: 'スマートフォン上のタスクカード', body: 'エージェントが計画と進捗を端末に表示するので、ユーザーは AI が何をなぜしているのかを常に把握できます。' },
      { icon: 'camera', title: 'スクリーンショット', body: 'アプリがブリッジを提供していればネイティブの実ピクセル、なければ DOM の再描画。どちらにもマスクが適用されます。' },
      { icon: 'scroll', title: '端末上のセッションログ', body: 'アプリの起動以降のページ、タップ、console、すべてのリクエストを、スマートフォンの IndexedDB に保存。後からでも読めます。' },
      { icon: 'wrench', title: 'ライブパッチ', body: 'advanced レベルでは、エージェントが <code>evaluate_script</code> で動いているページにパッチを当て、修正をその場で検証できます。' },
      { icon: 'wifi', title: '不安定なネットワーク', body: 'バックオフ付きの軽いハートビート。3 回失敗したら毎分 1 回の存在確認に切り替え、必要になればゲートウェイがページを起こします。' },
      { icon: 'globe', title: '11 言語対応', body: 'スマートフォン側の UI、管理コンソール、エージェント向けのテキストが 11 言語（右から左に書くアラビア語を含む）。独自の言語パックや文言も追加できます。' },
      { icon: 'plug', title: '任意の MCP クライアント', body: '<code>/v1/mcp</code> は Streamable HTTP で、Claude Code、Codex、Cursor などがそのまま使えます。stdio しか話さないクライアントには小さなブリッジがあります。' },
    ],
    toolsTitle: 'すべてのツール',
    /** The tools by what they are for (the tool names themselves are in lib/snippets.ts). */
    toolGroups: [
      { title: 'デバイスと操作', body: 'デバイスを探し、お客さまの許可を得て接続。操作が戻るのを待ち、終わったら解放。' },
      { title: 'ページ', body: 'デバイス上のすべてのタブと WebView。遷移にも追従。' },
      { title: 'ページを見る', body: '要素 ref 付きの構造、テキスト検索、スクリーンショット。' },
      { title: '操作する', body: 'ref への本物の入力を、操作できるか確かめてから。まとめて 1 往復でも。' },
      { title: 'デバッグ', body: 'console、本文付きのネットワーク、ストレージ、ページ内のスクリプト。' },
      { title: '履歴', body: 'ページをまたいで何が起きたか。接続する前のことも。' },
    ],
    levelsLabel: '必要なレベル',
  },
  highlights: {
    kicker: '注目ポイント',
    title: '現場でしか起きない不具合のために',
    lead: 'ケーブル、リモートデバッグ用ポート、画面録画では得られない 3 つのこと。',
    items: [
      {
        title: '不具合はもう起きてしまった？ ログはまだスマートフォンの中にあります。',
        body:
          'アプリが起動した瞬間から、SDK は端末の IndexedDB にセッションログを書き込みます。訪れたページ、ユーザーのタップと入力、console の出力、そしてすべてのリクエスト。失敗したものはヘッダーと本文も一緒に残ります。どこにも送信されません。同じマスクのルールのもとでスマートフォンに留まり、ユーザーが許可したエージェントが <code>get_session_overview</code> と <code>get_session_log</code> で読むまでそのままです。直近 3 回の起動分を、1 回あたり最大 10 MB まで保持します。',
        tag: 'セッションログ · 端末上のコールドストレージ',
        visual: {
          title: 'rwd-log · 起動 3 / 3',
          rows: ['09:41:02  開く   index.html', '09:41:09  タップ 「Gift box」', '09:41:11  タップ Buy now', '09:41:12  エラー TypeError: order.price.toFixed…', '09:41:13  通信   GET api/coupon → 404', '09:52:30  agent  接続（interact）', '09:52:31  読取   get_session_log'],
        },
      },
      {
        title: '出荷する前に、お客さまのスマートフォンで修正を検証。',
        body:
          'ユーザーが <strong>advanced</strong> を許可すると、<code>evaluate_script</code> がページの中で実行されます。エージェントは壊れた状態を直し、関数を差し替え、ビューを再描画して、その結果を実機で確かめられます。診断を証明するライブパッチです。それはそのページのメモリにしか存在せず、何も永続化されません。センシティブなクリックには、やはりユーザーの同意が必要です。',
        tag: 'ライブパッチ · evaluate_script',
        visual: {
          title: 'checkout.html · ライブ',
          before: '合計  --',
          after: '合計  $208.00',
          code: 'order.price = Number(order.price)',
        },
      },
      {
        title: 'DevTools を使う人間ではなく、エージェントのために作られています。',
        body:
          'ツールの結果の末尾には、前回の呼び出し以降に端末で起きた変化が必ず付くので、エージェントはポーリングしません。ページの内容は信頼できないデータとして渡されます。スマートフォンのタスクカードがエージェントの計画を示し、ゲートウェイはエージェントの言語で話します。ツールの説明と結果が 11 言語あります。',
        tag: 'エージェント向け · MCP',
        visual: {
          title: 'ツールの結果 · 末尾',
          rows: ['[セッションの変化]', '- p2「Checkout」が開きました（前面）', '- p1 console エラー：TypeError …', '- ユーザーが引き継ぎました'],
        },
      },
    ],
  },
  privacy: {
    kicker: 'プライバシーと主導権',
    title: 'ユーザーのスマートフォンは、あくまでユーザーのもの',
    lead: 'リモートデバッグは信頼されてはじめて成り立ちます。どのセッションも、見えていて、許可が必要で、いつでも止められます。',
    items: [
      { title: 'まず許可', body: 'エージェントが接続を求めると、ユーザーは誰が求めているかを見て、スマートフォンでレベルを選びます。有効なのは実際のタップだけで、スクリプトが自分を許可することはできません。' },
      { title: 'いつでも引き継ぐ、終了する', body: 'エージェントが操作している間、ページは光る縁の内側でロックされます。<em>引き継ぐ</em> を 1 回タップすればエージェントは一時停止し、<em>終了</em> で切断されます。' },
      { title: 'デフォルトでマスク', body: 'パスワードと <code>data-rwd-mask</code> を付けた要素は、スナップショット、スクリーンショット、console、ネットワークのデータ、セッションログで <code>••••</code> と表示されます。プロジェクトごとにセレクターや正規表現も追加できます。' },
      { title: 'センシティブなクリックには同意が必要', body: '「注文を確定」「アカウントを削除」のようなボタンに <code>data-rwd-confirm</code> を付けると、エージェントがクリックするたびにユーザーが確認します。' },
      { title: '権限レベル', body: '<strong>observe</strong> は閲覧、<strong>interact</strong> は操作、<strong>advanced</strong> はさらにスクリプト実行、リクエスト本文、ストレージ。キーごと、プロジェクトごとに上限を設けられます。' },
      { title: '監査ログ', body: '接続、承認、RPC、引き継ぎのすべてを、誰が・何を・いつ、で記録します。ページの内容やパラメータの値は記録しません。' },
    ],
    levels: [
      { name: 'observe', tools: 'スナップショット、スクリーンショット、console、ネットワーク一覧、セッションログ、要素の検索、待機' },
      { name: 'interact', tools: '+ クリック、フォーム入力、文字入力、キー押下、選択、ホバー、スクロール、ドラッグ、ページ遷移' },
      { name: 'advanced', tools: '+ evaluate_script（ライブパッチ）、リクエスト / レスポンスの本文、ストレージ' },
    ],
  },
  native: {
    kicker: 'ネイティブアプリ',
    title: 'アプリでは、ユーザースクリプト 1 つです',
    lead:
      'SDK を一度ダウンロードし、ドキュメント開始時に注入します。iOS は WKUserScript、Android は addDocumentStartJavaScript。Web ページ側は何も変えません。',
    extras: [
      { title: 'どこでも同じデバイスコード', body: '固定の <code>deviceId</code> を渡し（<code>deviceToken</code> は保存しておけば）、WebView やドメインをまたいでもデバイスコードは変わりません。' },
      { title: 'ネイティブの操作ボタン', body: '<code>nativeControl()</code> で独自の引き継ぐ / AI に戻す / 終了ボタンを表示できます。ページのスクリプトからは呼び出せません。' },
      { title: 'ネイティブの承認ダイアログ', body: '<code>nativeApproval: true</code> にすると、接続の要求と確認をアプリ自身の UI に渡せます。' },
      { title: '実ピクセルのスクリーンショット', body: '小さなブリッジ（WKWebView のスナップショット、Android のビットマップ）があれば、エージェントは DOM の再描画ではなく本物の画面を受け取ります。' },
    ],
    tabs: { ios: 'iOS（Swift）', android: 'Android（Kotlin）', h5: 'H5 ページ' },
  },
  selfHost: {
    kicker: 'セルフホスト',
    title: 'Go のバイナリ 1 つ。あなたのサーバー、あなたのデータ。',
    lead: 'ゲートウェイは管理コンソールとページ SDK を埋め込んでいます。標準で SQLite、必要なら Postgres、HTTPS は Docker Compose と Caddy で。',
    points: [
      { title: '管理コンソール', body: 'デバイス、API キー、メンバーとロール、QR コードの招待、ポリシー、監査ログ。さらに自分のキーが埋め込まれた統合ガイドも付いています。' },
      { title: 'データベース', body: '標準では SQLite のファイル 1 つ。<code>RWD_DATABASE_URL=postgres://…</code> を設定すれば Postgres を使います。' },
      { title: '運用', body: '<code>/v1/metrics</code> の Prometheus メトリクス、SRI 付きでバージョンを固定した SDK の URL、<code>/v1/healthz</code> のヘルスチェック。' },
    ],
    stepsTitle: 'クイックスタート',
    dockerComment: '# コンテナ 1 つ：管理コンソール + ゲートウェイ + SDK',
    deployComment: '# または自分でビルドして配置し、Caddy で HTTPS にする',
    resultComment: '# → 管理コンソール  https://rwd.example.com\n# → ゲートウェイ    https://rwd.example.com/v1（MCP は /v1/mcp）',
    requires: 'サーバーに必要なのは Docker だけです。ソースからビルドするには Go と Node が必要です。',
    docsLink: 'デプロイガイド',
    agentTitle: 'またはエージェントに任せる',
    agentPrompt: 'https://debugger.site/llms.txt に従って、私のサーバーに Remote WebView Debugger のゲートウェイをデプロイし、あなたの MCP サーバーに追加してください。',
  },
  faq: {
    kicker: 'よくある質問',
    title: 'よく聞かれること',
    items: [
      {
        q: 'ユーザーは何かインストールする必要がありますか？',
        a: 'いりません。H5 ページでは SDK がページの一部です。アプリではネイティブコードから注入します。ユーザーに見えるのは、デバイスコードが載った小さなピルと、エージェントが接続するときの許可ダイアログだけです。',
      },
      {
        q: 'エージェントは何を見られて、何ができますか？',
        a: 'ユーザーが許可した範囲だけです。そのデバイスの WebView のページを、与えられたレベルで扱います。WebView の外は一切操作しません。マスクされた項目はマスクされたままで、ページの内容は信頼できないデータとしてモデルに渡されます。',
      },
      {
        q: 'エージェントが接続する前に不具合が起きました。もう追えませんか？',
        a: '追えます。SDK はアプリの起動時から端末にセッションログを残します。ページ、タップ、console、リクエスト。後から接続したエージェントも <code>get_session_log</code> で不具合までの道筋をすべて読めます。それ以外の場面で、ログがスマートフォンから出ることはありません。',
      },
      {
        q: 'エージェントはスマートフォン上で不具合を直せますか？',
        a: '修正を検証できます。<strong>advanced</strong> レベルでは、<code>evaluate_script</code> が動いているページにメモリ上でパッチを当て、状態を直し、関数を差し替え、再描画して、問題が消えるかをエージェントが確かめます。本当の修正はいつもどおりのリリースで出してください。端末には何も残りません。',
      },
      {
        q: 'どのエージェントで使えますか？',
        a: '任意の MCP クライアントです。Claude Code、Codex、Cursor はホストされた Streamable HTTP のエンドポイントに直接つながります。stdio しか話さないクライアントは <code>rwd mcp</code>（同じエンドポイントへの小さなブリッジ）を使います。',
      },
      {
        q: 'どのプラットフォームに対応していますか？',
        a: '最近のモバイル WebView やブラウザであれば対応します。iOS の WKWebView、Android System WebView、アプリ内ブラウザ、そしてモバイルの Safari や Chrome。デスクトップのブラウザでも動きます。',
      },
      {
        q: 'ネットワークが悪い、WebSocket が遮られる場合はどうなりますか？',
        a: 'ページは軽いハートビートの WebSocket を指数バックオフ付きで維持します。3 回続けて接続できなければ毎分 1 回の存在確認に切り替え、エージェントが接続したいときはゲートウェイがページを起こします。',
      },
      {
        q: 'ページが遅くなりませんか？',
        a: 'script タグ 1 つです。console とネットワークの記録は上限付きのリングバッファ（各 500 件、レスポンス本文は合計 5 MB まで）に入り、セッションログはバックグラウンドで書き込まれ、待機中の接続はハートビートだけをやり取りします。',
      },
      {
        q: 'eruda、vConsole、PageSpy と一緒に使えますか？',
        a: '使えます。スナップショットとヒットテストはそれらのノードを飛ばし、SDK 自身の通信はそれらのネットワークログに出ません。eruda の中のタブとして収めることもできます。',
      },
      {
        q: '上のデモは本物ですか？',
        a: 'SDK は本物で、手を加えていません。模擬しているのはゲートウェイだけで、あなたのブラウザの中にあります。WebSocket のシムが <code>postMessage</code> で SDK の接続をそこへトンネルし、スクリプト化されたエージェントが本物のゲートウェイと同じ RPC を送ります。端から端まで本物を試すなら、<a href="#live">自分のエージェントで試してみてください</a>。',
      },
    ],
  },
  footer: {
    tagline: 'AI エージェントに、実機の H5 ページやアプリ WebView をデバッグさせましょう。',
    project: 'プロジェクト',
    docs: 'ドキュメント',
    languages: '言語',
    links: {
      github: 'GitHub',
      issues: 'Issue 報告',
      license: 'MIT ライセンス',
      protocol: 'プロトコル',
      gateway: 'ゲートウェイ',
      sdk: 'ページ SDK',
      architecture: 'アーキテクチャ',
      native: 'ネイティブ統合',
    },
    note: 'MIT ライセンスで公開しています。Cookie も解析ツールも使っていません。',
  },
  notFound: {
    title: 'ページが見つかりません',
    body: 'このページは存在しません。デバイスがオフラインになったのかもしれません。',
    home: 'ホームに戻る',
  },
  copy: { copy: 'コピー', copied: 'コピー済み' },
}
