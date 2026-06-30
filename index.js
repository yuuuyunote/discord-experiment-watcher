const fs = require('fs');
const path = require('path');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // API制限回避用
const REPO = 'Discord-Datamining/Discord-Datamining';
const STATE_FILE = path.join(__dirname, 'last_sha.txt');

async function main() {
  if (!DISCORD_WEBHOOK_URL) {
    console.error("エラー: DISCORD_WEBHOOK_URL が設定されていません。");
    process.exit(1);
  }

  let lastSha = "";
  if (fs.existsSync(STATE_FILE)) {
    lastSha = fs.readFileSync(STATE_FILE, 'utf8').trim();
    console.log(`[起動] 前回のSHA: ${lastSha}`);
  } else {
    console.log(`[起動] last_sha.txt が存在しません（初回実行）。`);
  }

  // per_page=100 を追加して取得漏れを防止
  const url = `https://api.github.com/repos/${REPO}/commits?sha=master&per_page=100`;
  const headers = {
    'User-Agent': 'Github-Actions-Discord-Bot',
    'Accept': 'application/vnd.github.v3+json'
  };
  
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub API エラー: ${response.statusText}`);

    const commits = await response.json();
    if (!Array.isArray(commits) || commits.length === 0) {
      console.log("コミットが取得できませんでした。");
      return;
    }

    const latestSha = commits[0].sha;
    let newCommits = [];

    if (!lastSha) {
        console.log("初回実行のため、最新のSHAを保存して終了します。");
        fs.writeFileSync(STATE_FILE, latestSha, 'utf8');
        return;
    }

    const lastShaIndex = commits.findIndex(c => c.sha === lastSha);

    if (lastShaIndex === -1) {
        console.warn("⚠️ 前回のSHAが見つかりません。直近100件すべてを処理対象にします。");
        newCommits = commits;
    } else {
        newCommits = commits.slice(0, lastShaIndex);
        console.log(`新着コミットは ${newCommits.length} 件です。`);
    }

    newCommits.reverse();

    for (const item of newCommits) {
      const commitMessage = item.commit.message;
      const commitUrl = item.html_url;
      const shortSha = item.sha.substring(0, 7);
      
      // 改行で分割し、空白行を除外
      const lines = commitMessage.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      
      console.log(`\n--- チェック中: [${shortSha}] ---`);
      console.log(`メッセージ行数: ${lines.length}行`);
      
      if (lines.length > 1) {
        console.log(`💡 条件クリア！Discordへ送信します。`);
        const payload = { 
            content: `【Discord-Datamining 新着ログ】\n\`\`\`text\n${commitMessage}\n\`\`\`\nURL: ${commitUrl}` 
        };
        
        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`⏩ スキップ: メッセージが1行のみ、または詳細がありません。`);
      }
    }

    if (latestSha !== lastSha) {
      fs.writeFileSync(STATE_FILE, latestSha, 'utf8');
      console.log(`\n✅ last_sha.txt を更新しました: ${latestSha}`);
    } else {
      console.log(`\n✅ 新しいコミットはありませんでした。`);
    }

  } catch (error) {
    console.error("予期せぬエラーが発生しました:", error);
    process.exit(1);
  }
}

main();
