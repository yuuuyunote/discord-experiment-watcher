const fs = require('fs');
const axios = require('axios');

const TARGET_URL = 'https://raw.githubusercontent.com/xHyroM/discord-datamining/master/data/client/experiments/experiments.json';
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const CACHE_FILE = './last_experiments.json';

async function main() {
    try {
        // 1. 最新の実験機能データを取得
        const response = await axios.get(TARGET_URL);
        const currentData = response.data;

        const jsonString = JSON.stringify(currentData);
        const regex = /\d{4}-\d{2}_[a-zA-Z0-9_]+/g;
        const foundExperiments = jsonString.match(regex) || [];
        const currentExperiments = [...new Set(foundExperiments)];

        // 2. キャッシュの読み込み
        let prevExperiments = [];
        if (fs.existsSync(CACHE_FILE)) {
            try {
                prevExperiments = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
            } catch (e) {
                prevExperiments = [];
            }
        }

        // 3. 差分の抽出
        const newExperiments = currentExperiments.filter(exp => !prevExperiments.includes(exp));

        // 4. 初回実行時（保存データが空、または極端に少ない場合）の防衛策
        // 全通知による400エラー（文字数制限超過）を回避するため、記録だけして終了する
        if (prevExperiments.length < 30) {
            console.log(`初期化処理を実行します。現在の全機能 (${currentExperiments.length}個) をキャッシュに保存します。通知はスキップされます。`);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(currentExperiments, null, 2));
            return;
        }

        // 5. 通常時のDiscord通知処理
        if (newExperiments.length > 0) {
            console.log(`新しい実験機能を発見しました: ${newExperiments.join(', ')}`);
            
            const message = {
                embeds: [{
                    title: "🚀 新しい実験機能（Experiments）が検出されました",
                    description: newExperiments.map(exp => `• \`${exp}\``).join('\n'),
                    color: 5814783,
                    footer: { text: "Discord Datamining 監視システム" },
                    timestamp: new Date().toISOString()
                }]
            };

            await axios.post(WEBHOOK_URL, message);
            console.log("Discordへの通知が完了しました。");
        } else {
            console.log("新しい実験機能はありませんでした。");
        }

        // 6. データの保存
        fs.writeFileSync(CACHE_FILE, JSON.stringify(currentExperiments, null, 2));

    } catch (error) {
        console.error("エラーが発生しました:", error.message);
        process.exit(1);
    }
}

main();
