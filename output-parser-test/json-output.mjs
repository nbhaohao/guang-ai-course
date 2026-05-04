import { OpenAIChatService } from './shared.mjs';

const QUESTION = '请介绍一下爱因斯坦的信息。请以 JSON 格式返回，包含以下字段：name（姓名）、birth_year（出生年份）、nationality（国籍）、major_achievements（主要成就，数组）、famous_theory（著名理论）。';

async function main() {
  const llm = new OpenAIChatService();

  console.log('🤔 正在调用大模型...\n');
  const raw = await llm.invoke(QUESTION);

  console.log('✅ 收到响应:\n');
  console.log(raw);

  const result = JSON.parse(raw);
  console.log('\n📋 解析后的 JSON 对象:');
  console.log(result);
}

main().catch((err) => console.error('❌ 错误:', err.message));
