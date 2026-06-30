const fs = require('fs');
const path = require('path');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const REPO = 'Discord-Datamining/Discord-Datamining';
const STATE_FILE = path.join(__dirname, 'last_sha.txt');

async function main() {
  if (!DISCORD_WEBHOOK_URL) {
    console.error("エラー: DISCORD_WEBHOOK_URL が設定されていません。");
    process.exit(1);
  }

  // 前回チェックしたコミットのSHAを読み込む
  let lastSha = "";
  if (fs.existsSync(STATE_FILE)) {
    lastSha = fs.readFileSync(STATE_FILE, 'utf8').trim();
  }

  const url = `https://api.github.com/repos/${REPO}/commits?sha=master`;
  
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Github-Actions-Discord-Bot' } });
    if (!response.ok) throw new Error(`GitHub API エラー: ${response.statusText}`);

    const commits = await response.json();
    if (!Array.isArray(commits) || commits.length === 0) return;

    // 最新のコミットSHAを保持しておく
    const latestSha = commits[0].sha;

    let newCommits = [];
    if (!lastSha) {
        // 初回実行時は、通知せずに最新SHAだけを記録して終了する（過去の大量通知を防ぐため）
        console.log("初回実行（last_sha.txtが存在しない）のため、最新のSHAを保存して終了します。");
        fs.writeFileSync(STATE_FILE, latestSha, 'utf8');
        return;
    }

    const lastShaIndex = commits.findIndex(c => c.sha === lastSha);

    if (lastShaIndex === -1) {
        // 前回記録したSHAが見つからない場合（長期間実行されず30件以上コミットされた等）
        console.warn("前回のコミットが直近のリストに見つかりませんでした。取得できたものを処理します。");
        newCommits = commits;
    } else {
        // 前回処理したSHAより「前（新しい）」コミットを抽出
        newCommits = commits.slice(0, lastShaIndex);
    }

    // 古い順に処理してDiscordへ送信するためにリバース
    newCommits.reverse();

    for (const item of newCommits) {
      const commitMessage = item.commit.message;
      const commitUrl = item.html_url;
      
      // 【改行判定】改行コードで分割し、空白のみの行を除外
      const lines = commitMessage.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      
      // 実質的な行数が2行以上（タイトル + 詳細コメント）あれば通知する
      if (lines.length > 1) {
        const payload = { 
            content: `【Discord-Datamining 新着ログ】\n\`\`\`text\n${commitMessage}\n\`\`\`\nURL: ${commitUrl}` 
        };
        
        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        // APIレートリミット（Discord側）に引っかからないよう2秒待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 処理が完了したら、新しいSHAをテキストファイルに書き込む
    if (latestSha !== lastSha) {
      fs.writeFileSync(STATE_FILE, latestSha, 'utf8');
      console.log(`last_sha.txt を更新しました: ${latestSha}`);
    } else {
      console.log("新しいコミットはありませんでした。");
    }

  } catch (error) {
    console.error("予期せぬエラーが発生しました:", error);
    process.exit(1);
  }
}

main();
