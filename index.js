const fs = require('fs');
const path = require('path');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const REPO = 'Discord-Datamining/Discord-Datamining';
const CACHE_FILE = path.join(__dirname, 'last_commit_date.txt');

async function main() {
  if (!DISCORD_WEBHOOK_URL) {
    console.error("エラー: DISCORD_WEBHOOK_URL が設定されていません。");
    process.exit(1);
  }

  let since = "";
  if (fs.existsSync(CACHE_FILE)) {
    since = fs.readFileSync(CACHE_FILE, 'utf8').trim();
  }

  let url = `https://api.github.com/repos/${REPO}/commits?sha=master&per_page=10`; // 直近10件を取得
  if (since) {
    url += `&since=${since}`;
  }

  console.log(`APIリクエスト送信中... (前回記憶日時: ${since || 'なし'})`);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Github-Actions-Discord-Bot' }
    });

    if (!response.ok) throw new Error(`GitHub API エラー: ${response.statusText}`);

    const commits = await response.json();
    if (!Array.isArray(commits) || commits.length === 0) {
      console.log("新しいコミットはありませんでした。");
      return;
    }

    const sortedCommits = commits.reverse();
    let latestCommitDate = since;

    for (const item of sortedCommits) {
      const commitMessage = item.commit.message.trim();
      const commitUrl = item.html_url;
      const commitDate = item.commit.committer.date;

      if (commitDate === since) continue;

      // 【判定条件の強化】
      // 条件①: 改行が含まれている
      // 条件②: または、1行しかなくても文字数が50文字以上（長文コメント）である
      if (commitMessage.includes('\n') || commitMessage.length > 50) {
        console.log(`条件一致コミットを発見: ${item.sha.substring(0, 7)}`);
        
        const payload = {
          content: `【Discord-Datamining 新着ログ】\n${commitMessage}\n\nURL: ${commitUrl}`
        };

        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      latestCommitDate = commitDate;
    }

    if (latestCommitDate && latestCommitDate !== since) {
      fs.writeFileSync(CACHE_FILE, latestCommitDate, 'utf8');
      console.log(`キャッシュを更新しました: ${latestCommitDate}`);
    }

  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

main();
