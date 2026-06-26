const fs = require('fs');
const axios = require('axios');

// ターゲットにするリポジトリの experiments.json の生データURL
const TARGET_URL = 'https://raw.githubusercontent.com/xHyroM/discord-datamining/master/data/client/experiments/experiments.json';
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const CACHE_FILE = './last_experiments.json';

async function main() {
    try {
        // 1. ターゲットリポジトリから最新の JSON を取得
        const response = await axios.get(TARGET_URL);
        const currentData = response.data;

        // 文字列（JSON全体）から "YYYY-MM_機能名" のパターンをすべて抽出
        const jsonString = JSON.stringify(currentData);
        const regex = /\d{4}-\d{2}_[a-zA-Z0-9_]+/g;
        const foundExperiments = jsonString.match(regex) || [];
        
        // 重複を排除して綺麗にする
        const currentExperiments = [...new Set(foundExperiments)];

        // 2. 前回保存したデータを読み込み
        let prevExperiments = [];
        if (fs.existsSync(CACHE_FILE)) {
            prevExperiments = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        }

        // 3. 新しく追加された実験機能（前回は存在しなかったもの）を特定
        const newExperiments = currentExperiments.filter(exp => !prevExperiments.includes(exp));

        // 4. 新機能があれば Discord へ Webhook 送信
        if (newExperiments.length > 0) {
            console.log(`新しい実験機能を発見しました: ${newExperiments.join(', ')}`);
            
            const message = {
                embeds: [{
                    title: "🚀 新しい実験機能（Experiments）が検出されました",
                    description: newExperiments.map(exp => `• \`${exp}\``).join('\n'),
                    color: 5814783, // Discord Blurple
                    footer: { text: "Discord Datamining 監視システム" },
                    timestamp: new Date().toISOString()
                }]
            };

            await axios.post(WEBHOOK_URL, message);
            console.log("Discordへの通知が完了しました。");
        } else {
            console.log("新しい実験機能はありませんでした。");
        }

        // 5. 今回取得したリストを次回の比較用に保存
        fs.writeFileSync(CACHE_FILE, JSON.stringify(currentExperiments, null, 2));

    } catch (error) {
        console.error("エラーが発生しました:", error.message);
        process.exit(1);
    }
}

main();
